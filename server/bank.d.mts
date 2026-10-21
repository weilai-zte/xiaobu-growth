export function bankToday(): string
export function newBankAccount(childId:string,today:string): any
export function settleBank(account:any,today:string): {account:any;entries:any[]}
export function bankChange(account:any,action:string,input:any,available:number,today:string): {account:any;entries:any[]}
export function bankWalletDelta(entries:any[]):number
