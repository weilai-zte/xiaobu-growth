import * as T from 'three'
import {frameSize} from './birdContact'
export interface BirdFrame {texture:T.CanvasTexture;width:number;height:number;beak:[number,number]}
/** Trim transparent gutters; all care frames share one pixel scale, so bending never enlarges the bird. */
export function birdFrames(image:HTMLImageElement,columns:number,rows:number):BirdFrame[]{
 const cw=image.width/columns,ch=image.height/rows,frames:BirdFrame[]=[]
 const source=document.createElement('canvas');source.width=cw;source.height=ch
 const ctx=source.getContext('2d',{willReadFrequently:true})!
 const bounds=[]
 for(let row=0;row<rows;row++)for(let col=0;col<columns;col++){
  ctx.clearRect(0,0,cw,ch);ctx.drawImage(image,col*cw,row*ch,cw,ch,0,0,cw,ch)
  const pixels=ctx.getImageData(0,0,cw,ch).data;let left=cw,top=ch,right=0,bottom=0
  for(let y=0;y<ch;y++)for(let x=0;x<cw;x++)if(pixels[(y*cw+x)*4+3]>32){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y)}
  bounds.push({left,top,right,bottom})
 }
 const reference=bounds[rows===3?4:0],unit=2.65/(reference.bottom-reference.top+1)
 bounds.forEach((b,i)=>{
  const width=b.right-b.left+1,height=b.bottom-b.top+1,c=document.createElement('canvas');c.width=width;c.height=height
  c.getContext('2d')!.drawImage(image,(i%columns)*cw+b.left,Math.floor(i/columns)*ch+b.top,width,height,0,0,width,height)
  const texture=new T.CanvasTexture(c);texture.colorSpace=T.SRGBColorSpace
  const mouth=rows===3&&Math.floor(i/columns)===1?[[.58,.48],[.36,.78],[.33,.87],[.55,.47]][i%columns]:[.56,.4]
  frames.push({texture,...frameSize(width,height,reference.bottom-reference.top+1),beak:[(mouth[0]*cw-b.left-width/2)*unit,(b.bottom-mouth[1]*ch)*unit]})
 })
 return frames
}
