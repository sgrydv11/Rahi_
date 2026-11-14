import { useRef,useState,type ReactNode } from 'react';
export function SwipeReply({children,reply,disabled=false}:{children:ReactNode;reply:()=>void;disabled?:boolean}){
 const start=useRef<{x:number;y:number}|null>(null),[offset,setOffset]=useState(0);
 return <div className="swipe-reply" style={{transform:`translateX(${offset}px)`}} onPointerDown={e=>{if(disabled||e.button!==0||(e.target as HTMLElement).closest('a,button,input,textarea,select'))return;start.current={x:e.clientX,y:e.clientY};}}
 onPointerMove={e=>{const p=start.current;if(!p)return;const dx=e.clientX-p.x,dy=e.clientY-p.y;if(Math.abs(dy)>20&&Math.abs(dy)>Math.abs(dx)){start.current=null;setOffset(0);return;}if(dx>10&&Math.abs(dy)<dx*.65){e.currentTarget.setPointerCapture(e.pointerId);setOffset(Math.min(dx,80));}}}
 onPointerUp={e=>{const p=start.current;start.current=null;setOffset(0);if(p&&e.clientX-p.x>=55&&Math.abs(e.clientY-p.y)<(e.clientX-p.x)*.65)reply();}}
 onPointerCancel={()=>{start.current=null;setOffset(0);}}>{children}</div>;
}
