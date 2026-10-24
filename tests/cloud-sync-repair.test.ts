/** Execute the actual Edge handler; SQL behavior is tested by the PostgreSQL fixture. */
import {expect,it,vi} from 'vitest'
import {readFileSync} from 'node:fs'
import {createHash,webcrypto} from 'node:crypto'
import {runInNewContext} from 'node:vm'
import ts from 'typescript'
it('云端Edge原样传递逐条拒绝和权威记录，保留合法同步表与水位',async()=>{
 const key='fixture-only-repair-family-key',hash=createHash('sha256').update(key).digest('hex')
 const rejected=[{entity:'wishes',id:'w',code:'WISH_CONFLICT',error:'余额不足',canonical:{id:'w',childId:'c',name:'书',cost:5,status:'approved'}}]
 const payload={seq:7,resetSeq:0,tables:{taskRecords:[{id:'good'}]},rejected}
 const rpc=vi.fn(async()=>new Response(JSON.stringify(payload),{status:200}))
 const exports:{handle?:(req:Request)=>Promise<Response>}={}
 const source=ts.transpileModule(readFileSync('supabase/functions/xiaobu-sync/index.ts','utf8').replace('__FAMILY_KEY_SHA256__',hash),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText
 runInNewContext(source,{exports,Request,Response,URL,TextEncoder,Uint8Array,crypto:webcrypto,fetch:rpc,Deno:{serve:vi.fn(),env:{get:(n:string)=>({SUPABASE_URL:'https://fixture.invalid',SUPABASE_SERVICE_ROLE_KEY:'fixture-secret'})[n]}}})
 const call=()=>exports.handle!(new Request('https://fixture.invalid/functions/v1/xiaobu-sync/sync',{method:'POST',headers:{'x-family-key':key,origin:'https://weilai-zte.github.io'},body:JSON.stringify({since:2,changes:{wishes:[{id:'w',status:'requested'}]}})}))
 const response=await call();expect(response.status).toBe(200);expect(await response.json()).toEqual(payload)
 expect(rpc.mock.calls).toHaveLength(1)
 rpc.mockImplementationOnce(async()=>new Response('{"message":"storage unavailable"}',{status:500}))
 expect((await call()).status).toBe(400)
})
