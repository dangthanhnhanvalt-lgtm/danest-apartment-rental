import {listingRpc} from "~/api/supabase-listings";
export interface CampaignMetrics {id:string;eligible:boolean;views:number;inquiries:number}
export interface PromotionMetrics {startedAt:string;periodStart:string;asOf:string;sponsoredViews:number;ordinaryViews:number;sponsoredInquiries:number;ordinaryInquiries:number;campaigns:CampaignMetrics[]}
const tokenKey="danest.analytics.30min";
let fallback:{bucket:number;token:string}|null=null;
function visitorToken():string {
  const bucket=Math.floor(Date.now()/1800000);
  try {
    const existing=JSON.parse(localStorage.getItem(tokenKey)??"null") as {bucket:number;token:string}|null;
    if(existing?.bucket===bucket && /^[0-9a-f-]{36}$/i.test(existing.token))return existing.token;
    const token=crypto.randomUUID();localStorage.setItem(tokenKey,JSON.stringify({bucket,token}));return token;
  }catch{
    if(fallback?.bucket!==bucket)fallback={bucket,token:crypto.randomUUID()};return fallback.token;
  }
}
export async function recordListingView(id:string):Promise<void>{
  await listingRpc("danest_record_view_09d1",{p_source_id:id,p_visitor_token:visitorToken()});
}
export async function readPromotionMetrics():Promise<PromotionMetrics>{
  const data=await listingRpc("danest_promotion_metrics_09d1",{});
  if(!data||!Array.isArray(data.campaigns)||typeof data.sponsoredViews!=="number")throw new Error("Analytics response unavailable");
  return data as PromotionMetrics;
}
