import {expect,it} from 'vitest'
import {parkCollection,treasurePlacement} from '../src/lib/parkCollection'
it('每种已收集物品只摆一件，不凭选择标识展示未拥有的收藏',()=>{
 expect(parkCollection(['gem','gem','berry','unknown'],['swing','swing','scarf','bell','unknown'],'shell')).toEqual({treasures:['berry','gem'],toys:['bell','swing'],favorite:''})
 expect(parkCollection([],[],'gem')).toEqual({treasures:[],toys:[],favorite:''})
 expect(parkCollection(['shell','gem'],[],'gem').favorite).toBe('gem')
})
it('收藏保留固定位置，选中的物品才移到当前区域眼前',()=>{
 expect(treasurePlacement('gem',9,'meadow',false)).toEqual(treasurePlacement('gem',35,'pool',false))
 expect(treasurePlacement('gem',35,'pool',true).position).not.toEqual(treasurePlacement('gem',35,'pool',false).position)
 expect(treasurePlacement('honey',21,'home',false).position).not.toEqual(treasurePlacement('honey',9,'meadow',false).position)
})
