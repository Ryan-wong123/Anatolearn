import { useEffect, useId, useRef } from 'react';
import type { ReactNode } from 'react';
interface DialogProps { children:ReactNode; className:string; onClose:()=>void; label?:string; }
export default function Dialog({children,className,onClose,label='AnatoLearn dialog'}:DialogProps) {
  const root=useRef<HTMLDivElement>(null);
  const close=useRef(onClose);
  const id=useId();
  useEffect(()=>{close.current=onClose;},[onClose]);
  useEffect(()=>{
    const previous=document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const element=root.current;
    if(!element)return;
    const heading=element.querySelector('h1,h2,h3');
    if(heading){heading.id ||= `${id}-title`;element.setAttribute('aria-labelledby',heading.id);}
    const inputs=()=>Array.from(element.querySelectorAll<HTMLElement>('summary,button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]')).filter((item)=>item.getClientRects().length>0);
    const frame=requestAnimationFrame(()=>{(inputs()[0] || element).focus();});
    function keyboard(event:KeyboardEvent){
      if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close.current();}
      if(event.key==='Tab'){
        const items=inputs(),first=items[0],last=items[items.length-1];
        if(!first){event.preventDefault();element?.focus();return;}
        if(event.shiftKey && (document.activeElement===first || document.activeElement===element)){event.preventDefault();last.focus();}
        else if(!event.shiftKey && document.activeElement===last){event.preventDefault();first.focus();}
      }
    }
    element.addEventListener('keydown',keyboard);
    return ()=>{cancelAnimationFrame(frame);element.removeEventListener('keydown',keyboard);previous?.focus();};
  },[id]);
  return <div ref={root} role="dialog" aria-modal="true" aria-label={label} tabIndex={-1} className={className}>{children}</div>;
}
