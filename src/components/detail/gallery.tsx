import { useState } from "react";
import { ChevronLeft, ChevronRight, Expand, ImageOff } from "lucide-react";
import { PhotoViewer } from "~/components/photos/photo-viewer";
import { useI18n } from "~/i18n/language-context";

export function Gallery({ images, title }: { images: string[]; title: string }) {
  const { t, pick } = useI18n();
  const [open,setOpen]=useState(false);
  const [index,setIndex]=useState(0);
  const shots=images.filter(Boolean);
  const active=Math.min(index,Math.max(0,shots.length-1));
  const openAt=(i:number)=>{setIndex(i);setOpen(true);};
  const altFor=(i:number)=>`${title} — ${pick("photo","ảnh")} ${i+1}`;
  const side=shots.map((src,i)=>({src,i})).filter(x=>x.i!==active).slice(0,4);
  if(!shots.length)return <div className="flex min-h-56 flex-col items-center justify-center gap-2 rounded-2xl border border-border bg-muted text-muted-foreground"><ImageOff className="size-9" aria-hidden="true"/>{pick("No photos provided","Chưa có ảnh căn hộ")}</div>;
  return <div className="danest-photo-gallery">
    <div className={`grid gap-2 overflow-hidden rounded-2xl ${side.length>=2?"lg:grid-cols-[1.35fr_1fr]":""}`}>
      <div className="relative overflow-hidden rounded-xl bg-muted">
        <button type="button" onClick={()=>openAt(active)} aria-label={t("aria.openPhoto",{n:active+1})} className="block aspect-[4/3] w-full focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring lg:aspect-auto lg:h-[440px]">
          <img src={shots[active]} alt={altFor(active)} className="size-full object-cover"/>
        </button>
        {shots.length>1&&<>{[-1,1].map(delta=><button key={delta} type="button" onClick={()=>setIndex((active+delta+shots.length)%shots.length)} aria-label={t(delta<0?"aria.prevPhoto":"aria.nextPhoto")} className={`absolute top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card text-foreground focus-visible:ring-2 focus-visible:ring-ring ${delta<0?"left-3":"right-3"}`}>{delta<0?<ChevronLeft aria-hidden="true"/>:<ChevronRight aria-hidden="true"/>}</button>)}</>}
        <span className="absolute bottom-3 left-3 rounded-full bg-[#172C3D] px-3 py-1 text-xs font-semibold text-white">{active+1} / {shots.length}</span>
        <button type="button" onClick={()=>openAt(active)} className="absolute bottom-3 right-3 inline-flex min-h-10 items-center gap-2 rounded-lg border border-border bg-card px-3 text-xs font-semibold text-foreground focus-visible:ring-2 focus-visible:ring-ring"><Expand className="size-4" aria-hidden="true"/>{pick("All photos","Xem tất cả ảnh")}</button>
      </div>
      {side.length>=2&&<div className="hidden h-[440px] grid-cols-2 auto-rows-fr gap-2 lg:grid">{side.map(({src,i})=><button key={i} type="button" onClick={()=>openAt(i)} aria-label={t("aria.openPhoto",{n:i+1})} className="relative min-h-0 overflow-hidden rounded-xl bg-muted focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"><img src={src} alt={altFor(i)} className="size-full object-cover" loading="lazy"/></button>)}</div>}
    </div>
    {shots.length>1&&<div className="mt-3 flex gap-2 overflow-x-auto pb-1">{shots.map((src,i)=><button key={i} type="button" onClick={()=>openAt(i)} aria-label={t("aria.openPhoto",{n:i+1})} aria-current={i===active} className={`aspect-[4/3] w-20 shrink-0 overflow-hidden rounded-lg border-2 bg-muted focus-visible:ring-2 focus-visible:ring-ring sm:w-24 ${i===active?"border-primary":"border-transparent"}`}><img src={src} alt="" loading="lazy" className="size-full object-cover"/></button>)}</div>}
    {open&&<PhotoViewer images={shots} title={title} index={active} onIndex={setIndex} onClose={()=>setOpen(false)}/>}
  </div>;
}
