import { supabase } from "~/lib/supabase";
import { listingRpc, listingUuid } from "~/api/supabase-listings";
import type { Inquiry, InquiryStatus } from "~/types";

export interface RentalInquiry extends Inquiry {
  listingUuid: string; title: string; proposedBy: string | null; budget: number | null; occupants: number | null;
}
export interface InquiryMessage { id: string; sender_id: string; body: string; created_at: string }
export interface InquiryHistory { id: string; from_status: InquiryStatus | null; to_status: InquiryStatus; changed_at: string; note: string | null }
export interface InquiryContact { name: string | null; email: string | null; phone: string | null }

// RLS is the authority for every read; no client-provided identity is trusted.
export async function readInquiries(): Promise<RentalInquiry[]> {
  const {data,error} = await supabase.from("inquiries").select("id,listing_id,tenant_id,type,message,move_in_date,duration_months,tenant_preferences,status,created_at,updated_at,scheduled_at,preferred_time,proposed_at,proposed_by,first_requested_at,first_responded_at,budget,occupant_count,properties(source_id,title)").order("created_at",{ascending:false});
  if(error) throw new Error(error.message);
  return (data ?? []).map(row => {
    const p = (Array.isArray(row.properties) ? row.properties[0] : row.properties) as {source_id?:string;title?:string} | null;
    return {id:row.id, listingUuid:row.listing_id, listingId:p?.source_id ?? row.listing_id,title:p?.title ?? row.listing_id, tenantId:row.tenant_id,tenantName:row.tenant_id.slice(0,8),tenantEmail:"",type:row.type,status:row.status,message:row.message,moveInDate:row.move_in_date,durationMonths:row.duration_months,tenantPreferences:row.tenant_preferences ?? [],createdAt:row.created_at,updatedAt:row.updated_at,scheduledAt:row.scheduled_at,preferredTime:row.preferred_time,proposedAt:row.proposed_at,proposedBy:row.proposed_by,firstRequestedAt:row.first_requested_at,firstRespondedAt:row.first_responded_at,budget:row.budget,occupants:row.occupant_count};
  });
}
export async function readMessages(id:string):Promise<InquiryMessage[]> {
  const rows:InquiryMessage[]=[];
  for(let offset=0;;offset+=100){
    const {data,error}=await supabase.from("inquiry_messages").select("id,sender_id,body,created_at").eq("inquiry_id",id).order("created_at").order("id").range(offset,offset+99);
    if(error)throw new Error(error.message);rows.push(...(data??[]));if(!data||data.length<100)return rows;
  }
}
export async function readHistory(id:string):Promise<InquiryHistory[]> {
  const {data,error}=await supabase.from("inquiry_status_history").select("id,from_status,to_status,changed_at,note").eq("inquiry_id",id).order("changed_at");
  if(error) throw new Error(error.message); return data ?? [];
}
export async function createInquiry(sourceId:string,input:{type:Inquiry["type"];message:string;budget:number;duration:number;moveIn:string;occupants:number}):Promise<string> {
  return listingRpc("danest_create_inquiry",{p_listing_id:await listingUuid(sourceId),p_type:input.type,p_message:input.message,p_budget:input.budget,p_duration_months:input.duration,p_move_in_date:input.moveIn,p_occupant_count:input.occupants,p_preferences:[]});
}
export const sendInquiryMessage=(id:string,message:string)=>listingRpc("danest_send_inquiry_message",{p_inquiry_id:id,p_message:message});
export const proposeViewing=(id:string,date:string)=>listingRpc("danest_propose_viewing",{p_inquiry_id:id,p_proposed_at:date});
export const confirmViewing=(id:string,date:string)=>listingRpc("danest_confirm_viewing",{p_inquiry_id:id,p_expected_at:date});
export const closeInquiry=(id:string,status:"rented"|"not_proceeding")=>listingRpc("danest_close_inquiry",{p_inquiry_id:id,p_status:status});
export const getInquiryContact=async(id:string):Promise<InquiryContact>=>listingRpc("danest_get_inquiry_contact",{p_inquiry_id:id});

export const cancelProposal=(id:string,date:string,by:string)=>listingRpc("danest_cancel_proposal_09c2",{p_inquiry_id:id,p_expected_at:date,p_expected_by:by});
export async function markMessagesRead(id:string,ids:string[]){for(let offset=0;offset<ids.length;offset+=100)await listingRpc("danest_mark_messages_read_09c2",{p_inquiry_id:id,p_notice_ids:ids.slice(offset,offset+100)});}
