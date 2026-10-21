import { describe, expect, it } from 'vitest'
import { bankChange, bankWalletDelta, newBankAccount, settleBank } from '../server/bank.mjs'
const open = () => bankChange(newBankAccount('c','2026-10-20'),'configure',{enabled:true,rateBps:1000},100,'2026-10-20').account
const deposit = () => bankChange(open(),'deposit',{amount:10},100,'2026-10-20').account
describe('每周星星银行',()=>{
 it('满七天结息，重复结算不重发，断线后补齐完整周',()=>{
  expect(settleBank(deposit(),'2026-10-26').entries).toHaveLength(0)
  const first=settleBank(deposit(),'2026-10-27');expect(first.account.balance).toBe(11);expect(first.entries[0].amount).toBe(1)
  expect(settleBank(first.account,'2026-10-27').entries).toHaveLength(0)
  const catchup=settleBank(deposit(),'2026-11-03');expect(catchup.entries).toHaveLength(2);expect(catchup.account.balance).toBe(12)
 })
 it('追加存款从下周期计息；取款降低本周期计息本金',()=>{
  const added=bankChange(deposit(),'deposit',{amount:90},90,'2026-10-26').account
  expect(settleBank(added,'2026-10-27').account.balance).toBe(101)
  const taken=bankChange(deposit(),'withdraw',{amount:5},0,'2026-10-26').account
  expect(settleBank(taken,'2026-10-27').entries[0].amount).toBe(0)
  expect(settleBank(taken,'2026-10-27').account.remainder).toBe(5000)
 })
 it('利率调整下周期生效，暂停仍可取款且不补发暂停期利息',()=>{
  const changed=bankChange(deposit(),'configure',{enabled:true,rateBps:2000},0,'2026-10-21').account
  const next=settleBank(changed,'2026-10-27');expect(next.entries[0].rateBps).toBe(1000);expect(next.account.weeklyRateBps).toBe(2000)
  const paused=bankChange(deposit(),'configure',{enabled:false,rateBps:1000},0,'2026-10-21').account
  expect(settleBank(paused,'2026-11-20').entries).toHaveLength(0)
  expect(bankChange(paused,'withdraw',{amount:10},0,'2026-11-20').account.balance).toBe(0)
 })
 it('拒绝透支和非法参数，未开启不允许存入',()=>{
  for(const amount of [0,-1,1.2,NaN,Infinity,1000001])expect(()=>bankChange(open(),'deposit',{amount},10,'2026-10-20')).toThrow()
  expect(()=>bankChange(open(),'deposit',{amount:11},10,'2026-10-20')).toThrow('不足')
  expect(()=>bankChange(deposit(),'withdraw',{amount:11},0,'2026-10-20')).toThrow('不足')
  expect(()=>bankChange(open(),'configure',{enabled:true,rateBps:2001},0,'2026-10-20')).toThrow()
  expect(()=>bankChange(newBankAccount('c','2026-10-20'),'deposit',{amount:1},10,'2026-10-20')).toThrow('开启')
 })
 it('利息留在银行，存取只在钱包和银行间划转',()=>{
  expect(bankWalletDelta([{kind:'deposit',amount:10},{kind:'interest',amount:1},{kind:'withdraw',amount:3}])).toBe(-7)
  let a=bankChange(open(),'deposit',{amount:1},1,'2026-10-20').account
  a=settleBank(a,'2026-12-29').account;expect(a.balance).toBe(2)
 })
})

it('已有存款的零星利息在全部取出后保留，再存入可继续累计',()=>{
 const a=settleBank(bankChange(open(),'deposit',{amount:5},5,'2026-10-20').account,'2026-10-27').account
 expect(a.remainder).toBe(5000)
 const empty=bankChange(a,'withdraw',{amount:5},0,'2026-10-27').account
 const saved=bankChange(empty,'deposit',{amount:5},5,'2026-10-27').account
 expect(settleBank(saved,'2026-11-03').account.balance).toBe(6)
})
