-- P0家庭成长；只准备迁移文件，尚未应用至线上。
-- 新家庭记录复用私有 records；不开放表、不新增公共访问权限。
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

-- 旧记录缺少rewardStars时仍按5星；新记录保存1/2星快照，规则改动不重算历史。
create or replace function xiaobu_private.action_points(p_child text, p_day text default null)
returns bigint language sql stable security invoker set search_path = '' as $$
  select coalesce(sum(stars),0)::bigint from (
    select case when entity='taskRecords' then 'task:'||(payload->>'date')||':'||coalesce(nullif(payload->>'templateId',''),payload->>'name')
      else 'rule:'||(payload->>'date')||':'||(payload->>'ruleId') end as action,
      max(case when payload->>'rewardStars' in ('1','2') then (payload->>'rewardStars')::int else 5 end) as stars
    from xiaobu_private.records where payload->>'childId'=p_child and (p_day is null or payload->>'date'=p_day)
      and not coalesce((payload->>'deleted')::boolean,false)
      and ((entity='taskRecords' and payload->>'completion'='independent') or (entity='routineChecks' and payload->>'status'='done'))
    group by 1
  ) actions;
$$;
revoke all on function xiaobu_private.action_points(text,text) from public, anon, authenticated;
grant execute on function xiaobu_private.action_points(text,text) to service_role;

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
  v_entities text[] := array['childProfiles','dailyLogs','taskTemplates','taskRecords','routineRules','routineChecks','conflictLogs','strengthMoments','weeklyReviews','experiments','wishes','adventureRuns','familyMembers','growthPacts','pactSignatures','familyChecks','familyReactions'];
begin
  -- 同一事务内串行写入和余额校验，保证手机和电脑不会超额兑换。
  select seq, reset_seq into v_seq, v_reset from xiaobu_private.meta where id=1 for update;
  if p_action = 'clear' then
    delete from xiaobu_private.records;
    v_seq := v_seq + 1; v_reset := v_seq;
  elsif p_action = 'sync' then
    if jsonb_typeof(p_changes) <> 'object' then raise exception '同步内容格式不正确'; end if;
    for v_entity, v_rows in select key,value from jsonb_each(p_changes) order by case key when 'childProfiles' then 0 when 'routineRules' then 1 when 'familyMembers' then 2 when 'wishes' then 4 when 'growthPacts' then 5 when 'pactSignatures' then 6 when 'familyChecks' then 7 when 'familyReactions' then 8 else 3 end loop
      if not (v_entity = any(v_entities)) or jsonb_typeof(v_rows) <> 'array' then raise exception '同步表名或格式不正确'; end if;
      for v_row in select value from jsonb_array_elements(v_rows) loop
        if jsonb_typeof(v_row->'id') <> 'string' or coalesce(v_row->>'id','') = '' then raise exception '记录缺少 ID'; end if;
        select payload into v_old from xiaobu_private.records where entity=v_entity and id=v_row->>'id';
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
        if v_entity = 'wishes' and not coalesce((v_row->>'deleted')::boolean,false) then
          if v_old->>'status' = 'redeemed' then continue; end if;
          if coalesce(length(trim(v_row->>'name')),0) not between 1 and 80 or coalesce(v_row->>'childId','')='' or
            coalesce(v_row->>'status','') not in ('proposed','approved','requested','redeemed') then raise exception '心愿内容无效'; end if;
          if v_row->>'status' <> 'proposed' and (coalesce(v_row->>'cost','') !~ '^[1-9][0-9]{0,8}$') then raise exception '兑换星数需要是正整数'; end if;
          if v_row->>'status' in ('requested','redeemed') then
            v_earned := xiaobu_private.action_points(v_row->>'childId',null);
            select v_earned + coalesce(sum((payload->>'bonusStars')::bigint),0) into v_earned
              from xiaobu_private.records where entity='adventureRuns' and payload->>'childId'=v_row->>'childId'
              and not coalesce((payload->>'deleted')::boolean,false);
            select coalesce(sum((payload->>'cost')::bigint),0) into v_committed from xiaobu_private.records
              where entity='wishes' and id<>v_row->>'id' and payload->>'childId'=v_row->>'childId'
              and payload->>'status' in ('requested','redeemed') and not coalesce((payload->>'deleted')::boolean,false);
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
