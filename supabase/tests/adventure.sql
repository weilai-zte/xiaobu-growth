-- 所有测试数据在异常子事务中回滚，不会给真实孩子领奖或留下测试档案。
create or replace function pg_temp.verify_xiaobu_adventure() returns text
language plpgsql as $$
declare
  child text := 'verify-adventure-' || gen_random_uuid()::text;
  day text := to_char(clock_timestamp() at time zone 'Asia/Shanghai','YYYY-MM-DD');
  stamp text := to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  first jsonb;
  second jsonb;
  changes jsonb;
begin
  begin
    perform public.xiaobu_exchange('sync',0,jsonb_build_object('childProfiles',jsonb_build_array(jsonb_build_object('id',child,'name','测试档案','isPrimary',false,'updatedAt',stamp))));
    begin
      perform public.xiaobu_adventure(child,day,'meadow');
      raise exception 'TEST: 未达标不应领奖';
    exception when others then
      if position('15' in sqlerrm)=0 then raise; end if;
    end;
    select jsonb_build_object('routineChecks',jsonb_agg(jsonb_build_object('id',child||'-'||i,'childId',child,'ruleId','rule-'||i,'date',day,'status','done','updatedAt',stamp))) into changes from generate_series(1,3) i;
    perform public.xiaobu_exchange('sync',0,changes);
    first := public.xiaobu_adventure(child,day,'meadow')->'adventure';
    second := public.xiaobu_adventure(child,day,'forest')->'adventure';
    if first is distinct from second then raise exception 'TEST: 重试改变奖励'; end if;
    if (first->>'bonusStars')::int not in (2,3,5) then raise exception 'TEST: 非法奖励'; end if;
    perform public.xiaobu_exchange('sync',0,jsonb_build_object('adventureRuns',jsonb_build_array(first || '{"bonusStars":999,"updatedAt":"2099-01-01T00:00:00Z"}'::jsonb)));
    if (select (payload->>'bonusStars')::int from xiaobu_private.records where entity='adventureRuns' and id=first->>'id') <> (first->>'bonusStars')::int then raise exception 'TEST: 奖励被篡改'; end if;
    perform public.xiaobu_exchange('sync',0,jsonb_build_object('wishes',jsonb_build_array(jsonb_build_object('id',child||'-wish','childId',child,'name','测试兑换','picture','book','status','requested','cost',15+(first->>'bonusStars')::int,'updatedAt',stamp))));
    if not exists(select 1 from xiaobu_private.records where entity='wishes' and id=child||'-wish') then raise exception 'TEST: 奖励未计入余额'; end if;
    if has_function_privilege('anon','public.xiaobu_adventure(text,text,text)','EXECUTE') then raise exception 'TEST: 匿名可直接调用'; end if;
    raise exception using errcode='ZX001',message='验证完成，回滚测试记录';
  exception when sqlstate 'ZX001' then null;
  end;
  if exists(select 1 from xiaobu_private.records where id like child||'%') then raise exception 'TEST: 测试数据未回滚'; end if;
  return 'PASS: threshold, immutable reward, retry idempotence, bonus redemption, private access, rollback';
end;
$$;
select pg_temp.verify_xiaobu_adventure() as verification;
