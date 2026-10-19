-- 临时档案与奖记录均在异常子事务里回滚，不改变真实儿童的积分或成长。
create or replace function pg_temp.verify_habit_stars() returns text language plpgsql as $$
declare
  child text := 'verify-habits-' || gen_random_uuid()::text;
  day text := to_char(clock_timestamp() at time zone 'Asia/Shanghai','YYYY-MM-DD');
  yesterday text := to_char((clock_timestamp() at time zone 'Asia/Shanghai') - interval '1 day','YYYY-MM-DD');
  stamp text := to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  first jsonb;
  changes jsonb;
begin
  begin
    perform public.xiaobu_exchange('sync',0,jsonb_build_object('childProfiles',jsonb_build_array(jsonb_build_object('id',child,'name','测试档案','updatedAt',stamp))));
    select jsonb_build_object('routineRules',jsonb_agg(jsonb_build_object('id',child||'-rule-'||i,'childId',child,'title','测试图卡','rewardStars',case when i=4 then 2 else 1 end,'minMinutes',case when i=4 then 5 else null end,'updatedAt',stamp))) into changes from generate_series(1,4) i;
    perform public.xiaobu_exchange('sync',0,changes);
    perform public.xiaobu_exchange('sync',0,jsonb_build_object('routineChecks',jsonb_build_array(jsonb_build_object('id',child||'-old','childId',child,'ruleId','old','date',yesterday,'status','done','updatedAt',stamp))));
    select jsonb_build_object('routineChecks',jsonb_agg(jsonb_build_object('id',child||'-check-'||i,'childId',child,'ruleId',child||'-rule-'||i,'date',day,'status','done','rewardStars',1,'updatedAt',stamp))) into changes from generate_series(1,3) i;
    perform public.xiaobu_exchange('sync',0,changes);
    if xiaobu_private.action_points(child,day) <> 3 or xiaobu_private.action_points(child,null) <> 8 then raise exception 'TEST: 新旧星数不一致'; end if;
    begin
      perform public.xiaobu_adventure(child,day,'meadow');
      raise exception 'TEST: 3星不应冒险';
    exception when others then if position('5' in sqlerrm)=0 then raise; end if; end;
    begin
      perform public.xiaobu_exchange('sync',0,jsonb_build_object('routineChecks',jsonb_build_array(jsonb_build_object('id',child||'-rope','childId',child,'ruleId',child||'-rule-4','date',day,'status','done','rewardStars',2,'minutes',4,'updatedAt',stamp))));
      raise exception 'TEST: 运动不足不应完成';
    exception when others then if position('分钟' in sqlerrm)=0 then raise; end if; end;
    perform public.xiaobu_exchange('sync',0,jsonb_build_object('routineChecks',jsonb_build_array(jsonb_build_object('id',child||'-rope','childId',child,'ruleId',child||'-rule-4','date',day,'status','done','rewardStars',2,'minutes',5,'updatedAt',stamp))));
    if xiaobu_private.action_points(child,day) <> 5 then raise exception 'TEST: 生活运动未按1/2星累加'; end if;
    first := public.xiaobu_adventure(child,day,'meadow')->'adventure';
    if public.xiaobu_adventure(child,day,'forest')->'adventure' is distinct from first then raise exception 'TEST: 重复领奖'; end if;
    perform public.xiaobu_exchange('sync',0,jsonb_build_object('wishes',jsonb_build_array(jsonb_build_object('id',child||'-wish','childId',child,'name','测试礼物','picture','book','status','requested','cost',10+(first->>'bonusStars')::int,'updatedAt',stamp))));
    begin
      perform public.xiaobu_exchange('sync',0,jsonb_build_object('taskRecords',jsonb_build_array(jsonb_build_object('id',child||'-invalid','childId',child,'rewardStars',99,'updatedAt',stamp))));
      raise exception 'TEST: 非法积分被接受';
    exception when others then if position('只能' in sqlerrm)=0 then raise; end if; end;
    raise exception using errcode='ZX002',message='验证完成，回滚';
  exception when sqlstate 'ZX002' then null;
  end;
  if exists(select 1 from xiaobu_private.records where id like child||'%') then raise exception 'TEST: 测试记录未清理'; end if;
  return 'PASS: legacy5, life1, sport2, duration, threshold5, one reward, redemption, invalid points, rollback';
end;
$$;
select pg_temp.verify_habit_stars() as verification;
