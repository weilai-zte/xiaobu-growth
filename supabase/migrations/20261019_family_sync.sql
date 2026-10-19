-- 仅一个家庭；表不向浏览器开放，由验证家庭连接码的 Edge Function 访问。
create schema if not exists xiaobu_private;
revoke all on schema xiaobu_private from public, anon, authenticated;
grant usage on schema xiaobu_private to service_role;

create table xiaobu_private.records (
  entity text not null,
  id text not null,
  payload jsonb not null,
  seq bigint not null,
  primary key (entity, id)
);
create index xiaobu_records_seq on xiaobu_private.records(seq);
create table xiaobu_private.meta (
  id integer primary key check (id = 1),
  seq bigint not null default 0,
  reset_seq bigint not null default 0
);
insert into xiaobu_private.meta(id) values (1);
alter table xiaobu_private.records enable row level security;
alter table xiaobu_private.meta enable row level security;
grant all on xiaobu_private.records, xiaobu_private.meta to service_role;

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
  v_tables jsonb := '{}'::jsonb;
  v_earned bigint;
  v_committed bigint;
  v_entities text[] := array['childProfiles','dailyLogs','taskTemplates','taskRecords','routineRules','routineChecks','conflictLogs','strengthMoments','weeklyReviews','experiments','wishes'];
begin
  -- 同一事务内串行写入和余额校验，保证手机和电脑不会超额兑换。
  select seq, reset_seq into v_seq, v_reset from xiaobu_private.meta where id=1 for update;
  if p_action = 'clear' then
    delete from xiaobu_private.records;
    v_seq := v_seq + 1; v_reset := v_seq;
  elsif p_action = 'sync' then
    if jsonb_typeof(p_changes) <> 'object' then raise exception '同步内容格式不正确'; end if;
    for v_entity, v_rows in select key,value from jsonb_each(p_changes) order by (key='wishes') loop
      if not (v_entity = any(v_entities)) or jsonb_typeof(v_rows) <> 'array' then raise exception '同步表名或格式不正确'; end if;
      for v_row in select value from jsonb_array_elements(v_rows) loop
        if jsonb_typeof(v_row->'id') <> 'string' or coalesce(v_row->>'id','') = '' then raise exception '记录缺少 ID'; end if;
        select payload into v_old from xiaobu_private.records where entity=v_entity and id=v_row->>'id';
        if v_old is not null and coalesce(v_row->>'updatedAt','') <= coalesce(v_old->>'updatedAt','') then continue; end if;
        if v_entity = 'wishes' and not coalesce((v_row->>'deleted')::boolean,false) then
          if v_old->>'status' = 'redeemed' then continue; end if;
          if coalesce(length(trim(v_row->>'name')),0) not between 1 and 80 or coalesce(v_row->>'childId','')='' or
            coalesce(v_row->>'status','') not in ('proposed','approved','requested','redeemed') then raise exception '心愿内容无效'; end if;
          if v_row->>'status' <> 'proposed' and (coalesce(v_row->>'cost','') !~ '^[1-9][0-9]{0,8}$') then raise exception '兑换星数需要是正整数'; end if;
          if v_row->>'status' in ('requested','redeemed') then
            select count(*) * 5 into v_earned from (
              select distinct case when entity='taskRecords' then 'task:' || (payload->>'date') || ':' || coalesce(nullif(payload->>'templateId',''),payload->>'name')
                else 'rule:' || (payload->>'date') || ':' || (payload->>'ruleId') end as action
              from xiaobu_private.records where payload->>'childId'=v_row->>'childId' and not coalesce((payload->>'deleted')::boolean,false)
                and ((entity='taskRecords' and payload->>'completion'='independent') or (entity='routineChecks' and payload->>'status'='done'))
            ) actions;
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
