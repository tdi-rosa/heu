// Local CC0 character assets with original sprites as a loading fallback.
// Frames are normalized to the classic 3 × 4 RPG layout.
import { rpgCharacters } from './characters.ts';
import type { Direction } from '../shared/world.ts';
const coats = ['#cf7757','#658cb0','#9c81b2','#d5aa55','#6f9a82','#be7991'];
const hairs = ['#67412f','#3d343c','#8a5835','#c8a16b','#343d45','#754f46'];
function rect(ctx: CanvasRenderingContext2D,x:number,y:number,w:number,h:number,color:string) { ctx.fillStyle=color;ctx.fillRect(x,y,w,h); }
function character(ctx: CanvasRenderingContext2D,skin:number,direction:Direction,frame:number) {
  const coat=coats[skin], hair=hairs[skin], step=frame===0 ? -1 : frame===2 ? 1 : 0;
  const back=direction==='up', side=direction==='left'||direction==='right';
  const leg='#4c535e', outline='#3c363c', face='#edba8e';
  rect(ctx,5,18,3,5+(step>0?1:0),leg);rect(ctx,9,18,3,5+(step<0?1:0),leg);
  rect(ctx,4,22+(step>0?1:0),4,1,outline);rect(ctx,9,22+(step<0?1:0),4,1,outline);
  rect(ctx,4,12,9,7,coat);rect(ctx,4,18,9,1,'#655458');
  rect(ctx,3,13+step,2,5,coat);rect(ctx,12,13-step,2,5,coat);
  rect(ctx,3,17+step,2,2,face);rect(ctx,12,17-step,2,2,face);
  rect(ctx,7,10,3,3,face);
  rect(ctx,4,3,9,7,hair);rect(ctx,3,5,11,4,hair);
  if (!back) {
    rect(ctx,5,6,7,5,face);rect(ctx,4,5,8,2,hair);rect(ctx,4,6,2,3,hair);
    if(side) {
      const eye=direction==='right'?11:6;
      rect(ctx,eye,8,1,1,outline);rect(ctx,direction==='right'?12:4,9,1,2,face);
    } else {rect(ctx,6,8,1,1,outline);rect(ctx,10,8,1,1,outline);rect(ctx,8,10,2,1,'#c58770');}
  } else {rect(ctx,4,8,9,3,hair);rect(ctx,5,11,7,1,'#493a37');}
  if(!back) rect(ctx,7,14,3,1,'#eddbb3');
}
export const characterSheets = coats.map((_,skin) => {
  const sheet=document.createElement('canvas'); sheet.width=48;sheet.height=96;
  const ctx=sheet.getContext('2d')!;
  (['down','left','right','up'] as Direction[]).forEach((direction,row) => {
    for(let frame=0;frame<3;frame++) { ctx.save();ctx.translate(frame*16,row*24);character(ctx,skin,direction,frame);ctx.restore(); }
  });
  const image=new Image();
  image.onload=()=>{
    ctx.clearRect(0,0,48,96);
    [0,1,3,2].forEach((column,row)=>{for(let frame=0;frame<3;frame++){ctx.drawImage(image,column*16,frame*17,16,17,frame*16,row*24+7,16,17);}});
  };
  image.src=rpgCharacters[skin];
  return sheet;
});
export const treeSprite = (() => {
  const sprite=document.createElement('canvas');sprite.width=32;sprite.height=48;
  const ctx=sprite.getContext('2d')!;
  rect(ctx,13,32,6,15,'#87674c');rect(ctx,13,32,2,15,'#6b5543');
  rect(ctx,7,26,18,9,'#426b53');rect(ctx,3,14,26,15,'#4d7b59');
  rect(ctx,7,7,18,20,'#568461');rect(ctx,11,3,11,21,'#568461');
  rect(ctx,7,12,5,5,'#689773');rect(ctx,11,6,7,3,'#689773');
  rect(ctx,18,23,8,5,'#426b53');rect(ctx,5,24,5,5,'#426b53');
  rect(ctx,13,36,2,8,'#a07a52');
  return sprite;
})();
