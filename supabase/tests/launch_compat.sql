-- 仅在隔离验收库执行。前置：现有基础/冒险SQL -> 20261020 -> 20261021。
-- 整个脚本（包括meta水位、临时函数、测试数据）均在事务结束回滚；失败时应停止执行。
begin;
create function pg_temp.assert_launch(ok boolean, message text) returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'TEST: %',message; end if;
end;
$$;
create function pg_temp.reject_sync(entity text, p_row jsonb, pattern text) returns void language plpgsql as $$
begin
  begin
    perform public.xiaobu_exchange('sync',0,jsonb_build_object(entity,jsonb_build_array(p_row)));
  exception when others then
    if position(pattern in sqlerrm)>0 then return; end if;
    raise;
  end;
  raise exception 'TEST: 应拒绝同步 %',pattern;
end;
$$;
create function pg_temp.reject_bank(child text, action text, request text, input jsonb, pattern text) returns void language plpgsql as $$
begin
  begin
    perform public.xiaobu_bank(child,action,request,input,0);
  exception when others then
    if position(pattern in sqlerrm)>0 then return; end if;
    raise;
  end;
  raise exception 'TEST: 应拒绝银行操作 %',pattern;
end;
$$;

do $$
declare
  child text := 'verify-launch-'||gen_random_uuid()::text;
  other_child text := 'verify-other-'||gen_random_uuid()::text;
  stamp text := '2026-01-01T00:00:00.000Z';
  future text := '2099-01-01T00:00:00.000Z';
  today text := to_char(clock_timestamp() at time zone 'Asia/Shanghai','YYYY-MM-DD');
  profile jsonb;
  pact jsonb;
  plan jsonb;
  signatures jsonb;
  result jsonb;
  account jsonb;
  before_seq bigint;
  gift jsonb;
  interest_day text;
  sign text;
  slot integer;
begin
  perform pg_temp.assert_launch(not has_function_privilege('anon','public.xiaobu_bank(text,text,text,jsonb,bigint)','EXECUTE'),'匿名银行RPC权限');
  perform pg_temp.assert_launch(not has_function_privilege('authenticated','public.xiaobu_bank(text,text,text,jsonb,bigint)','EXECUTE'),'登录用户银行RPC权限');
  perform pg_temp.assert_launch(has_function_privilege('service_role','public.xiaobu_bank(text,text,text,jsonb,bigint)','EXECUTE'),'服务端银行RPC权限');
  perform pg_temp.assert_launch(not has_function_privilege('anon','xiaobu_private.bank_save(text,jsonb)','EXECUTE'),'内部写入器权限');
  perform pg_temp.assert_launch(not has_function_privilege('anon','public.xiaobu_exchange(text,bigint,jsonb)','EXECUTE'),'同步RPC权限');

  profile := jsonb_build_object('id',child,'name','测试孩子','updatedAt',stamp,'starClaims',jsonb_build_object('aries',stamp,'sky:aries:0',stamp,'sky:aries:1',stamp,'unknown',stamp,'sky:aries:2','bad'),'honorClaims',jsonb_build_object('honor:life:1',stamp));
  perform public.xiaobu_exchange('sync',0,jsonb_build_object('childProfiles',jsonb_build_array(profile,jsonb_build_object('id',other_child,'name','另一孩子','updatedAt',stamp))));
  perform pg_temp.assert_launch(xiaobu_private.achievement_bonus(profile->'starClaims')=4,'旧星与slot0去重且无效/未知键不计奖');
  perform pg_temp.assert_launch(xiaobu_private.wallet_available(child,null)=4,'星图奖励参与余额');
  foreach sign in array array['aries','taurus','gemini','cancer','leo','virgo','libra','scorpio','sagittarius','capricorn','aquarius','pisces'] loop
    for slot in 0..4 loop
      perform pg_temp.assert_launch(xiaobu_private.achievement_bonus(jsonb_build_object('sky:'||sign||':'||slot,stamp))=2,'60颗新版星标识');
    end loop;
  end loop;

  -- 过期设备新增收藏只合并收藏，不能还原姓名；后续省略/空值不能擦除收藏。
  perform public.xiaobu_exchange('sync',0,jsonb_build_object('childProfiles',jsonb_build_array(jsonb_build_object('id',child,'name','过期名字','updatedAt',stamp,'starClaims',jsonb_build_object('sky:taurus:2',stamp),'honorClaims',jsonb_build_object('honor:sport:1',stamp)))));
  select payload into profile from xiaobu_private.records where entity='childProfiles' and id=child;
  perform pg_temp.assert_launch(profile->>'name'='测试孩子' and profile->'starClaims' ? 'aries' and profile->'honorClaims' ? 'honor:sport:1','过期并集保留资料');
  perform public.xiaobu_exchange('sync',0,jsonb_build_object('childProfiles',jsonb_build_array(profile||jsonb_build_object('updatedAt',future,'starClaims',jsonb_build_object('aries',null),'honorClaims','{}'::jsonb))));
  select payload into profile from xiaobu_private.records where entity='childProfiles' and id=child;
  perform pg_temp.assert_launch(xiaobu_private.achievement_bonus(profile->'starClaims')=6 and profile->'honorClaims' ? 'honor:life:1','永久收藏不能清空');

  -- 旧打卡5星、新规则快照2星、重复同日同规则只取一次。
  perform public.xiaobu_exchange('sync',0,jsonb_build_object(
    'routineRules',jsonb_build_array(jsonb_build_object('id',child||'-rule','childId',child,'rewardStars',2,'minMinutes',5,'updatedAt',stamp)),
    'routineChecks',jsonb_build_array(
      jsonb_build_object('id',child||'-legacy','childId',child,'ruleId','legacy','date',today,'status','done','updatedAt',stamp),
      jsonb_build_object('id',child||'-check','childId',child,'ruleId',child||'-rule','date',today,'status','done','minutes',5,'updatedAt',stamp),
      jsonb_build_object('id',child||'-duplicate','childId',child,'ruleId',child||'-rule','date',today,'status','done','minutes',5,'updatedAt',stamp))));
  perform pg_temp.assert_launch(xiaobu_private.action_points(child,today)=7,'旧兼容/快照/打卡去重');
  perform pg_temp.reject_sync('routineChecks',jsonb_build_object('id',child||'-bad-minutes','childId',child,'ruleId',child||'-rule','status','done','minutes',4),'分钟');
  perform pg_temp.reject_sync('taskRecords',jsonb_build_object('id',child||'-bad-stars','rewardStars',99),'只能');

  -- 原公约全员签约后新增独立礼物，不改变公约、签名或计星来源。
  pact := jsonb_build_object('id',child||'-pact','childId',child,'title','共同成长','authorId',child||'-parent','clauses',jsonb_build_array(jsonb_build_object('memberId',child||'-parent','text','陪伴'),jsonb_build_object('memberId',child||'-member','text','认真打卡')),'sealed',true,'archived',false,'ruleIds',jsonb_build_array(child||'-rule'),'updatedAt',stamp);
  perform public.xiaobu_exchange('sync',0,jsonb_build_object(
    'familyMembers',jsonb_build_array(jsonb_build_object('id',child||'-parent','childId',child,'name','家长','role','parent','updatedAt',stamp),jsonb_build_object('id',child||'-member','childId',child,'name','孩子','role','child','updatedAt',stamp)),
    'growthPacts',jsonb_build_array(pact),
    'pactSignatures',jsonb_build_array(jsonb_build_object('id','signature:'||child||'-pact:'||child||'-parent','childId',child,'pactId',child||'-pact','memberId',child||'-parent','updatedAt',stamp),jsonb_build_object('id','signature:'||child||'-pact:'||child||'-member','childId',child,'pactId',child||'-pact','memberId',child||'-member','updatedAt',stamp))));
  select payload into pact from xiaobu_private.records where entity='growthPacts' and id=child||'-pact';
  select jsonb_agg(payload order by id) into signatures from xiaobu_private.records where entity='pactSignatures' and payload->>'childId'=child;
  gift := jsonb_build_object('id',child||'-gift','childId',child,'name','签约后新增礼物','picture','gift','cost',3,'status','requested','updatedAt',stamp);
  perform public.xiaobu_exchange('sync',0,jsonb_build_object('wishes',jsonb_build_array(gift)));
  perform pg_temp.assert_launch(xiaobu_private.wallet_available(child,null)=10,'奖励星与打卡合计13星，兑换预留3星');
  perform pg_temp.assert_launch((select payload=pact from xiaobu_private.records where entity='growthPacts' and id=pact->>'id'),'新增礼物不改公约');
  perform pg_temp.assert_launch((select jsonb_agg(payload order by id)=signatures from xiaobu_private.records where entity='pactSignatures' and payload->>'childId'=child),'新增礼物不改签名');
  perform pg_temp.reject_sync('growthPacts',pact||jsonb_build_object('ruleIds','[]'::jsonb,'updatedAt',future),'关联不能修改');
  perform pg_temp.reject_sync('growthPacts',pact||jsonb_build_object('replacesPactId',child||'-missing','updatedAt',future),'来源无效');
  plan := pact||jsonb_build_object('id',child||'-v2','replacesPactId',pact->>'id','updatedAt',stamp);
  perform public.xiaobu_exchange('sync',0,jsonb_build_object('growthPacts',jsonb_build_array(plan)));
  perform pg_temp.reject_sync('growthPacts',(plan-'replacesPactId')||jsonb_build_object('updatedAt',future),'关联不能修改');
  perform pg_temp.reject_sync('wishes',gift||jsonb_build_object('cost',2,'updatedAt',future),'不能修改');

  -- configure/deposit重复请求、预留互斥、另一孩子不能取款。
  result := public.xiaobu_bank(child,'configure','enable','{"enabled":true,"rateBps":1000}',0);
  result := public.xiaobu_bank(child,'deposit','deposit-once','{"amount":10}',0);
  account := result->'account';
  perform pg_temp.assert_launch((account->>'balance')::int=10 and result->'tables' ? 'bankAccounts' and result->'tables' ? 'bankEntries','银行响应含账户和同步表');
  select seq into before_seq from xiaobu_private.meta where id=1;
  result := public.xiaobu_bank(child,'deposit','deposit-once','{"amount":10}',0);
  perform pg_temp.assert_launch(result->'account'=account and (select seq=before_seq from xiaobu_private.meta where id=1),'重复操作不重复划转/递增水位');
  perform pg_temp.reject_bank(child,'deposit','over-deposit','{"amount":1}','不足');
  perform pg_temp.reject_bank(other_child,'withdraw','other','{"amount":1}','不足');
  perform pg_temp.reject_bank(child,'deposit','fraction','{"amount":1.5}','整数');
  perform pg_temp.reject_bank(child,'configure','rate','{"enabled":true,"rateBps":2001}','利率');
  perform pg_temp.reject_bank(child,'settle','bad/id','{}','编号');
  perform pg_temp.reject_sync('bankAccounts',jsonb_build_object('id','forged-bank','balance',999),'只能');
  perform pg_temp.reject_sync('bankEntries',jsonb_build_object('id','forged-entry','kind','withdraw','amount',999),'只能');
  perform public.xiaobu_exchange('sync',0,jsonb_build_object('bankAccounts',jsonb_build_array(account||jsonb_build_object('balance',999,'deleted',true,'updatedAt',future))));
  perform pg_temp.assert_launch((select payload=account from xiaobu_private.records where entity='bankAccounts' and id=account->>'id'),'重传账户不允许篡改/删除');
  select payload into result from xiaobu_private.records where entity='bankEntries' and id='bank-action:'||child||':deposit-once';
  perform public.xiaobu_exchange('sync',0,jsonb_build_object('bankEntries',jsonb_build_array(result||jsonb_build_object('amount',999,'kind','withdraw','deleted',true,'updatedAt',future))));
  perform pg_temp.assert_launch((select payload=result from xiaobu_private.records where entity='bankEntries' and id=result->>'id'),'重传流水不允许篡改/删除');
  perform pg_temp.reject_sync('wishes',gift||jsonb_build_object('id',child||'-over-gift','cost',1),'余额不足');

  -- 在此隔离测试事务中模拟到期：本金10，完整两周10%复利为12，余数1000。
  interest_day := to_char((today::date)-7,'YYYY-MM-DD');
  update xiaobu_private.records set payload=payload||jsonb_build_object('nextInterestDate',interest_day) where entity='bankAccounts' and id='bank:'||child;
  result := public.xiaobu_bank(child,'settle','settle-one','{}',0);
  account := result->'account';
  perform pg_temp.assert_launch((account->>'balance')::int=12 and (account->>'remainder')::int=1000,'七天复利及余数');
  perform pg_temp.assert_launch(xiaobu_private.wallet_available(child,null)=0,'利息未取出不可兑换');
  perform pg_temp.assert_launch((select count(*)=2 from xiaobu_private.records where entity='bankEntries' and payload->>'childId'=child and payload->>'kind'='interest'),'每周期唯一流水');
  result := public.xiaobu_bank(child,'settle','settle-two','{}',0);
  perform pg_temp.assert_launch(result->'account'->'balance'=account->'balance' and (select count(*)=2 from xiaobu_private.records where entity='bankEntries' and payload->>'childId'=child and payload->>'kind'='interest'),'重复结息不重复发放');
  result := public.xiaobu_bank(child,'configure','new-rate','{"enabled":true,"rateBps":2000}',0);
  perform pg_temp.assert_launch(result->'account'->>'weeklyRateBps'='1000' and result->'account'->>'configuredRateBps'='2000','新利率下一周期生效');
  result := public.xiaobu_bank(child,'withdraw','withdraw-all','{"amount":12}',0);
  perform pg_temp.assert_launch(result->'account'->>'balance'='0' and result->'account'->>'eligibleBalance'='0' and xiaobu_private.wallet_available(child,null)=12,'取款降低计息本金且返还钱包');
  perform public.xiaobu_bank(child,'withdraw','withdraw-all','{"amount":12}',0);
  perform pg_temp.assert_launch(xiaobu_private.wallet_available(child,null)=12,'重复取款不加星');
  perform public.xiaobu_exchange('sync',0,jsonb_build_object('wishes',jsonb_build_array(gift||jsonb_build_object('id',child||'-interest-gift','cost',12))));
  perform pg_temp.reject_sync('wishes',gift||jsonb_build_object('id',child||'-last-over-gift','cost',1),'余额不足');

  -- 原wishPlan校验和冒险奖励保护继续有效。
  plan := pact||jsonb_build_object('id',child||'-wish-pact','wishPlan',jsonb_build_object('wishId',child||'-gift','ruleIds',jsonb_build_array(child||'-rule'),'rewardName','签约后新增礼物','rewardCost',3),'updatedAt',stamp);
  perform public.xiaobu_exchange('sync',0,jsonb_build_object('growthPacts',jsonb_build_array(plan)));
  perform pg_temp.reject_sync('growthPacts',plan||jsonb_build_object('id',child||'-bad-plan','wishPlan',(plan->'wishPlan')||'{"rewardCost":4}'::jsonb),'确认心愿');
  result := public.xiaobu_adventure(child,today,'meadow')->'adventure';
  perform pg_temp.assert_launch(public.xiaobu_adventure(child,today,'forest')->'adventure'=result,'冒险重试不重复领奖');
  perform public.xiaobu_exchange('sync',0,jsonb_build_object('adventureRuns',jsonb_build_array(result||jsonb_build_object('bonusStars',999,'deleted',true,'updatedAt',future))));
  perform pg_temp.assert_launch((select payload=result from xiaobu_private.records where entity='adventureRuns' and id=result->>'id'),'冒险不可改写');
  perform pg_temp.reject_sync('adventureRuns',jsonb_build_object('id',child||'-forged-run'),'只能');
  raise notice 'PASS: launch compat, pact/gift, bank, rewards, retry, protections; transaction will roll back';
end;
$$;
rollback;
