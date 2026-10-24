-- 隔离验收：F2 档案单调合并（buddyCare / honorsSeenAt）+ F3 逐条冲突隔离。
--
-- 前置（隔离库内按顺序执行）：
--   supabase/migrations/20261019_family_sync.sql
--   supabase/migrations/20261020_family_growth.sql
--   supabase/migrations/20261021_launch_compat.sql
--   supabase/patches/sync-conflict-repair.sql
--
-- 本脚本整体在一个事务里执行，末尾回滚：不写入真实家庭数据，不改动云端。
-- 任何断言失败都会抛错并终止本脚本。
--
-- 与旧夹具的差异：F3 要求“按条拒绝”，所以业务校验失败不再整批抛错，
-- 而是出现在返回值的 rejected 里；旧夹具（habit_stars.sql / launch_compat.sql）
-- 仍按旧口径断言整批异常，需要由主 Agent 另行更新。

begin;

create function pg_temp.assert_sync_repair(ok boolean, message text) returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'TEST: %',message; end if;
end;
$$;

-- 便捷读取：服务端当前存档
create function pg_temp.stored_row(p_entity text, p_id text) returns jsonb language plpgsql as $$
declare
  v_payload jsonb;
begin
  select payload into v_payload from xiaobu_private.records where entity=p_entity and id=p_id;
  return v_payload;
end;
$$;

-- 便捷读取：当前同步序号
create function pg_temp.current_seq() returns bigint language plpgsql as $$
declare
  v_seq bigint;
begin
  select seq into v_seq from xiaobu_private.meta where id=1;
  return v_seq;
end;
$$;

do $$
declare
  child text := 'verify-sync-'||gen_random_uuid()::text;
  wish_id text;
  stamp text := '2026-10-24T00:00:00.000Z';
  stale_stamp text := '2026-10-23T00:00:00.000Z';
  future text := '2099-01-01T00:00:00.000Z';
  profile jsonb;
  care jsonb;
  result jsonb;
  rejected jsonb;
  seq_a bigint;
  seq_b bigint;
begin
  -- 权限边界：只服务角色可用，匿名与登录用户都拿不到。
  perform pg_temp.assert_sync_repair(not has_function_privilege('anon','public.xiaobu_exchange(text,bigint,jsonb)','EXECUTE'),'匿名同步RPC权限');
  perform pg_temp.assert_sync_repair(not has_function_privilege('authenticated','public.xiaobu_exchange(text,bigint,jsonb)','EXECUTE'),'登录用户同步RPC权限');
  perform pg_temp.assert_sync_repair(has_function_privilege('service_role','public.xiaobu_exchange(text,bigint,jsonb)','EXECUTE'),'服务端同步RPC权限');
  perform pg_temp.assert_sync_repair(not has_function_privilege('anon','xiaobu_private.merge_profile(jsonb,jsonb)','EXECUTE'),'匿名档案合并权限');
  perform pg_temp.assert_sync_repair(not has_function_privilege('authenticated','xiaobu_private.merge_buddy_care(jsonb,jsonb,boolean)','EXECUTE'),'登录用户照料合并权限');
  perform pg_temp.assert_sync_repair(not has_function_privilege('anon','xiaobu_private.merge_buddy_care(jsonb,jsonb,boolean)','EXECUTE'),'匿名照料合并权限');

  ------------------------------------------------------------------
  -- F2-1 同日不同动作：并集去重，亲密值按并集补齐且不重复累加。
  ------------------------------------------------------------------
  profile := jsonb_build_object(
    'id',child,'name','测试孩子','updatedAt',stamp,
    'buddyCare',jsonb_build_object('date','2026-10-24','completed',jsonb_build_array('feed'),'xp',1,'sleepingSince',null)
  );
  perform public.xiaobu_exchange('sync',0,jsonb_build_object('childProfiles',jsonb_build_array(profile)));
  care := pg_temp.stored_row('childProfiles',child)->'buddyCare';
  perform pg_temp.assert_sync_repair(care->>'date'='2026-10-24' and care->'completed'='["feed"]'::jsonb and (care->>'xp')::int=1,'首次照料入库');

  -- 第二台设备：同日补一个新动作
  perform public.xiaobu_exchange('sync',0,jsonb_build_object('childProfiles',jsonb_build_array(
    jsonb_build_object('id',child,'name','测试孩子','updatedAt',future,
      'buddyCare',jsonb_build_object('date','2026-10-24','completed',jsonb_build_array('play'),'xp',1,'sleepingSince',null))
  )));
  care := pg_temp.stored_row('childProfiles',child)->'buddyCare';
  perform pg_temp.assert_sync_repair(care->'completed'='["feed","play"]'::jsonb,'同日动作取并集');
  perform pg_temp.assert_sync_repair((care->>'xp')::int=2,'并集后亲密值只按新动作补一次');

  -- 同日重复照料：再传一次同样的动作，亲密值不增加
  seq_a := pg_temp.current_seq();
  perform public.xiaobu_exchange('sync',0,jsonb_build_object('childProfiles',jsonb_build_array(
    jsonb_build_object('id',child,'name','测试孩子','updatedAt',future,
      'buddyCare',jsonb_build_object('date','2026-10-24','completed',jsonb_build_array('feed','play'),'xp',2,'sleepingSince',null))
  )));
  care := pg_temp.stored_row('childProfiles',child)->'buddyCare';
  perform pg_temp.assert_sync_repair((care->>'xp')::int=2,'同日重复照料不重复加亲密值');
  perform pg_temp.assert_sync_repair(pg_temp.current_seq()=seq_a,'内容无变化不提升同步序号');

  -- 内容完全相同的重传（同一份档案再传一次）同样不提升序号
  perform public.xiaobu_exchange('sync',0,jsonb_build_object('childProfiles',jsonb_build_array(profile)));
  perform pg_temp.assert_sync_repair(pg_temp.current_seq()=seq_a,'重复上传不提升同步序号');

  ------------------------------------------------------------------
  -- F2-2 跨日：较晚日期的当日状态生效，亲密值只取较大值，不凭空累加。
  ------------------------------------------------------------------
  perform public.xiaobu_exchange('sync',0,jsonb_build_object('childProfiles',jsonb_build_array(
    jsonb_build_object('id',child,'name','测试孩子','updatedAt',future,
      'buddyCare',jsonb_build_object('date','2026-10-25','completed',jsonb_build_array('groom'),'xp',1,'sleepingSince','2026-10-25T12:00:00.000Z'))
  )));
  care := pg_temp.stored_row('childProfiles',child)->'buddyCare';
  perform pg_temp.assert_sync_repair(care->>'date'='2026-10-25','跨日取较晚日期');
  perform pg_temp.assert_sync_repair(care->'completed'='["groom"]'::jsonb,'跨日不并集旧日期动作');
  perform pg_temp.assert_sync_repair((care->>'xp')::int=2,'跨日亲密值只取较大值');
  perform pg_temp.assert_sync_repair(care->>'sleepingSince'='2026-10-25T12:00:00.000Z','跨日入睡状态取较晚日期');

  ------------------------------------------------------------------
  -- F2-3 版本落后也要合并：旧设备带来的新动作要落库，其他档案字段保留当前版本。
  ------------------------------------------------------------------
  perform public.xiaobu_exchange('sync',0,jsonb_build_object('childProfiles',jsonb_build_array(
    jsonb_build_object('id',child,'name','当前名字','updatedAt',future,
      'buddyCare',jsonb_build_object('date','2026-10-25','completed',jsonb_build_array('groom'),'xp',2,'sleepingSince',null),
      'honorsSeenAt','2026-10-25T00:00:00.000Z')
  )));
  seq_a := pg_temp.current_seq();
  perform public.xiaobu_exchange('sync',0,jsonb_build_object('childProfiles',jsonb_build_array(
    jsonb_build_object('id',child,'name','过期名字','updatedAt',stale_stamp,
      'buddyCare',jsonb_build_object('date','2026-10-25','completed',jsonb_build_array('groom','sleep'),'xp',3,'sleepingSince',null),
      'honorsSeenAt','2026-10-26T00:00:00.000Z')
  )));
  profile := pg_temp.stored_row('childProfiles',child);
  care := profile->'buddyCare';
  perform pg_temp.assert_sync_repair(profile->>'name'='当前名字','版本落后不改写当前档案字段');
  perform pg_temp.assert_sync_repair(care->'completed'='["groom","sleep"]'::jsonb,'版本落后的新动作也要并入');
  perform pg_temp.assert_sync_repair((care->>'xp')::int=3,'版本落后的新动作补一次亲密值');
  perform pg_temp.assert_sync_repair(profile->>'honorsSeenAt'='2026-10-26T00:00:00.000Z','已读进度取较晚的有效时间');
  perform pg_temp.assert_sync_repair(pg_temp.current_seq()>seq_a,'单调字段变化要发布新版本');

  -- 无效已读时间不覆盖已有有效值
  perform public.xiaobu_exchange('sync',0,jsonb_build_object('childProfiles',jsonb_build_array(
    jsonb_build_object('id',child,'name','当前名字','updatedAt',stale_stamp,'honorsSeenAt','不是时间')
  )));
  perform pg_temp.assert_sync_repair(pg_temp.stored_row('childProfiles',child)->>'honorsSeenAt'='2026-10-26T00:00:00.000Z','无效时间不覆盖有效已读进度');

  -- 版本落后但没有单调变化：档案保持不变，也不提升序号
  seq_a := pg_temp.current_seq();
  perform public.xiaobu_exchange('sync',0,jsonb_build_object('childProfiles',jsonb_build_array(
    jsonb_build_object('id',child,'name','过期名字','updatedAt',stale_stamp)
  )));
  perform pg_temp.assert_sync_repair(pg_temp.stored_row('childProfiles',child)->>'name'='当前名字','版本落后不改名');
  perform pg_temp.assert_sync_repair(pg_temp.current_seq()=seq_a,'版本落后且无单调变化不提升序号');

  ------------------------------------------------------------------
  -- F3-1 兑换余额冲突按条拒绝，其余合法记录照常写入。
  ------------------------------------------------------------------
  wish_id := child||'-wish';
  perform public.xiaobu_exchange('sync',0,jsonb_build_object('wishes',jsonb_build_array(
    jsonb_build_object('id',wish_id,'childId',child,'name','测试礼物','picture','book','status','approved','cost',5,'updatedAt',stamp)
  )));
  perform pg_temp.assert_sync_repair(pg_temp.stored_row('wishes',wish_id) is not null,'心愿已入库');

  result := public.xiaobu_exchange('sync',0,jsonb_build_object(
    'taskRecords',jsonb_build_array(jsonb_build_object('id',child||'-task','childId',child,'date','2026-10-24','name','读书','completion','independent','rewardStars',1,'updatedAt',stamp)),
    'wishes',jsonb_build_array(jsonb_build_object('id',wish_id,'childId',child,'name','测试礼物','picture','book','status','requested','cost',5,'updatedAt',future))
  ));
  rejected := coalesce(result->'rejected','[]'::jsonb);
  perform pg_temp.assert_sync_repair(jsonb_array_length(rejected)=1,'只拒绝冲突的那一条');
  perform pg_temp.assert_sync_repair(rejected->0->>'entity'='wishes' and rejected->0->>'id'=wish_id,'拒绝项带实体与记录号');
  perform pg_temp.assert_sync_repair(rejected->0->>'code'='WISH_CONFLICT','余额不足标WISH_CONFLICT');
  perform pg_temp.assert_sync_repair(coalesce(rejected->0->>'error','')<>'','拒绝项带可读错误');
  perform pg_temp.assert_sync_repair(rejected->0->'canonical'->>'status'='approved','拒绝项带回服务端权威记录');
  perform pg_temp.assert_sync_repair(rejected->0->'canonical'->>'cost'='5','权威记录保持服务端金额');
  perform pg_temp.assert_sync_repair(pg_temp.stored_row('taskRecords',child||'-task') is not null,'同批合法打卡不受影响');
  perform pg_temp.assert_sync_repair(pg_temp.stored_row('wishes',wish_id)->>'status'='approved','冲突心愿未被改写');

  -- 重传幂等：同样冲突再传一次，仍然只拒绝、不写入
  seq_a := pg_temp.current_seq();
  result := public.xiaobu_exchange('sync',0,jsonb_build_object('wishes',jsonb_build_array(
    jsonb_build_object('id',wish_id,'childId',child,'name','测试礼物','picture','book','status','requested','cost',5,'updatedAt',future)
  )));
  rejected := coalesce(result->'rejected','[]'::jsonb);
  perform pg_temp.assert_sync_repair(jsonb_array_length(rejected)=1 and rejected->0->>'code'='WISH_CONFLICT','冲突重传仍按条拒绝');
  perform pg_temp.assert_sync_repair(pg_temp.current_seq()=seq_a,'冲突重传不写入也不提升序号');

  ------------------------------------------------------------------
  -- F3-2 非法记录按条拒绝，不阻塞同批其他记录。
  ------------------------------------------------------------------
  result := public.xiaobu_exchange('sync',0,jsonb_build_object(
    'taskRecords',jsonb_build_array(
      jsonb_build_object('id',child||'-bad','childId',child,'date','2026-10-24','name','跑步','completion','independent','rewardStars',99,'updatedAt',stamp),
      jsonb_build_object('id',child||'-good','childId',child,'date','2026-10-24','name','画画','completion','independent','rewardStars',1,'updatedAt',stamp)
    )
  ));
  rejected := coalesce(result->'rejected','[]'::jsonb);
  perform pg_temp.assert_sync_repair(jsonb_array_length(rejected)=1,'非法记录只拒绝自己');
  perform pg_temp.assert_sync_repair(rejected->0->>'code'='INVALID_RECORD' and rejected->0->>'id'=child||'-bad','非法记录标INVALID_RECORD');
  perform pg_temp.assert_sync_repair(rejected->0->'canonical' is null or rejected->0->'canonical'='null'::jsonb,'没有服务端记录时权威记录为null');
  perform pg_temp.assert_sync_repair(pg_temp.stored_row('taskRecords',child||'-good') is not null,'同批合法打卡照常写入');
  perform pg_temp.assert_sync_repair(pg_temp.stored_row('taskRecords',child||'-bad') is null,'非法记录没有落库');

  -- 缺少记录号的记录同样按条拒绝
  result := public.xiaobu_exchange('sync',0,jsonb_build_object('taskRecords',jsonb_build_array(jsonb_build_object('childId',child,'name','缺号'))));
  rejected := coalesce(result->'rejected','[]'::jsonb);
  perform pg_temp.assert_sync_repair(jsonb_array_length(rejected)=1 and rejected->0->>'code'='INVALID_RECORD','缺号记录按条拒绝');

  ------------------------------------------------------------------
  -- F3-3 请求级问题仍然整批失败：这不是单条记录的问题。
  ------------------------------------------------------------------
  begin
    perform public.xiaobu_exchange('sync',0,'[]'::jsonb);
    raise exception 'TEST: 同步内容格式不正确应当整批失败';
  exception when others then
    if position('格式不正确' in sqlerrm)=0 then raise; end if;
  end;

  -- 服务端专管记录仍然只能由服务端接口生成
  result := public.xiaobu_exchange('sync',0,jsonb_build_object('bankAccounts',jsonb_build_array(jsonb_build_object('id','forged-bank','balance',999))));
  rejected := coalesce(result->'rejected','[]'::jsonb);
  perform pg_temp.assert_sync_repair(jsonb_array_length(rejected)=1 and rejected->0->>'code'='INVALID_RECORD','伪造银行记录被拒绝');
  perform pg_temp.assert_sync_repair(pg_temp.stored_row('bankAccounts','forged-bank') is null,'伪造银行记录没有落库');

  result := public.xiaobu_exchange('sync',0,jsonb_build_object('adventureRuns',jsonb_build_array(jsonb_build_object('id','forged-run'))));
  rejected := coalesce(result->'rejected','[]'::jsonb);
  perform pg_temp.assert_sync_repair(jsonb_array_length(rejected)=1 and rejected->0->>'code'='INVALID_RECORD','伪造冒险记录被拒绝');

  -- 拒绝项形状固定：entity/id/code/error/canonical
  rejected := coalesce(result->'rejected','[]'::jsonb);
  perform pg_temp.assert_sync_repair(rejected->0 ? 'entity' and rejected->0 ? 'id' and rejected->0 ? 'code' and rejected->0 ? 'error' and rejected->0 ? 'canonical','拒绝项形状固定');

  perform pg_temp.assert_sync_repair(not has_function_privilege('anon','public.xiaobu_exchange(text,bigint,jsonb)','execute'),'anon没有同步执行权限');
  perform pg_temp.assert_sync_repair(not has_function_privilege('authenticated','public.xiaobu_exchange(text,bigint,jsonb)','execute'),'authenticated没有同步执行权限');
  perform pg_temp.assert_sync_repair(has_function_privilege('service_role','public.xiaobu_exchange(text,bigint,jsonb)','execute'),'service_role保留同步执行权限');

  -- A prior failed upload may already have advanced p_since beyond this row.
  profile := pg_temp.stored_row('childProfiles',child);
  result := public.xiaobu_exchange('sync',pg_temp.current_seq(),jsonb_build_object('childProfiles',jsonb_build_array(profile)));
  perform pg_temp.assert_sync_repair(exists(select 1 from jsonb_array_elements(result->'tables'->'childProfiles') r where r->>'id'=child),'重试仍返回被确认记录的权威版本，不受水位过滤');

  raise notice 'PASS: F2 buddyCare/honorsSeenAt 合并与 F3 逐条拒绝；事务将回滚';
end;
$$;

rollback;
