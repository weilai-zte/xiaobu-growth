-- 增量兼容：先应用20261020_family_growth.sql；不清空记录、不改旧迁移。
-- adventure/action_points继续复用原SQL；所有资金操作与同步共享meta行锁。
create or replace function xiaobu_private.validate_family(p_entity text, p_row jsonb, p_old jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
declare
  v_member jsonb;
  v_pact jsonb;
  v_check jsonb;
  v_clause jsonb;
  v_member_id text;
  v_key text;
  v_plan jsonb;
  v_wish jsonb;
  v_rule_id text;
begin
  if p_entity not in ('familyMembers','growthPacts','pactSignatures','familyChecks','familyReactions') then return; end if;
  if coalesce((p_row->>'deleted')::boolean,false) then raise exception '家庭签订和打卡记录需要保留，请收起公约'; end if;
  if coalesce(p_row->>'childId','')='' then raise exception '缺少家庭档案'; end if;
  if p_old is not null and p_old->>'childId' is distinct from p_row->>'childId' then raise exception '不能更换记录所属家庭'; end if;
  if p_entity='familyMembers' then
    if coalesce(length(trim(p_row->>'name')),0) not between 1 and 30 or coalesce(p_row->>'role','') not in ('parent','child') then raise exception '成员名称或角色无效'; end if;
    if p_old is not null and p_old->>'role' is distinct from p_row->>'role' then raise exception '不能更换成员角色'; end if;
    return;
  end if;
  if p_entity='growthPacts' then
    if coalesce(length(trim(p_row->>'title')),0) not between 1 and 60 or coalesce(jsonb_typeof(p_row->'clauses'),'')<>'array' or coalesce(jsonb_typeof(p_row->'sealed'),'')<>'boolean' or coalesce(jsonb_typeof(p_row->'archived'),'')<>'boolean' then raise exception '公约格式无效'; end if;
    if jsonb_array_length(p_row->'clauses') not between 1 and 12 then raise exception '公约需要1至12条约定'; end if;
    if coalesce((p_old->>'sealed')::boolean,false) and (p_old->>'title' is distinct from p_row->>'title' or p_old->'clauses' is distinct from p_row->'clauses' or not (p_row->>'sealed')::boolean) then raise exception '签订内容不能改写，请重新制定公约'; end if;
    if coalesce((p_old->>'archived')::boolean,false) and not (p_row->>'archived')::boolean then raise exception '已收起的公约不能重新启用'; end if;
    for v_member_id in select p_row->>'authorId' union select value->>'memberId' from jsonb_array_elements(p_row->'clauses') loop
      select payload into v_member from xiaobu_private.records where entity='familyMembers' and id=v_member_id;
      if v_member is null or v_member->>'childId' is distinct from p_row->>'childId' or coalesce((v_member->>'deleted')::boolean,false) then raise exception '参与成员不属于这个家庭'; end if;
    end loop;
    for v_clause in select value from jsonb_array_elements(p_row->'clauses') loop
      if coalesce(length(trim(v_clause->>'text')),0) not between 1 and 120 then raise exception '约定内容无效'; end if;
    end loop;
    if coalesce(p_row->>'replacesPactId','')<>'' then
      select payload into v_pact from xiaobu_private.records where entity='growthPacts' and id=p_row->>'replacesPactId';
      if v_pact is null or v_pact->>'childId' is distinct from p_row->>'childId' or not coalesce((v_pact->>'sealed')::boolean,false) or v_pact ? 'wishPlan' or p_row->>'replacesPactId'=p_row->>'id' then raise exception '公约版本来源无效'; end if;
    end if;
    if p_row ? 'ruleIds' then
      if jsonb_typeof(p_row->'ruleIds')<>'array' then raise exception '关联打卡项目无效'; end if;
      if jsonb_array_length(p_row->'ruleIds')>50 or exists(
        select 1 from jsonb_array_elements(p_row->'ruleIds') r where jsonb_typeof(r)<>'string' or not exists(
          select 1 from xiaobu_private.records where entity='routineRules' and id=r #>> '{}' and payload->>'childId'=p_row->>'childId'
        )
      ) then raise exception '关联打卡项目无效'; end if;
    end if;
    if coalesce((p_old->>'sealed')::boolean,false) and (p_old->'ruleIds' is distinct from p_row->'ruleIds' or p_old->'replacesPactId' is distinct from p_row->'replacesPactId') then raise exception '已签版本关联不能修改'; end if;
    if p_row ? 'wishPlan' then
      v_plan := p_row->'wishPlan';
      if coalesce(jsonb_typeof(v_plan),'')<>'object' or coalesce(length(trim(v_plan->>'wishId')),0) not between 1 and 500 or coalesce(length(trim(v_plan->>'rewardName')),0) not between 1 and 80 or coalesce(jsonb_typeof(v_plan->'ruleIds'),'')<>'array' then raise exception '心愿攒星公约格式无效'; end if;
      if not (v_plan ? 'rewardCost') or (v_plan->'rewardCost'<>'null'::jsonb and (jsonb_typeof(v_plan->'rewardCost')<>'number' or coalesce(v_plan->>'rewardCost','') !~ '^[1-9][0-9]{0,5}$')) then raise exception '兑换星数无效'; end if;
      if (v_plan->>'rewardCost')::numeric > 100000 or jsonb_array_length(v_plan->'ruleIds') not between 1 and 10 or (select count(distinct value) from jsonb_array_elements(v_plan->'ruleIds'))<>jsonb_array_length(v_plan->'ruleIds') then raise exception '请选择有效打卡'; end if;
      if exists(select 1 from jsonb_array_elements(v_plan->'ruleIds') r where jsonb_typeof(r)<>'string' or length(trim(r #>> '{}')) not between 1 and 500) then raise exception '请选择有效打卡'; end if;
      select payload into v_wish from xiaobu_private.records where entity='wishes' and id=v_plan->>'wishId';
      if v_wish is null or v_wish->>'childId' is distinct from p_row->>'childId' then raise exception '心愿不属于这个孩子'; end if;
      for v_rule_id in select value #>> '{}' from jsonb_array_elements(v_plan->'ruleIds') loop
        if not exists(select 1 from xiaobu_private.records where entity='routineRules' and id=v_rule_id and payload->>'childId'=p_row->>'childId') then raise exception '打卡不属于这个孩子'; end if;
      end loop;
      if not exists(select 1 from jsonb_array_elements(p_row->'clauses') c join xiaobu_private.records m on m.entity='familyMembers' and m.id=c->>'memberId' where m.payload->>'role'='parent') or not exists(select 1 from jsonb_array_elements(p_row->'clauses') c join xiaobu_private.records m on m.entity='familyMembers' and m.id=c->>'memberId' where m.payload->>'role'='child') then raise exception '心愿公约需要家长和孩子共同签订'; end if;
      if (p_row->>'sealed')::boolean and (v_plan->'rewardCost'='null'::jsonb or (not coalesce((p_old->>'sealed')::boolean,false) and (v_wish->'cost' is distinct from v_plan->'rewardCost' or v_wish->>'name' is distinct from v_plan->>'rewardName'))) then raise exception '请先确认心愿兑换星数和名称'; end if;
    end if;
    if coalesce((p_old->>'sealed')::boolean,false) and p_old->'wishPlan' is distinct from p_row->'wishPlan' then raise exception '签订的心愿和打卡不能改写'; end if;
    return;
  end if;
  select payload into v_member from xiaobu_private.records where entity='familyMembers' and id=p_row->>'memberId';
  if v_member is null or v_member->>'childId' is distinct from p_row->>'childId' or coalesce((v_member->>'deleted')::boolean,false) then raise exception '参与成员不属于这个家庭'; end if;
  if p_old is not null then
    foreach v_key in array case when p_entity='pactSignatures' then array['pactId','memberId'] when p_entity='familyChecks' then array['pactId','clause','memberId','date'] else array['checkId','memberId'] end loop
      if p_old->v_key is distinct from p_row->v_key then raise exception '已记录的签订和打卡不能改写'; end if;
    end loop;
    return;
  end if;
  if p_entity='familyReactions' then
    select payload into v_check from xiaobu_private.records where entity='familyChecks' and id=p_row->>'checkId';
    if v_check is null or v_check->>'childId' is distinct from p_row->>'childId' or v_check->>'memberId'=p_row->>'memberId' or p_row->>'id' is distinct from 'encourage:'||(p_row->>'checkId')||':'||(p_row->>'memberId') then raise exception '只能给家人的有效打卡送鼓励'; end if;
    return;
  end if;
  select payload into v_pact from xiaobu_private.records where entity='growthPacts' and id=p_row->>'pactId';
  if v_pact is null or not coalesce((v_pact->>'sealed')::boolean,false) or v_pact->>'childId' is distinct from p_row->>'childId' then raise exception '公约尚未确认'; end if;
  if not exists(select 1 from jsonb_array_elements(v_pact->'clauses') c where c->>'memberId'=p_row->>'memberId') then raise exception '只能签订自己的约定'; end if;
  if p_entity='pactSignatures' then
    if p_row->>'id' is distinct from 'signature:'||(p_row->>'pactId')||':'||(p_row->>'memberId') then raise exception '签订编号无效'; end if;
  else
    if v_pact ? 'wishPlan' then raise exception '心愿公约请使用原有打卡，不另建记录'; end if;
    if coalesce(p_row->>'date','') !~ '^\d{4}-\d{2}-\d{2}$' or to_char((p_row->>'date')::date,'YYYY-MM-DD')<>p_row->>'date' or coalesce(p_row->>'clause','') !~ '^(0|[1-9][0-9]?)$' then raise exception '打卡日期或条目无效'; end if;
    if v_pact->'clauses'->((p_row->>'clause')::int)->>'memberId' is distinct from p_row->>'memberId' or p_row->>'id' is distinct from 'family-check:'||(p_row->>'pactId')||':'||(p_row->>'clause')||':'||(p_row->>'date') then raise exception '只能完成自己的约定'; end if;
    if exists(select 1 from jsonb_array_elements(v_pact->'clauses') c where not exists(select 1 from xiaobu_private.records r where r.entity='pactSignatures' and r.payload->>'pactId'=v_pact->>'id' and r.payload->>'memberId'=c->>'memberId' and not coalesce((r.payload->>'deleted')::boolean,false))) then raise exception '公约需要全员签订后才能打卡'; end if;
  end if;
end;
$$;
revoke all on function xiaobu_private.validate_family(text,jsonb,jsonb) from public, anon, authenticated;
grant execute on function xiaobu_private.validate_family(text,jsonb,jsonb) to service_role;


-- 仅识别本地catalog的12个旧星座和60颗新星；slot0与旧星座不重复计奖。
-- 与本地一样，这里验证领取时间并计分，不重新判断客户端的荣誉达标条件。
create or replace function xiaobu_private.valid_claim(p_value jsonb)
returns boolean language plpgsql stable security invoker set search_path = '' as $$
begin
  if jsonb_typeof(p_value) is distinct from 'string' or coalesce(p_value #>> '{}','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}($|T| )' then return false; end if;
  return isfinite((p_value #>> '{}')::timestamptz);
exception when others then return false;
end;
$$;

create or replace function xiaobu_private.achievement_bonus(p_claims jsonb)
returns bigint language sql stable security invoker set search_path = '' as $$
  select coalesce(sum(case when xiaobu_private.valid_claim(p_claims->sign) then 2 else 0 end
    + (select count(*)*2 from generate_series(0,4) slot
       where xiaobu_private.valid_claim(p_claims->('sky:'||sign||':'||slot))
       and not (slot=0 and xiaobu_private.valid_claim(p_claims->sign)))),0)::bigint
  from unnest(array['aries','taurus','gemini','cancer','leo','virgo','libra','scorpio','sagittarius','capricorn','aquarius','pisces']) sign;
$$;

-- 并集在过期水位判断之前处理。过期档案新增收藏时保留服务端其他字段。
create or replace function xiaobu_private.merge_collections(p_row jsonb, p_old jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  result jsonb := p_row;
  field text;
  incoming jsonb;
  previous jsonb;
  merged jsonb;
  added boolean := false;
begin
  foreach field in array array['starClaims','honorClaims'] loop
    incoming := coalesce(p_row->field,'{}'::jsonb);
    if incoming='null'::jsonb then incoming := '{}'::jsonb; end if;
    if jsonb_typeof(incoming)<>'object' then raise exception '收藏格式无效'; end if;
    previous := coalesce(p_old->field,'{}'::jsonb);
    if jsonb_typeof(previous)<>'object' then previous := '{}'::jsonb; end if;
    merged := previous || incoming;
    -- 无效值不能擦掉已经有效的永久收藏。
    select merged || coalesce(jsonb_object_agg(key,value),'{}'::jsonb) into merged
      from jsonb_each(previous) where xiaobu_private.valid_claim(value) and not xiaobu_private.valid_claim(incoming->key);
    added := added or exists(select 1 from jsonb_each(merged) where not previous ? key
      or (xiaobu_private.valid_claim(value) and not xiaobu_private.valid_claim(previous->key)));
    result := result || jsonb_build_object(field,merged);
  end loop;
  if p_old is not null and coalesce(p_row->>'updatedAt','')<=coalesce(p_old->>'updatedAt','') and added then
    result := p_old || jsonb_build_object('starClaims',result->'starClaims','honorClaims',result->'honorClaims',
      'updatedAt',to_char(greatest(clock_timestamp(),(p_old->>'updatedAt')::timestamptz+interval '1 millisecond') at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));
  end if;
  return result;
end;
$$;

-- 可用钱包=打卡+冒险+星座奖励+存取流水-已申请/已兑换；利息留在银行，取出才可兑换。
create or replace function xiaobu_private.wallet_available(p_child text, p_exclude_wish text default null)
returns bigint language sql stable security invoker set search_path = '' as $$
  select xiaobu_private.action_points(p_child,null)
    + coalesce((select sum((payload->>'bonusStars')::bigint) from xiaobu_private.records where entity='adventureRuns' and payload->>'childId'=p_child and not coalesce((payload->>'deleted')::boolean,false)),0)
    + coalesce((select xiaobu_private.achievement_bonus(payload->'starClaims') from xiaobu_private.records where entity='childProfiles' and id=p_child),0)
    + coalesce((select sum(case payload->>'kind' when 'deposit' then -(payload->>'amount')::bigint when 'withdraw' then (payload->>'amount')::bigint else 0 end) from xiaobu_private.records where entity='bankEntries' and payload->>'childId'=p_child and not coalesce((payload->>'deleted')::boolean,false)),0)
    - coalesce((select sum((payload->>'cost')::bigint) from xiaobu_private.records where entity='wishes' and payload->>'childId'=p_child and (p_exclude_wish is null or id<>p_exclude_wish) and payload->>'status' in ('requested','redeemed') and not coalesce((payload->>'deleted')::boolean,false)),0);
$$;

-- 内部写入器，只供已持有meta锁的银行事务使用；不暴露PostgREST。
create or replace function xiaobu_private.bank_save(p_entity text, p_row jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_seq bigint;
  v_stamp text;
  v_old jsonb;
begin
  if p_entity not in ('bankAccounts','bankEntries') then raise exception '银行表名无效'; end if;
  select payload into v_old from xiaobu_private.records where entity=p_entity and id=p_row->>'id';
  update xiaobu_private.meta set seq=seq+1 where id=1 returning seq into v_seq;
  v_stamp := to_char(greatest(clock_timestamp(),coalesce((v_old->>'updatedAt')::timestamptz+interval '1 millisecond','-infinity'::timestamptz)) at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  p_row := p_row || jsonb_build_object('createdAt',coalesce(p_row->>'createdAt',v_stamp),'updatedAt',v_stamp,'syncSeq',v_seq);
  insert into xiaobu_private.records(entity,id,payload,seq) values(p_entity,p_row->>'id',p_row,v_seq)
    on conflict(entity,id) do update set payload=excluded.payload,seq=excluded.seq;
  return p_row;
end;
$$;

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
        if coalesce(jsonb_typeof(v_row->'id'),'') <> 'string' or coalesce(v_row->>'id','') = '' then raise exception '记录缺少 ID'; end if;
        select payload into v_old from xiaobu_private.records where entity=v_entity and id=v_row->>'id';
        if v_entity in ('bankAccounts','bankEntries') then
          if v_old is null then raise exception '银行记录只能通过存取与周息接口生成'; end if;
          continue; -- 已有记录重传只回读，不能改写或删除。
        end if;
        if v_entity='childProfiles' then
          v_row := xiaobu_private.merge_collections(v_row,v_old);
        end if;
        if v_entity in ('routineChecks','taskRecords') then
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
        if v_entity = 'adventureRuns' then
          if v_old is null then raise exception '冒险奖励只能通过每日冒险领取'; end if;
          continue; -- 已有奖励不可更新、删除或重抽
        end if;
        if v_old is not null and coalesce(v_row->>'updatedAt','') <= coalesce(v_old->>'updatedAt','') then continue; end if;
        perform xiaobu_private.validate_family(v_entity,v_row,v_old);
        if v_entity='wishes' and v_old->>'status'='requested' and (
          v_old->'cost' is distinct from v_row->'cost' or v_old->'name' is distinct from v_row->'name' or v_old->'picture' is distinct from v_row->'picture'
        ) then raise exception '已申请的奖励不能修改价格或内容，请先取消申请'; end if;
        if v_entity = 'wishes' and not coalesce((v_row->>'deleted')::boolean,false) then
          if v_old->>'status' = 'redeemed' then continue; end if;
          if coalesce(length(trim(v_row->>'name')),0) not between 1 and 80 or coalesce(v_row->>'childId','')='' or
            coalesce(v_row->>'status','') not in ('proposed','approved','requested','redeemed') then raise exception '心愿内容无效'; end if;
          if v_row->>'status' <> 'proposed' and (coalesce(v_row->>'cost','') !~ '^[1-9][0-9]{0,8}$') then raise exception '兑换星数需要是正整数'; end if;
          if v_row->>'status' in ('requested','redeemed') then
            v_earned := xiaobu_private.wallet_available(v_row->>'childId',v_row->>'id');
            v_committed := 0;
            if v_earned < v_committed + (v_row->>'cost')::bigint then raise exception '星星余额不足，请取消本次申请后重新同步'; end if;
          end if;
        end if;
        v_seq := v_seq + 1;
        v_stamp := to_char(greatest(clock_timestamp(), coalesce((v_old->>'updatedAt')::timestamptz + interval '1 millisecond', '-infinity'::timestamptz)) at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
        v_row := v_row || jsonb_build_object('updatedAt',v_stamp,'syncSeq',v_seq);
        insert into xiaobu_private.records(entity,id,payload,seq) values(v_entity,v_row->>'id',v_row,v_seq)
          on conflict (entity,id) do update set payload=excluded.payload,seq=excluded.seq;
      end loop;
    end loop;
  else raise exception '未知操作'; end if;
  update xiaobu_private.meta set seq=v_seq,reset_seq=v_reset where id=1;
  foreach v_entity in array v_entities loop
    select coalesce(jsonb_agg(payload order by seq),'[]'::jsonb) into v_rows from xiaobu_private.records where entity=v_entity and seq>greatest(p_since,0);
    v_tables := v_tables || jsonb_build_object(v_entity,v_rows);
  end loop;
  return jsonb_build_object('seq',v_seq,'resetSeq',v_reset,'tables',v_tables,'serverTime',clock_timestamp(),'ok',true);
end;
$$;
revoke all on function public.xiaobu_exchange(text,bigint,jsonb) from public, anon, authenticated;
grant execute on function public.xiaobu_exchange(text,bigint,jsonb) to service_role;

-- 与server/bank.mjs一致：北京时间、账户完整七天、余额/计息本金/余数分开。
-- p_input不接受客户端日期、余额、流水或利息结果。
create or replace function public.xiaobu_bank(
  p_child_id text, p_action text, p_request_id text,
  p_input jsonb default '{}'::jsonb, p_since bigint default 0
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_account jsonb;
  v_receipt text := 'bank-action:'||p_child_id||':'||p_request_id;
  v_today date := (clock_timestamp() at time zone 'Asia/Shanghai')::date;
  v_next date;
  v_enabled boolean;
  v_balance bigint;
  v_eligible bigint;
  v_remainder bigint;
  v_rate integer;
  v_configured integer;
  v_amount bigint;
  v_numerator numeric;
  v_interest bigint;
  v_entry_id text;
  v_result jsonb;
begin
  perform 1 from xiaobu_private.meta where id=1 for update;
  if p_child_id is null or not exists(select 1 from xiaobu_private.records where entity='childProfiles' and id=p_child_id and not coalesce((payload->>'deleted')::boolean,false)) then raise exception '请先建立孩子档案'; end if;
  if p_request_id is null or p_request_id !~ '^[a-zA-Z0-9_-]{1,100}$' then raise exception '银行请求编号无效，请重试'; end if;
  if p_action is null or p_action not in ('configure','deposit','withdraw','settle') then raise exception '未知银行操作'; end if;
  if p_since is null or p_since<0 or p_since>9007199254740991 then raise exception '同步水位线无效'; end if;
  if coalesce(jsonb_typeof(p_input),'')<>'object' then raise exception '银行参数无效'; end if;
  select payload into v_account from xiaobu_private.records where entity='bankAccounts' and id='bank:'||p_child_id;
  if v_account is null then
    v_account := jsonb_build_object('id','bank:'||p_child_id,'childId',p_child_id,'balance',0,'eligibleBalance',0,'remainder',0,'enabled',false,'weeklyRateBps',100,'configuredRateBps',100,'nextInterestDate',v_today+7);
  end if;
  -- 与本地同一请求编号重试仅返回当前账户，不重复结算/划转。
  if exists(select 1 from xiaobu_private.records where entity='bankEntries' and id=v_receipt) then
    return public.xiaobu_exchange('sync',p_since,'{}'::jsonb)||jsonb_build_object('account',v_account);
  end if;
  v_balance := (v_account->>'balance')::bigint;
  v_eligible := (v_account->>'eligibleBalance')::bigint;
  v_remainder := (v_account->>'remainder')::bigint;
  v_enabled := (v_account->>'enabled')::boolean;
  v_rate := (v_account->>'weeklyRateBps')::integer;
  v_configured := (v_account->>'configuredRateBps')::integer;
  v_next := (v_account->>'nextInterestDate')::date;
  if v_enabled and v_balance>0 then
    while v_next<=v_today loop
      v_numerator := v_eligible::numeric*v_rate+v_remainder;
      if v_numerator>9007199254740991 then raise exception '存款数额过大，请联系家长处理'; end if;
      v_interest := floor(v_numerator/10000)::bigint;
      v_remainder := mod(v_numerator,10000)::bigint;
      v_balance := v_balance+v_interest;
      v_entry_id := 'interest:'||p_child_id||':'||to_char(v_next,'YYYY-MM-DD');
      -- 所有账户更新与利息流水同事务写入；已有历史不能再次记息。
      if exists(select 1 from xiaobu_private.records where entity='bankEntries' and id=v_entry_id) then raise exception '周息流水与账户不一致，请核对历史记录'; end if;
      perform xiaobu_private.bank_save('bankEntries',jsonb_build_object('id',v_entry_id,'childId',p_child_id,'kind','interest','amount',v_interest,'date',to_char(v_next,'YYYY-MM-DD'),'rateBps',v_rate,'eligibleBalance',v_eligible));
      v_eligible := v_balance;
      v_rate := v_configured;
      v_next := v_next+7;
    end loop;
  end if;
  if p_action='configure' then
    if jsonb_typeof(p_input->'enabled') is distinct from 'boolean' or jsonb_typeof(p_input->'rateBps') is distinct from 'number' then raise exception '每周利率请填写0至20%%，最多两位小数'; end if;
    if (p_input->>'rateBps')::numeric<>trunc((p_input->>'rateBps')::numeric) or (p_input->>'rateBps')::numeric not between 0 and 2000 then raise exception '每周利率请填写0至20%%，最多两位小数'; end if;
    v_configured := (p_input->>'rateBps')::numeric::integer;
    if v_enabled is distinct from (p_input->>'enabled')::boolean then
      v_next := v_today+7; v_eligible := v_balance; v_rate := v_configured;
    end if;
    v_enabled := (p_input->>'enabled')::boolean;
    if v_balance=0 then v_rate := v_configured; end if;
  elsif p_action in ('deposit','withdraw') then
    if jsonb_typeof(p_input->'amount') is distinct from 'number' then raise exception '存取星数请填写1至1000000的整数'; end if;
    if (p_input->>'amount')::numeric<>trunc((p_input->>'amount')::numeric) or (p_input->>'amount')::numeric not between 1 and 1000000 then raise exception '存取星数请填写1至1000000的整数'; end if;
    v_amount := (p_input->>'amount')::numeric::bigint;
    if p_action='deposit' then
      if not v_enabled then raise exception '请家长先开启星星银行'; end if;
      if v_amount>xiaobu_private.wallet_available(p_child_id,null) then raise exception '可用星星不足，预留兑换或已经存入的星星不能重复存入'; end if;
      if v_balance=0 then v_next := v_today+7; v_eligible := v_amount; v_rate := v_configured; end if;
      v_balance := v_balance+v_amount;
    else
      if v_amount>v_balance then raise exception '存款不足，请减少取出星数'; end if;
      v_balance := v_balance-v_amount;
      v_eligible := least(v_eligible,v_balance);
    end if;
  end if;
  v_account := v_account||jsonb_build_object('balance',v_balance,'eligibleBalance',v_eligible,'remainder',v_remainder,'enabled',v_enabled,'weeklyRateBps',v_rate,'configuredRateBps',v_configured,'nextInterestDate',to_char(v_next,'YYYY-MM-DD'));
  if p_action<>'settle' then
    perform xiaobu_private.bank_save('bankEntries',jsonb_build_object('id',v_receipt,'childId',p_child_id,'kind',p_action,'amount',coalesce(v_amount,0),'date',to_char(v_today,'YYYY-MM-DD'),'rateBps',v_configured));
  end if;
  v_account := xiaobu_private.bank_save('bankAccounts',v_account);
  v_result := public.xiaobu_exchange('sync',p_since,'{}'::jsonb);
  return v_result||jsonb_build_object('account',v_account);
end;
$$;

-- 每个新增函数显式撤销PUBLIC默认EXECUTE；保持原service_role边界。
revoke all on function xiaobu_private.valid_claim(jsonb), xiaobu_private.achievement_bonus(jsonb), xiaobu_private.merge_collections(jsonb,jsonb), xiaobu_private.wallet_available(text,text), xiaobu_private.bank_save(text,jsonb) from public, anon, authenticated;
grant execute on function xiaobu_private.valid_claim(jsonb), xiaobu_private.achievement_bonus(jsonb), xiaobu_private.merge_collections(jsonb,jsonb), xiaobu_private.wallet_available(text,text), xiaobu_private.bank_save(text,jsonb) to service_role;
revoke all on function public.xiaobu_bank(text,text,text,jsonb,bigint) from public, anon, authenticated;
grant execute on function public.xiaobu_bank(text,text,text,jsonb,bigint) to service_role;
