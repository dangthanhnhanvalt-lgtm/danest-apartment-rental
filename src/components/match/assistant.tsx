import { Sparkles, RotateCcw, MapPin, CheckCircle2, ArrowRight } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { formatUSD } from "~/lib/format";
import { Link } from "~/lib/router";
import { getSupabaseListings } from "~/api/supabase-listings";
import { Button } from "~/components/ui/button";
import { Chip, Input } from "~/components/ui/form";
import { ListingCard, SampleDataNote } from "~/components/ui/listing-card";
import { useI18n } from "~/i18n/language-context";
import { useLabels } from "~/i18n/use-labels";
import { emptyMatchPreferences, matchPublicListings, validMatchBudget, validMatchDate, vietnamToday, type MatchPreferences } from "~/lib/match-listings";
import type { Listing } from "~/types";
import { cn } from "~/lib/utils";

const steps = ["intro","budget","neighborhood","duration","moveIn","bedrooms","furnishing","lifestyle","amenities","done"] as const;
type Step = typeof steps[number];
const questions: Record<Step,string> = {intro:"ai.welcome",budget:"ai.askBudget",neighborhood:"ai.askNeighborhood",duration:"ai.askDuration",moveIn:"ai.askMoveIn",bedrooms:"ai.askBedrooms",furnishing:"ai.askFurnishing",lifestyle:"ai.askLifestyle",amenities:"ai.askAmenities",done:"ai.thanks"};

export function MatchAssistant({ variant = "page" }: { variant?: "page" | "compact" }) {
  const compact=variant==="compact";
  const {t,pick,lang}=useI18n();
  const labels=useLabels();
  const [step,setStep]=useState<Step>("intro");
  const [prefs,setPrefs]=useState<MatchPreferences>(emptyMatchPreferences);
  const [budget,setBudget]=useState("");
  const [date,setDate]=useState("");
  const [rows,setRows]=useState<Listing[]>([]);
  const [status,setStatus]=useState<"loading"|"ready"|"error">("loading");
  const [request,setRequest]=useState(0);
  const content=useRef<HTMLDivElement>(null);
  const resultsHeading=useRef<HTMLHeadingElement>(null);
  const questionHeading=useRef<HTMLDivElement>(null);
  const id=useId();
  const idx=steps.indexOf(step);
  const next=(patch:Partial<MatchPreferences>={})=>{setPrefs(p=>({...p,...patch}));setStep(steps[Math.min(idx+1,steps.length-1)]);};
  const previous=()=>setStep(steps[Math.max(0,idx-1)]);
  const restart=()=>{setPrefs(emptyMatchPreferences());setBudget("");setDate("");setStep("intro");setRows([]);setStatus("loading");};
  // Query the public RPC directly. AppState may merge a landlord's private listings into its cache.
  useEffect(()=>{
    if(step!=="done")return;
    let cancelled=false;
    setRows([]);setStatus("loading");
    void getSupabaseListings().then(data=>{if(!cancelled){setRows(data);setStatus("ready");}}).catch(()=>{if(!cancelled){setRows([]);setStatus("error");}});
    return ()=>{cancelled=true;};
  },[step,request]);
  useEffect(()=>{
    if(step==="intro"){if(content.current)content.current.scrollTop=0;return;}
    const target=step==="done"?resultsHeading.current:questionHeading.current;
    if(content.current&&target&&(compact||(step!=="done"&&content.current.scrollHeight>content.current.clientHeight+2))){
      const scroller=content.current;
      scroller.scrollTop=step==="done"?0:target.getBoundingClientRect().top-scroller.getBoundingClientRect().top+scroller.scrollTop-12;
    } else target?.scrollIntoView({block:step==="done"?"start":"nearest",behavior:"instant"});
    target?.focus({preventScroll:true});
  },[step,compact]);
  const matches=status==="ready"&&step==="done"?matchPublicListings(rows,prefs):[];
  const fmtDate=(s:string)=>new Intl.DateTimeFormat(lang==="vi"?"vi-VN":"en-US",{dateStyle:"medium",timeZone:"UTC"}).format(new Date(`${s}T00:00:00Z`));
  const answers:Partial<Record<Step,string>>={
    budget:prefs.budget===null?t("ai.flexible"):t("ai.userBudget",{value:prefs.budget}),
    neighborhood:prefs.neighborhood&&prefs.neighborhood!=="any"?labels.neighborhood[prefs.neighborhood]:t("ai.anywhere"),
    duration:prefs.duration===null?t("ai.noPreference"):t("ai.userMonths",{count:prefs.duration}),
    moveIn:prefs.moveIn?fmtDate(prefs.moveIn):t("ai.noPreference"),
    bedrooms:prefs.bedrooms===null?t("ai.noPreference"):prefs.bedrooms>=3?t("ai.userBedrooms3"):t("ai.userBedrooms",{count:prefs.bedrooms}),
    furnishing:prefs.furnishing?labels.furnishing[prefs.furnishing]:t("ai.noPreference"),
    lifestyle:prefs.lifestyle.map(x=>t(`ai.tag.${x}`)).join(", ")||t("ai.noPreference"),
    amenities:prefs.amenities.map(x=>labels.amenity[x]).join(", ")||t("ai.noAmenities"),
  };
  const skip=<Chip selected={false} onClick={()=>next(step==="duration"?{duration:null}:step==="bedrooms"?{bedrooms:null}:step==="furnishing"?{furnishing:null}:{moveIn:""})}>{t("ai.noPreference")}</Chip>;
  const controls= <div className="space-y-3">
    {step==="intro"&&<Button className="w-full whitespace-normal" onClick={()=>next()}>{t("ai.start")} <ArrowRight/></Button>}
    {step==="budget"&&<><div className="flex flex-wrap gap-2">{[400,600,800,1200].map(b=><Chip key={b} selected={budget===String(b)} onClick={()=>setBudget(String(b))}>${b}</Chip>)}<Chip selected={budget==="flex"} onClick={()=>setBudget("flex")}>{t("ai.flexible")}</Chip></div><label htmlFor={`${id}-budget`} className="text-sm font-medium">{t("ai.budgetUSD")}</label><Input id={`${id}-budget`} className="min-w-0" type="number" min="1" max="1000000" value={budget==="flex"?"":budget} onChange={e=>setBudget(e.target.value)} placeholder={t("ai.budgetPlaceholder")}/><Button className="w-full" disabled={budget!=="flex"&&!validMatchBudget(budget)} onClick={()=>next({budget:budget==="flex"?null:Number(budget)})}>{t("common.next")}</Button></>}
    {step==="neighborhood"&&<div className="flex flex-wrap gap-2">{labels.neighborhoods.map(n=><Chip key={n.id} selected={prefs.neighborhood===n.id} onClick={()=>next({neighborhood:n.id})}>{n.name}</Chip>)}<Chip selected={prefs.neighborhood==="any"} onClick={()=>next({neighborhood:"any"})}>{t("ai.anywhere")}</Chip></div>}
    {step==="duration"&&<div className="flex flex-wrap gap-2">{Array.from({length:12},(_,i)=>i+1).map(n=><Chip key={n} selected={prefs.duration===n} onClick={()=>next({duration:n})}>{t("ai.userMonths",{count:n})}</Chip>)}{skip}</div>}
    {step==="moveIn"&&<><label htmlFor={`${id}-date`} className="text-sm">{t("ai.askMoveIn")}</label><Input id={`${id}-date`} className="min-w-0" type="date" min={vietnamToday()} value={date} onChange={e=>setDate(e.target.value)}/><div className="flex flex-wrap gap-2"><Button disabled={!validMatchDate(date)} onClick={()=>next({moveIn:date})}>{t("common.next")}</Button>{skip}</div></>}
    {step==="bedrooms"&&<div className="flex flex-wrap gap-2">{[1,2,3].map(n=><Chip key={n} selected={prefs.bedrooms===n} onClick={()=>next({bedrooms:n})}>{n===3?t("ai.userBedrooms3"):t("ai.userBedrooms",{count:n})}</Chip>)}{skip}</div>}
    {step==="furnishing"&&<div className="flex flex-wrap gap-2">{(["furnished","semi-furnished","unfurnished"] as const).map(f=><Chip key={f} selected={prefs.furnishing===f} onClick={()=>next({furnishing:f})}>{labels.furnishing[f]}</Chip>)}{skip}</div>}
    {step==="lifestyle"&&<><div className="flex flex-wrap gap-2">{(["remote","beach"] as const).map(tag=><Chip key={tag} selected={prefs.lifestyle.includes(tag)} onClick={()=>setPrefs(p=>({...p,lifestyle:p.lifestyle.includes(tag)?p.lifestyle.filter(x=>x!==tag):[...p.lifestyle,tag]}))}>{t(`ai.tag.${tag}`)}</Chip>)}</div><p className="text-xs text-muted-foreground">{t("ai.lifestyleNote")}</p><Button className="w-full whitespace-normal" onClick={()=>next()}>{t("common.continue")}</Button></>}
    {step==="amenities"&&<><div className="flex flex-wrap gap-2">{labels.amenities.map(a=><Chip key={a.id} selected={prefs.amenities.includes(a.id)} onClick={()=>setPrefs(p=>({...p,amenities:p.amenities.includes(a.id)?p.amenities.filter(x=>x!==a.id):[...p.amenities,a.id]}))}>{labels.amenity[a.id]}</Chip>)}</div><p className="text-xs text-muted-foreground">{t("ai.amenitiesNote")}</p><Button className="w-full" onClick={()=>{setStatus("loading");next();}}>{t("ai.showMatches")} <ArrowRight/></Button></>}
    {idx>1&&step!=="done"&&<Button className="w-full" variant="ghost" onClick={previous}>{t("ai.back")}</Button>}
  </div>;
  const chat=<div className="min-w-0 space-y-4 p-4">
    {idx>1&&<details className="rounded-xl border border-[#DCEAF0] bg-white p-3"><summary className="cursor-pointer text-sm font-medium">{pick("Your previous answers","Câu trả lời trước đó")} ({idx-1})</summary><dl className="mt-3 space-y-2">{steps.slice(1,idx).map(s=><div key={s} className="border-t border-[#DCEAF0] pt-2 text-sm"><dt className="text-xs text-muted-foreground">{t(questions[s])}</dt><dd className="mt-1 break-words font-medium">{answers[s]}</dd></div>)}</dl></details>}
    <div ref={questionHeading} tabIndex={-1} className="rounded-2xl bg-[#E8F7FD] p-4 text-base font-medium text-[#12334A] outline-none break-words">{t(questions[step])}</div>
    {controls}
  </div>;
  const result=<section className="min-w-0 space-y-4 p-4" aria-busy={status==="loading"}>
    <h2 ref={resultsHeading} tabIndex={-1} className="scroll-mt-20 font-heading text-2xl font-medium outline-none">{t("ai.recommended")}</h2>
    <p className="text-sm text-muted-foreground" role="status">{status==="loading"?t("ai.loadingResults"):status==="error"?t("ai.loadError"):matches.length===1?t("ai.matchesCountOne"):t("ai.matchesCount",{count:matches.length})}</p>
    {status==="error"&&<Button onClick={()=>setRequest(n=>n+1)}>{t("ai.retry")}</Button>}
    {status==="ready"&&matches.length===0&&<div className="rounded-xl border border-[#DCEAF0] p-4 text-center"><MapPin className="mx-auto size-7 text-muted-foreground"/><h3 className="mt-2 font-semibold">{t("ai.noMatchesTitle")}</h3><p className="mt-2 text-sm">{t("ai.noMatchesHint")}</p></div>}
    {status==="ready"&&matches.map(m=>{const l=m.listing;const reasons=[t("ai.availableReason"),prefs.budget!==null?t("ai.reason.budgetIn",{estimate:formatUSD(m.costs.estimatedMonthly,true),budget:formatUSD(prefs.budget,true)}):t("ai.knownMonthly",{estimate:formatUSD(m.costs.estimatedMonthly,true)})];if(prefs.moveIn)reasons.push(t("ai.dateReason",{date:fmtDate(l.availableFrom.slice(0,10))}));if(prefs.neighborhood&&prefs.neighborhood!=="any")reasons.push(t("ai.reason.area",{area:labels.neighborhood[l.neighborhood]}));if(prefs.duration!==null)reasons.push(t("ai.reason.duration",{months:prefs.duration,min:l.rentalDurationMonths[0],max:l.rentalDurationMonths[1]}));if(prefs.bedrooms!==null)reasons.push(t(l.bedrooms===prefs.bedrooms?"ai.reason.bedrooms":"ai.reason.bedroomsMore",{count:l.bedrooms,wanted:prefs.bedrooms}));if(prefs.furnishing)reasons.push(labels.furnishing[l.furnishing]);if(prefs.amenities.length)reasons.push(t("ai.reason.amenities",{list:prefs.amenities.map(a=>labels.amenity[a]).join(", ")}));if(m.remote)reasons.push(t("ai.reason.remote"));if(m.beach)reasons.push(t("ai.beachReason",{distance:m.distance!}));if(l.verificationBadge)reasons.push(t("ai.reason.verified"));return <article key={l.id} className="min-w-0 space-y-2"><ListingCard listing={l}/>{l.isSample&&<p className="text-xs font-semibold text-muted-foreground">{t("listing.demoData")}</p>}<div className="rounded-xl border border-[#DCEAF0] bg-[#E8F7FD] p-4 text-[#12334A]"><p className="font-semibold text-sm">{t("ai.whyMatches")}</p><ul className="mt-2 space-y-1.5 text-sm">{reasons.map((r,i)=><li key={i} className="flex gap-2 break-words"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[#087EBD]"/>{r}</li>)}</ul>{m.unknownMonthly>0&&<p className="mt-2 text-sm text-[#557083]">{t("ai.unknownMonthly",{count:m.unknownMonthly})}</p>}{(prefs.lifestyle.includes("remote")&&!m.remote||prefs.lifestyle.includes("beach")&&!m.beach)&&<p className="mt-2 text-xs text-[#557083]">{t("ai.softUnconfirmed")}</p>}</div></article>;})}
    {matches.some(m=>m.listing.isSample)&&<SampleDataNote/>}
    <p className="text-xs text-muted-foreground">{t("ai.snapshotNote")}</p>
    <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={()=>setStep("amenities")}>{t("ai.adjust")}</Button><Button variant="outline" onClick={restart}>{t("common.startOver")}</Button><Button asChild><Link to="/search">{t("ai.browseAll")}</Link></Button></div>
  </section>;
  const header=<div className="flex shrink-0 items-center gap-3 border-b border-[#DCEAF0] p-3"><span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#087EBD] text-white"><Sparkles className="size-4"/></span><div className="min-w-0 flex-1"><p className="text-sm font-semibold">{t("ai.title")}</p><p className="text-xs text-muted-foreground">{t("ai.subtitle")}</p></div><button type="button" onClick={restart} aria-label={t("common.startOver")} className="size-10 shrink-0 rounded-lg hover:bg-accent focus-visible:ring-2"><RotateCcw className="mx-auto size-4"/></button></div>;
  const progress=<div className="shrink-0 border-b border-[#DCEAF0] px-4 py-2"><p className="mb-1 text-xs text-muted-foreground">{pick("Step", "Bước")} {Math.min(8,Math.max(0,idx))}/8</p><div className="flex gap-1" role="progressbar" aria-label={t("ai.title")} aria-valuemin={0} aria-valuemax={8} aria-valuenow={Math.min(8,Math.max(0,idx))}>{steps.slice(1,-1).map((s,i)=><span key={s} className={cn("h-1 flex-1 rounded-full",idx>i?"bg-[#087EBD]":"bg-muted")}/>)}</div></div>;
  if(compact)return <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">{header}{progress}<div ref={content} className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain">{step==="done"?result:chat}</div></div>;
  return <div className="grid min-w-0 gap-6 lg:grid-cols-5"><div className="min-w-0 lg:col-span-2"><div className="rounded-2xl border border-[#DCEAF0] bg-white shadow-[0_8px_30px_rgba(18,51,74,0.06)] lg:sticky lg:top-20 lg:flex lg:max-h-[calc(100dvh-6rem)] lg:flex-col">{header}{progress}<div ref={content} className="min-h-0 min-w-0 lg:overflow-y-auto lg:overscroll-contain">{chat}</div></div></div><div className="min-w-0 lg:col-span-3">{step==="done"?result:<div className="rounded-2xl border border-[#DCEAF0] bg-white p-5 shadow-[0_8px_30px_rgba(18,51,74,0.05)]"><h2 className="font-semibold">{t("ai.howItWorks")}</h2><p className="mt-2 text-sm text-muted-foreground">{t("ai.prototypeNote")}</p><p className="mt-2 text-sm text-muted-foreground">{t("ai.howItWorks3")}</p></div>}</div></div>;
}
