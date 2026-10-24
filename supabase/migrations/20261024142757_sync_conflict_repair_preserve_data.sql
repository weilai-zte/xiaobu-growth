set local lock_timeout = '8s';
set local statement_timeout = '45s';
select id from xiaobu_private.meta where id=1 for update;
lock table xiaobu_private.records in share mode;
do $data_preservation_before$
begin
  perform set_config('xiaobu_release.records_before', (select md5(coalesce(string_agg(entity||':'||id||':'||payload::text||':'||seq::text,'|' order by entity,id),'')) from xiaobu_private.records), true);
  perform set_config('xiaobu_release.meta_before', (select m::text from xiaobu_private.meta m where id=1), true);
end;
$data_preservation_before$;
-- 云端兼容候选补丁（部署前）：F2 档案单调合并 + F3 逐条冲突隔离。
--
-- 状态：候选补丁。已在隔离PGlite PostgreSQL运行时执行，未部署真实云端；
--       行为验收见 supabase/tests/sync_conflict_repair.sql（需在隔离库按下列顺序执行）。
-- 应用顺序：20261019_family_sync.sql → 20261020_family_growth.sql →
--            20261021_launch_compat.sql → 本文件。
--
-- 改动范围：
--   1) 新增 xiaobu_private 下四个只读辅助函数：valid_timestamp / normalize_buddy_care /
--      merge_buddy_care / latest_timestamp；新增 merge_profile。
--   2) 替换 public.xiaobu_exchange(text,bigint,jsonb)：每条记录一个子事务，
--      可恢复的业务冲突只拒绝这一条，其余合法记录照常写入，并返回 rejected 列表。
--   3) 档案 childProfiles 的单调字段合并：buddyCare、honorsSeenAt、既有收藏并集。
--
-- 不改：旧迁移文件、RLS 与策略、表结构、Edge Function、客户端代码；
--       不新增 anon/authenticated 权限；不改变心愿校验口径与兑换计分规则；
--       服务端专管记录（bankAccounts / bankEntries / adventureRuns）写规则不变。
--       同步锁（xiaobu_private.meta 行锁）与 service_role-only 边界保持不变。

-- ---------------------------------------------------------------------------
-- 1) 有效时间：只看格式与可解析性，无效值不参与单调比较。
-- ---------------------------------------------------------------------------
create or replace function xiaobu_private.valid_timestamp(p_value jsonb)
returns timestamptz language plpgsql stable security invoker set search_path = '' as $$
begin
  if jsonb_typeof(p_value) is distinct from 'string' then return null; end if;
  if coalesce(p_value #>> '{}','') !~ '^\d{4}-\d{2}-\d{2}($|T| )' then return null; end if;
  return (p_value #>> '{}')::timestamptz;
exception when others then
  return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2) 归一化 buddyCare：合法日期 + 合法动作 + 非负整数亲密值；非法形状整体作废。
-- ---------------------------------------------------------------------------
create or replace function xiaobu_private.normalize_buddy_care(p_value jsonb)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare
  v_completed jsonb;
begin
  if p_value is null or jsonb_typeof(p_value)<>'object' then return null; end if;
  if coalesce(p_value->>'date','') !~ '^\d{4}-\d{2}-\d{2}$' then return null; end if;
  v_completed := (
    select coalesce(jsonb_agg(to_jsonb(a.action) order by a.ord),'[]'::jsonb)
    from (values ('feed',1),('play',2),('groom',3),('sleep',4)) as a(action,ord)
    where exists (
      select 1 from jsonb_array_elements_text(
        case when jsonb_typeof(p_value->'completed')='array' then p_value->'completed' else '[]'::jsonb end
      ) t where t = a.action
    )
  );
  return p_value || jsonb_build_object(
    'completed', v_completed,
    'xp', case
      when jsonb_typeof(p_value->'xp')='number' and coalesce(p_value->>'xp','') ~ '^\d{1,15}$'
        then (p_value->>'xp')::bigint
      else 0
    end
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 3) buddyCare 合并：
--    同日：completed 取并集；亲密值 = max(两边, max(0, 旧基线) + 并集数)，同日重复动作不重复加亲密值。
--    跨日：completed/sleepingSince 取较晚日期的一侧；亲密值只取 max，不反推缺失的跨日历史。
--    p_newer 决定同日的入睡状态以哪一侧为准（版本落后时保留当前睡眠状态）。
-- ---------------------------------------------------------------------------
create or replace function xiaobu_private.merge_buddy_care(p_old jsonb, p_new jsonb, p_newer boolean)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare
  v_old jsonb := xiaobu_private.normalize_buddy_care(p_old);
  v_new jsonb := xiaobu_private.normalize_buddy_care(p_new);
  v_completed jsonb;
  v_prior bigint;
  v_base jsonb;
begin
  if v_old is null then return v_new; end if;
  if v_new is null then return v_old; end if;
  if (v_old->>'date') <> (v_new->>'date') then
    v_base := case when (v_new->>'date') > (v_old->>'date') then v_new else v_old end;
    return v_base || jsonb_build_object('xp',greatest((v_old->>'xp')::bigint,(v_new->>'xp')::bigint));
  end if;
  v_completed := (
    select coalesce(jsonb_agg(to_jsonb(a.action) order by a.ord),'[]'::jsonb)
    from (values ('feed',1),('play',2),('groom',3),('sleep',4)) as a(action,ord)
    where exists (select 1 from jsonb_array_elements_text(v_old->'completed') t where t = a.action)
       or exists (select 1 from jsonb_array_elements_text(v_new->'completed') t where t = a.action)
  );
  v_prior := greatest(
    0,
    (v_old->>'xp')::bigint - jsonb_array_length(v_old->'completed'),
    (v_new->>'xp')::bigint - jsonb_array_length(v_new->'completed')
  );
  v_base := case when p_newer then v_new else v_old end;
  return v_base || jsonb_build_object(
    'completed', v_completed,
    'xp', greatest((v_old->>'xp')::bigint,(v_new->>'xp')::bigint,v_prior + jsonb_array_length(v_completed))
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 4) 较晚时间：只认有效时间，保留原始字符串；无效值不覆盖已有有效值。
-- ---------------------------------------------------------------------------
create or replace function xiaobu_private.latest_timestamp(p_a jsonb, p_b jsonb)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare
  v_a timestamptz := xiaobu_private.valid_timestamp(p_a);
  v_b timestamptz := xiaobu_private.valid_timestamp(p_b);
begin
  if v_a is null and v_b is null then return null; end if;
  if v_a is null then return p_b; end if;
  if v_b is null then return p_a; end if;
  if v_b > v_a then return p_b; end if;
  return p_a;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5) 档案合并：
--    收藏并集沿用既有 merge_collections 口径；
--    buddyCare 与 honorsSeenAt 为单调字段，版本落后也合并；
--    其余档案字段按 LWW：版本落后时保留当前服务端版本；
--    合并后内容与当前一致时由调用方跳过写入，不提升同步序号。
-- ---------------------------------------------------------------------------
create or replace function xiaobu_private.merge_profile(p_row jsonb, p_old jsonb)
returns jsonb language plpgsql volatile security invoker set search_path = '' as $$
declare
  v_claims jsonb;
  v_care jsonb;
  v_seen jsonb;
  v_base jsonb;
  v_newer boolean;
  v_result jsonb;
  v_stamp text;
begin
  if p_old is null then
    v_result := p_row;
    v_care := xiaobu_private.merge_buddy_care(null,p_row->'buddyCare',true);
    if (p_row ? 'buddyCare') and v_care is distinct from p_row->'buddyCare' then
      v_result := v_result || jsonb_build_object('buddyCare',v_care);
    end if;
    v_seen := xiaobu_private.latest_timestamp(p_row->'honorsSeenAt',null);
    if v_seen is not null and v_seen is distinct from p_row->'honorsSeenAt' then
      v_result := v_result || jsonb_build_object('honorsSeenAt',v_seen);
    end if;
    return v_result;
  end if;

  v_newer := coalesce(p_row->>'updatedAt','') > coalesce(p_old->>'updatedAt','');
  v_base := case when v_newer then p_row else p_old end;
  v_claims := xiaobu_private.merge_collections(p_row,p_old);
  v_care := xiaobu_private.merge_buddy_care(p_old->'buddyCare',p_row->'buddyCare',v_newer);
  v_seen := xiaobu_private.latest_timestamp(p_old->'honorsSeenAt',p_row->'honorsSeenAt');

  v_result := v_base;
  if coalesce(v_claims->'starClaims','{}'::jsonb)<>'{}'::jsonb or (v_base ? 'starClaims') then
    v_result := v_result || jsonb_build_object('starClaims',v_claims->'starClaims');
  end if;
  if coalesce(v_claims->'honorClaims','{}'::jsonb)<>'{}'::jsonb or (v_base ? 'honorClaims') then
    v_result := v_result || jsonb_build_object('honorClaims',v_claims->'honorClaims');
  end if;
  if v_care is not null then
    v_result := v_result || jsonb_build_object('buddyCare',v_care);
  elsif (p_old ? 'buddyCare') or (p_row ? 'buddyCare') then
    v_result := v_result || jsonb_build_object('buddyCare',null::jsonb);
  end if;
  if v_seen is not null then
    v_result := v_result || jsonb_build_object('honorsSeenAt',v_seen);
  end if;

  -- 版本落后但单调字段确有变化：保留当前版本的其他档案字段，并给出新的可见版本号。
  if (v_result - 'updatedAt' - 'syncSeq') is distinct from (p_old - 'updatedAt' - 'syncSeq')
     and coalesce(v_result->>'updatedAt','') <= coalesce(p_old->>'updatedAt','') then
    v_stamp := to_char(greatest(clock_timestamp(), coalesce((p_old->>'updatedAt')::timestamptz + interval '1 millisecond','-infinity'::timestamptz)) at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
    v_result := v_result || jsonb_build_object('updatedAt',v_stamp);
  end if;
  return v_result;
end;
$$;

revoke all on function xiaobu_private.valid_timestamp(jsonb), xiaobu_private.normalize_buddy_care(jsonb),
  xiaobu_private.merge_buddy_care(jsonb,jsonb,boolean), xiaobu_private.latest_timestamp(jsonb,jsonb),
  xiaobu_private.merge_profile(jsonb,jsonb) from public, anon, authenticated;
grant execute on function xiaobu_private.valid_timestamp(jsonb), xiaobu_private.normalize_buddy_care(jsonb),
  xiaobu_private.merge_buddy_care(jsonb,jsonb,boolean), xiaobu_private.latest_timestamp(jsonb,jsonb),
  xiaobu_private.merge_profile(jsonb,jsonb) to service_role;

-- ---------------------------------------------------------------------------
-- 6) 同步入口：逐条子事务 + rejected 列表。
--    可恢复的业务冲突（心愿余额不足、心愿/打卡/家庭口径校验失败）只拒绝这一条；
--    存储与基础设施故障（唯一冲突、连接中断、类型越界等）整批失败，不伪装成 INVALID_RECORD。
-- ---------------------------------------------------------------------------
create or replace function public.xiaobu_exchange(
  p_action text default 'sync', p_since bigint default 0, p_changes jsonb default '{}'::jsonb
) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  v_seq bigint;
  v_reset bigint;
  v_entity text;
  v_rows jsonb;
  v_row jsonb;
  v_old jsonb;
  v_stamp text;
  v_rule jsonb;
  v_tables jsonb := '{}'::jsonb;
  v_earned bigint;
  v_committed bigint;
  v_rejected jsonb := '[]'::jsonb;
  v_row_id text;
  v_state text;
  v_message text;
  v_code text;
  v_canonical jsonb;
  v_skip boolean;
  v_entities text[] := array['childProfiles','dailyLogs','taskTemplates','taskRecords','routineRules','routineChecks','conflictLogs','strengthMoments','weeklyReviews','experiments','wishes','adventureRuns','familyMembers','growthPacts','pactSignatures','familyChecks','familyReactions','bankAccounts','bankEntries'];
begin
  -- 同一事务内串行写入和余额校验，保证手机和电脑不会超额兑换。
  select seq, reset_seq into v_seq, v_reset from xiaobu_private.meta where id=1 for update;
  if p_action = 'clear' then
    delete from xiaobu_private.records;
    v_seq := v_seq + 1; v_reset := v_seq;
  elsif p_action = 'sync' then
    if coalesce(jsonb_typeof(p_changes),'') <> 'object' then raise exception '同步内容格式不正确'; end if;
    for v_entity, v_rows in select key,value from jsonb_each(p_changes) order by case key when 'childProfiles' then 0 when 'routineRules' then 1 when 'familyMembers' then 2 when 'wishes' then 4 when 'growthPacts' then 5 when 'pactSignatures' then 6 when 'familyChecks' then 7 when 'familyReactions' then 8 else 3 end loop
      if not (v_entity = any(v_entities)) or jsonb_typeof(v_rows) <> 'array' then raise exception '同步表名或格式不正确'; end if;
      for v_row in select value from jsonb_array_elements(v_rows) loop
        v_row_id := case when jsonb_typeof(v_row->'id')='string' then v_row->>'id' else '' end;
        v_skip := false;
        -- 每条记录一个子事务：一条冲突不挡同批其他记录。
        begin
          if coalesce(jsonb_typeof(v_row->'id'),'') <> 'string' or coalesce(v_row->>'id','') = '' then raise exception '记录缺少 ID'; end if;
          select payload into v_old from xiaobu_private.records where entity=v_entity and id=v_row->>'id';

          -- 服务端专管记录：只有回读，不改写也不删除。
          if v_entity in ('bankAccounts','bankEntries') then
            if v_old is null then raise exception '银行记录只能通过存取与周息接口生成'; end if;
            v_skip := true;
          elsif v_entity='adventureRuns' then
            if v_old is null then raise exception '冒险奖励只能通过每日冒险领取'; end if;
            v_skip := true; -- 已有奖励不可更新、删除或重抽
          end if;

          -- 档案：单调字段合并，版本落后也生效；内容无变化不写、不提升序号。
          if not v_skip and v_entity='childProfiles' then
            v_row := xiaobu_private.merge_profile(v_row,v_old);
            if v_old is not null and (v_row - 'updatedAt' - 'syncSeq') = (v_old - 'updatedAt' - 'syncSeq') then
              v_skip := true;
            end if;
          end if;

          -- 新打卡星数与实际分钟数口径。
          if not v_skip and v_entity in ('routineChecks','taskRecords') then
            if v_row->>'rewardStars' is not null and (jsonb_typeof(v_row->'rewardStars') <> 'number' or v_row->>'rewardStars' not in ('1','2')) then raise exception '新打卡星数只能为1或2'; end if;
            if v_entity='routineChecks' then
              select payload into v_rule from xiaobu_private.records where entity='routineRules' and id=v_row->>'ruleId';
              if v_old is null and v_rule->>'rewardStars' in ('1','2') then v_row := v_row || jsonb_build_object('rewardStars',(v_rule->>'rewardStars')::int); end if;
              if not coalesce((v_row->>'deleted')::boolean,false) and v_row->>'status'='done' and v_rule->>'minMinutes' is not null then
                if coalesce(jsonb_typeof(v_row->'minutes'),'') <> 'number' then raise exception '请记录实际运动分钟数'; end if;
                if (v_row->>'minutes')::numeric < (v_rule->>'minMinutes')::numeric or (v_row->>'minutes')::numeric > 600 then raise exception '实际运动分钟数不足，请确认后再记录'; end if;
              end if;
            end if;
          end if;

          -- 版本落后不覆盖当前记录。
          if not v_skip and v_old is not null and coalesce(v_row->>'updatedAt','') <= coalesce(v_old->>'updatedAt','') then
            v_skip := true;
          end if;

          -- 家庭签订与打卡口径。
          if not v_skip then perform xiaobu_private.validate_family(v_entity,v_row,v_old); end if;

          -- 心愿口径与星星余额。
          if not v_skip and v_entity='wishes' then
            if v_old->>'status'='requested' and (
              v_old->'cost' is distinct from v_row->'cost' or v_old->'name' is distinct from v_row->'name' or v_old->'picture' is distinct from v_row->'picture'
            ) then raise exception '已申请的奖励不能修改价格或内容，请先取消申请'; end if;
            if not coalesce((v_row->>'deleted')::boolean,false) then
              if v_old->>'status' = 'redeemed' then
                v_skip := true;
              else
                if coalesce(length(trim(v_row->>'name')),0) not between 1 and 80 or coalesce(v_row->>'childId','')='' or
                  coalesce(v_row->>'status','') not in ('proposed','approved','requested','redeemed') then raise exception '心愿内容无效'; end if;
                if v_row->>'status' <> 'proposed' and (coalesce(v_row->>'cost','') !~ '^[1-9][0-9]{0,8}$') then raise exception '兑换星数需要是正整数'; end if;
                if v_row->>'status' in ('requested','redeemed') then
                  v_earned := xiaobu_private.wallet_available(v_row->>'childId',v_row->>'id');
                  v_committed := 0;
                  if v_earned < v_committed + (v_row->>'cost')::bigint then raise exception '星星余额不足，请取消本次申请后重新同步' using errcode='WISH1'; end if;
                end if;
              end if;
            end if;
          end if;

          -- 写入：服务端盖章同步序号与可见版本号。
          if not v_skip then
            v_seq := v_seq + 1;
            v_stamp := to_char(greatest(clock_timestamp(), coalesce((v_old->>'updatedAt')::timestamptz + interval '1 millisecond', '-infinity'::timestamptz)) at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
            v_row := v_row || jsonb_build_object('updatedAt',v_stamp,'syncSeq',v_seq);
            insert into xiaobu_private.records(entity,id,payload,seq) values(v_entity,v_row->>'id',v_row,v_seq)
              on conflict (entity,id) do update set payload=excluded.payload,seq=excluded.seq;
          end if;
        exception when others then
          get stacked diagnostics v_state = returned_sqlstate, v_message = message_text;
          -- 只有业务校验错误按条拒绝；存储与基础设施故障整批失败，交给调用方重试。
          if v_state <> 'P0001' and v_state <> 'WISH1' then raise; end if;
          v_code := case when v_state='WISH1' or position('星星余额不足' in v_message)>0 then 'WISH_CONFLICT' else 'INVALID_RECORD' end;
          select payload into v_canonical from xiaobu_private.records where entity=v_entity and id=v_row_id;
          v_rejected := v_rejected || jsonb_build_array(jsonb_build_object(
            'entity', v_entity,
            'id', v_row_id,
            'code', v_code,
            'error', v_message,
            'canonical', v_canonical
          ));
        end;
      end loop;
    end loop;
  else raise exception '未知操作'; end if;
  update xiaobu_private.meta set seq=v_seq,reset_seq=v_reset where id=1;
  foreach v_entity in array v_entities loop
    select coalesce(jsonb_agg(payload order by seq),'[]'::jsonb) into v_rows from xiaobu_private.records r where entity=v_entity and (
      seq>greatest(p_since,0) or (p_action='sync' and exists (
        select 1 from jsonb_array_elements(case when jsonb_typeof(p_changes->v_entity)='array' then p_changes->v_entity else '[]'::jsonb end) attempted
        where attempted->>'id'=r.id
      ))
    );
    v_tables := v_tables || jsonb_build_object(v_entity,v_rows);
  end loop;
  return jsonb_build_object('seq',v_seq,'resetSeq',v_reset,'tables',v_tables,'rejected',v_rejected,'serverTime',clock_timestamp(),'ok',true);
end;
$$;
revoke all on function public.xiaobu_exchange(text,bigint,jsonb) from public, anon, authenticated;
grant execute on function public.xiaobu_exchange(text,bigint,jsonb) to service_role;

do $data_preservation_after$
begin
  if current_setting('xiaobu_release.records_before') is distinct from (select md5(coalesce(string_agg(entity||':'||id||':'||payload::text||':'||seq::text,'|' order by entity,id),'')) from xiaobu_private.records) then
    raise exception 'Deployment changed existing business records; rolling back';
  end if;
  if current_setting('xiaobu_release.meta_before') is distinct from (select m::text from xiaobu_private.meta m where id=1) then
    raise exception 'Deployment changed sync metadata; rolling back';
  end if;
end;
$data_preservation_after$;
