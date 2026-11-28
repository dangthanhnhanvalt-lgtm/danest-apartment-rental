import { Sparkles, X, Maximize2, Minimize2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "~/lib/router";
import { MatchAssistant } from "~/components/match/assistant";
import { useI18n } from "~/i18n/language-context";
import { cn } from "~/lib/utils";

export function AssistantBubble() {
  const { path } = useRouter();
  const { t, pick } = useI18n();
  const [open,setOpen]=useState(false);
  const [wide,setWide]=useState(false);
  const [session,setSession]=useState(0);
  const panelRef=useRef<HTMLDivElement>(null);
  const buttonRef=useRef<HTMLButtonElement>(null);
  const close=()=>{setOpen(false);window.requestAnimationFrame(()=>buttonRef.current?.focus());};
  // Do not cover a detail or search page after a result link was selected.
  useEffect(()=>{setOpen(false);},[path]);
  useEffect(()=>{
    if(!open)return;
    const onKey=(e:KeyboardEvent)=>{if(e.key==="Escape"){setOpen(false);window.requestAnimationFrame(()=>buttonRef.current?.focus());}};
    document.addEventListener("keydown",onKey);
    const frame=window.requestAnimationFrame(()=>panelRef.current?.querySelector<HTMLElement>("button")?.focus());
    return ()=>{document.removeEventListener("keydown",onKey);window.cancelAnimationFrame(frame);};
  },[open]);
  if(path==="/match")return null;
  const detail=path.startsWith("/apartment/");
  return <div className={cn("fixed right-3 z-[80] flex max-w-[calc(100vw-1.5rem)] flex-col items-end sm:right-6 lg:bottom-6",detail?"max-lg:bottom-[calc(6rem+env(safe-area-inset-bottom))]":"max-lg:bottom-[calc(1rem+env(safe-area-inset-bottom))]")}>
    {open&&<div ref={panelRef} role="dialog" aria-modal="false" aria-label={t("ai.open")} className={cn("flex h-[640px] w-[calc(100vw-1.5rem)] min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-card sm:w-[440px] lg:max-h-[calc(100dvh-4rem)]",detail?"max-lg:max-h-[calc(100dvh-7rem-env(safe-area-inset-bottom))]":"max-lg:max-h-[calc(100dvh-2rem-env(safe-area-inset-bottom))]",wide&&"sm:w-[min(700px,calc(100vw-3rem))]")} style={{boxShadow:"var(--shadow-overlay)"}}>
      <div className="flex shrink-0 items-center gap-2 bg-[#172C3D] px-3 py-1.5 text-[#F7F5F0]"><p className="mr-auto text-sm font-semibold">{t("ai.askDanest")}</p><button type="button" onClick={()=>setWide(v=>!v)} aria-label={wide?pick("Compact chat","Thu nhỏ chat"):pick("Expand chat","Mở rộng chat")} aria-pressed={wide} className="hidden size-10 items-center justify-center rounded-lg hover:bg-white/10 focus-visible:ring-2 sm:flex">{wide?<Minimize2 className="size-4"/>:<Maximize2 className="size-4"/>}</button><button type="button" onClick={close} aria-label={t("ai.close")} className="flex size-10 items-center justify-center rounded-lg hover:bg-white/10 focus-visible:ring-2"><X className="size-5"/></button></div>
      <div className="min-h-0 min-w-0 flex-1"><MatchAssistant key={session} variant="compact"/></div>
    </div>}
    <button ref={buttonRef} type="button" onClick={()=>{setSession(n=>n+1);setOpen(true);}} aria-expanded={open} aria-label={t("ai.open")} className={cn("inline-flex h-12 items-center gap-2 rounded-full border border-border bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary-hover focus-visible:ring-2",open&&"hidden")} style={{boxShadow:"var(--shadow-elevated)"}}><span className="flex size-7 items-center justify-center rounded-full bg-primary-foreground text-primary"><Sparkles className="size-4"/></span>{t("ai.askDanest")}</button>
  </div>;
}
