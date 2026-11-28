import type { AmenityId, FurnishingStatus, Listing, NeighborhoodId } from "~/types";
import { summarizeCosts } from "~/lib/format";

export interface MatchPreferences {
  budget: number | null;
  neighborhood: NeighborhoodId | "any" | null;
  duration: number | null;
  moveIn: string;
  bedrooms: number | null;
  furnishing: FurnishingStatus | null;
  lifestyle: ("remote" | "beach")[];
  amenities: AmenityId[];
}
export const emptyMatchPreferences = (): MatchPreferences => ({budget:null,neighborhood:null,duration:null,moveIn:"",bedrooms:null,furnishing:null,lifestyle:[],amenities:[]});
export function vietnamToday(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {timeZone:"Asia/Ho_Chi_Minh",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(now);
  const part = (name:string) => parts.find(p=>p.type===name)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}
export function validMatchBudget(value:string):boolean {
  const n=Number(value); return value.trim()!=="" && Number.isFinite(n) && n>0 && n<=1000000;
}
export function validMatchDate(value:string,today=vietnamToday()):boolean {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d=new Date(`${value}T00:00:00Z`);
  return Number.isFinite(+d)&&d.toISOString().slice(0,10)===value&&value>=today;
}
export function distanceMeters(text:string):number|null {
  // Accept one numeric distance in metres/kilometres. Never infer time-to-beach.
  const m=text.trim().match(/^(\d+(?:[.,]\d{1,2})?)\s*(km|m)\b/i);
  if(!m)return null;
  const n=Number(m[1].replace(",","."))*(m[2].toLowerCase()==="km"?1000:1);
  return Number.isFinite(n)&&n>=0?n:null;
}
export function matchPublicListings(rows:Listing[],prefs:MatchPreferences) {
  return rows.flatMap(listing=>{
    if(listing.status!=="published"||listing.availability!=="available")return [];
    const costs=summarizeCosts(listing);
    if(!Number.isFinite(costs.estimatedMonthly)||costs.estimatedMonthly<0)return [];
    if(prefs.budget!==null&&costs.estimatedMonthly>prefs.budget)return [];
    if(prefs.neighborhood&&prefs.neighborhood!=="any"&&listing.neighborhood!==prefs.neighborhood)return [];
    if(prefs.duration!==null&&!(prefs.duration>=listing.rentalDurationMonths[0]&&prefs.duration<=listing.rentalDurationMonths[1]))return [];
    if(prefs.moveIn&&(!validMatchDate((listing.availableFrom??"").slice(0,10),"0001-01-01")||(listing.availableFrom??"").slice(0,10)>prefs.moveIn))return [];
    if(prefs.bedrooms!==null&&!(listing.bedrooms>=prefs.bedrooms))return [];
    if(prefs.furnishing&&listing.furnishing!==prefs.furnishing)return [];
    if(!prefs.amenities.every(a=>listing.amenities.includes(a)))return [];
    const remote=prefs.lifestyle.includes("remote")&&listing.amenities.includes("wifi")&&listing.amenities.includes("workspace");
    const distance=distanceMeters(listing.distanceToBeach??"");
    const beach=prefs.lifestyle.includes("beach")&&distance!==null&&distance<=800;
    const unknownMonthly=costs.unknownItems.filter(i=>i.cadence==="monthly").length;
    // Rank by evidenced soft preferences, then verified status, then fewer unknown monthly costs.
    // No paid promotion boost or percentage claiming probability of fit.
    const score=(remote?8:0)+(beach?6:0)+(listing.verificationBadge?2:0);
    return [{listing,costs,remote,beach,distance,unknownMonthly,score}];
  }).sort((a,b)=>b.score-a.score||a.unknownMonthly-b.unknownMonthly||a.costs.estimatedMonthly-b.costs.estimatedMonthly||a.listing.id.localeCompare(b.listing.id)).slice(0,4);
}
