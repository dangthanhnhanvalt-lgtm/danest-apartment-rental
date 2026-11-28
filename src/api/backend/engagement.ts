import { supabase } from "~/lib/supabase";
import { listingUuid, listingRpc } from "~/api/supabase-listings";
import type { Report } from "~/types";

async function readPages<T>(load: (from: number, to: number) => PromiseLike<{data: T[] | null; error: {message:string} | null}>): Promise<T[]> {
  const rows:T[]=[];
  for(let offset=0;;offset+=100){
    const {data,error}=await load(offset,offset+99);
    if(error) throw new Error(error.message);
    rows.push(...(data??[]));
    if(!data || data.length<100) return rows;
  }
}
export async function readSaved(userId:string):Promise<string[]> {
  const rows=await readPages((from,to)=>supabase.from("saved_apartments").select("listing_id,properties(source_id,status)").eq("user_id",userId).order("listing_id").range(from,to));
  return rows.flatMap(row=>{const p=(Array.isArray(row.properties)?row.properties[0]:row.properties) as {source_id:string;status:string}|null; return p?.status==="published" && p.source_id?[p.source_id]:[`unavailable:${row.listing_id}`];});
}
export async function writeSaved(userId:string,id:string,save:boolean):Promise<void>{
  const unavailable=id.startsWith("unavailable:");
  if(unavailable && save) throw new Error("Cannot save an unavailable listing");
  const listingId=unavailable?id.slice("unavailable:".length):await listingUuid(id);
  const current=await supabase.auth.getUser();
  if(current.error || current.data.user?.id!==userId) throw new Error("Account changed; sign in again");
  const result=save?await supabase.from("saved_apartments").insert({user_id:userId,listing_id:listingId}):await supabase.from("saved_apartments").delete().eq("user_id",userId).eq("listing_id",listingId).select("listing_id");
  if(result.error && !(save && result.error.code==="23505")) throw new Error(result.error.message);
  if(!save && !result.data?.length) throw new Error("Saved record not removed; refresh the list / Hãy làm mới danh sách");
}
export async function createReport(id:string,category:Report["category"],message:string){
  return listingRpc("danest_create_report",{p_listing_id:await listingUuid(id),p_category:category,p_message:message});
}
export async function readReports():Promise<Report[]> {
  const rows=await readPages((from,to)=>supabase.from("reports").select("id,listing_id,reporter_id,reporter_name,category,message,status,created_at,resolved_by,resolution_note,properties(source_id)").order("created_at",{ascending:false}).order("id").range(from,to));
  return rows.map(r=>({id:r.id,listingId:((Array.isArray(r.properties)?r.properties[0]:r.properties) as {source_id:string}|null)?.source_id??r.listing_id,reporterName:r.reporter_name??r.reporter_id,reporterEmail:"",category:r.category,status:r.status,message:r.message,createdAt:r.created_at,resolvedBy:r.resolved_by,resolutionNote:r.resolution_note}));
}
export async function resolveReport(id:string,status:"resolved"|"unresolved",reason:string,hide=false){
  return listingRpc("danest_resolve_report",{p_report_id:id,p_status:status,p_reason:reason,p_hide_listing:hide});
}
export interface Notice {id:string; type:string; payload:Record<string,unknown>; created_at:string; read_at:string|null; inquiry_id:string|null; message_read_at:string|null}
export async function readNotifications(userId:string):Promise<Notice[]> {
  return readPages((from,to)=>supabase.from("notifications").select("id,type,payload,created_at,read_at,inquiry_id,message_read_at").eq("recipient_id",userId).order("created_at",{ascending:false}).order("id").range(from,to));
}
export {isMessageNotice} from "~/lib/inquiry-notices";
export async function markNotification(id:string){ const ok=await listingRpc("danest_mark_notification_read",{p_notification_id:id}); if(!ok) throw new Error("Notification not found"); }
export async function markAllNotifications(){return listingRpc("danest_mark_all_notifications_read",{});}
export interface Campaign {id:string; listing_id:string; kind:string; active:boolean; activated_by:string|null; start_date:string|null; end_date:string|null; ended_at:string|null; created_at:string; title:string; sourceId:string|null}
export async function readCampaigns():Promise<Campaign[]> {
  const rows=await readPages((from,to)=>supabase.from("listing_promotion").select("id,listing_id,kind,active,activated_by,start_date,end_date,ended_at,created_at,properties(title,source_id)").order("created_at",{ascending:false}).order("id").range(from,to));
  return rows.map(r=>{const p=(Array.isArray(r.properties)?r.properties[0]:r.properties) as {title:string;source_id:string}|null;return {...r,title:p?.title??r.listing_id,sourceId:p?.source_id??null};});
}
export async function requestCampaign(id:string){return listingRpc("danest_request_promotion",{p_listing_id:await listingUuid(id),p_kind:"sponsored"});}
export async function decideCampaign(id:string,decision:"activate"|"reject"|"end",reason:string,start:string|null,end:string|null){return listingRpc("danest_decide_promotion",{p_promotion_id:id,p_decision:decision,p_reason:reason,p_start_date:start,p_end_date:end});}
