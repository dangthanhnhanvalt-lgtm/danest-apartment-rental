import { readReports, resolveReport } from "~/api/backend/engagement";
import { getAdminSupabaseListings, listingUuid, listingRpc } from "~/api/supabase-listings";
import { supabase } from "~/lib/supabase";
import type { AdminSettings, AuditLogEntry, Listing, ListingStatus, Report } from "~/types";

export const adminListingRepository = {
  list: getAdminSupabaseListings,
  updateStatus: async (id: string, _status: ListingStatus, reason: string, action: AuditLogEntry["action"]): Promise<Listing> => {
    const uuid = await listingUuid(id);
    const decisions: Record<string,string> = {"listing-approved":"approved","listing-rejected":"rejected","listing-corrections-requested":"corrections-requested","listing-hidden":"hidden","listing-restored":"restored"};
    if (!decisions[action]) throw new Error("Unsupported moderation action");
    await listingRpc("danest_moderate_listing", {p_listing_id:uuid,p_decision:decisions[action],p_reason:reason});
    const next = (await getAdminSupabaseListings()).find(l=>l.id===id);
    if (!next) throw new Error("Listing updated; refresh the list");
    return next;
  },
  setVerification: async (id: string, badge: boolean, reason: string) => {
    await listingRpc("danest_set_verification", {p_listing_id:await listingUuid(id),p_level:badge?"basic_verified":"unverified",p_reason:reason});
  },

  reconfirmAvailability: async (id:string, reason:string) => listingRpc("danest_reconfirm_availability", {p_listing_id:await listingUuid(id),p_reason:reason}),
};
export const adminReportRepository = {
  list: readReports,
  update: async (id:string,patch:Partial<Report>) => {
    if(patch.status!=="resolved" && patch.status!=="unresolved") throw new Error("Invalid report status");
    await resolveReport(id,patch.status,patch.resolutionNote??"");
  },
};


export const adminAuditRepository = {
  async list(limit?:number):Promise<AuditLogEntry[]> {
    if(limit!==undefined && (!Number.isInteger(limit)||limit<1)) throw new Error("Invalid audit limit");
    const rows:AuditLogEntry[]=[];
    for(let offset=0;;offset+=100){
      const size=limit===undefined?100:Math.min(100,limit-offset);
      if(size<=0) return rows;
      const {data,error}=await supabase.from("audit_log").select("id,actor_type,actor_id,action,target_type,target_id,target_label,reason,old_values,new_values,seed_key,created_at").order("created_at",{ascending:false}).order("id").range(offset,offset+size-1);
      if(error) throw new Error(error.message);
      for(const r of data??[]) rows.push({id:r.id,action:r.action,actor:r.actor_type==="system"?"SYSTEM":`${r.actor_type} · ${r.actor_id}`,target:r.target_label??`${r.target_type} · ${r.target_id??"—"}`,reason:r.reason??"—",createdAt:r.created_at,oldValues:r.old_values,newValues:r.new_values,isSeeded:!!r.seed_key});
      if(!data || data.length<size || (limit!==undefined && rows.length>=limit)) return rows;
    }
  },
};
export const adminSettingsRepository = {
  async get():Promise<AdminSettings>{
    const {data,error}=await supabase.from("admin_settings").select("availability_reminder_days,availability_grace_days").eq("singleton",true).single();
    if(error || !data) throw new Error(error?.message??"Settings not found");
    return {availabilityReminderDays:data.availability_reminder_days,availabilityGraceDays:data.availability_grace_days};
  },
  async set(settings:AdminSettings,reason:string){
    await listingRpc("danest_update_settings",{p_reminder_days:settings.availabilityReminderDays,p_grace_days:settings.availabilityGraceDays,p_reason:reason});
  },
};
export interface AdminKpis {
  activeListings:number; completePercent:number|null; verifiedPercent:number|null; inquiries:number;
  averageFirstResponseHours:number|null; medianFirstResponseHours:number|null; responseWithin24HoursPercent:number|null;
  responseWithin24HoursDenominator:number; viewingConversionPercent:number|null; overduePercent:number|null;
  overdueListings:number; unknownConfirmationListings:number; awaitingResponse24Hours:number;
  counts:Record<ListingStatus,number>; requiringAttention:number; totalUsers:number; sponsoredListings:number;
  demoListings:number; includesDemo:boolean; asOf:string;
}
export async function readAdminKpis():Promise<AdminKpis>{
  const data=await listingRpc("danest_admin_kpis",{p_include_demo:false});
  if(!data || typeof data.activeListings!=="number" || !data.counts) throw new Error("KPI response unavailable");
  return data as AdminKpis;
}
export interface LandlordKpiRow {listing_id:string; title:string; status:ListingStatus; inquiries:number; confirmedViewings:number; rented:number; views:number|null}
export async function readLandlordKpis():Promise<LandlordKpiRow[]>{
  const data=await listingRpc("danest_landlord_kpis",{});
  if(!data || !Array.isArray(data.listings)) throw new Error("KPI response unavailable");
  return data.listings as LandlordKpiRow[];
}
