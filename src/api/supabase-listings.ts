import { supabase } from "~/lib/supabase";
import type { Listing } from "~/types";

type ListingRow = { id:string; source_id:string|null; owner_id:string|null; status:string; availability:string; is_demo:boolean; updated_at?:string; listing_data:Listing|null; verification_level:string; verified_at:string|null; verified_scope:string[]; last_availability_confirmed_at:string|null; availability_reminder_sent_at:string|null; availability_hidden_at:string|null };
const requireResult = <T,>(data: T, error: { message: string } | null): T => { if (error) throw new Error(error.message); return data; };
export async function listingUuid(id: string): Promise<string> {
  const { data, error } = await supabase.from("properties").select("id").eq("source_id", id).single();
  if (error || !data) throw new Error(error?.message ?? "Listing not found");
  return data.id;
}
export async function listingRpc(name: string, params: Record<string, unknown>) {
  const { data, error } = await supabase.rpc(name, params);
  return requireResult(data, error);
}
async function readListings(scope: "public" | "owner" | "admin"): Promise<Listing[]> {
  const rows: ListingRow[] = [];
  for(let offset=0;;offset+=100){
    const {data,error}=await supabase.rpc("danest_read_listings_08a",{p_scope:scope,p_offset:offset,p_limit:100});
    const page = requireResult(data,error) as ListingRow[];
    if(!Array.isArray(page)) throw new Error("Invalid listing response");
    rows.push(...page);
    if(page.length<100) break;
  }
  if (!rows.length) return [];
  const pics: {id:string;listing_id:string;url:string;storage_path:string|null;position:number}[]=[];
  for(let offset=0;offset<rows.length;offset+=50){
    const ids=rows.slice(offset,offset+50).map(r=>r.id);
    for(let from=0;;from+=100){
      const {data,error}=await supabase.from("listing_image").select("id,listing_id,url,storage_path,position").in("listing_id",ids).order("listing_id").order("position").range(from,from+99);
      const page=requireResult(data,error)??[];
      pics.push(...page);
      if(page.length<100) break;
    }
  }
  const paths = [...new Set(pics.flatMap(p => p.storage_path ? [p.storage_path as string] : []))];
  const signed = new Map<string,string>();
  // Never persist signed URLs or expose them through public bucket URLs.
  if (paths.length) {
    for(let i=0;i<paths.length;i+=100){
      const { data: urls, error: urlError } = await supabase.storage.from("listing-images").createSignedUrls(paths.slice(i,i+100), 1800);
      if (urlError) console.warn("Could not sign some listing images", urlError.message);
      for (const u of urls ?? []) if (u.path && u.signedUrl) signed.set(u.path, u.signedUrl);
    }
  }
  const promotions = await supabase.rpc("danest_public_promotions");
  if(promotions.error) console.warn("Promotion eligibility unavailable",promotions.error.message);
  const promoted = new Set<string>((promotions.data ?? []).map((p:{listing_id:string})=>p.listing_id));
  return rows.filter(r => r.source_id && r.listing_data?.title).map(r => {
    const l = r.listing_data as Listing;
    const images = pics.filter(p => p.listing_id === r.id).flatMap(p => p.storage_path ? (signed.has(p.storage_path) ? [signed.get(p.storage_path)!] : []) : [p.url]);
    const verified = !r.is_demo && r.verification_level === "basic_verified";
    const verification: Listing["verification"] = {
      lastAvailabilityConfirmed: r.last_availability_confirmed_at ?? null,
      checks: ([
        ["listing-info", "Listing information", "Review of listing details."],
        ["landlord-identity", "Landlord identity", "Review of landlord identity evidence."],
        ["rental-authorization", "Right to rent", "Review of the right to rent the apartment."],
      ] as const).map(([id,label,description])=>({id,label,description,status:verified && Array.isArray(r.verified_scope) && r.verified_scope.includes(id)?"verified":"not-started",lastUpdated:verified && Array.isArray(r.verified_scope) && r.verified_scope.includes(id)?r.verified_at:null})),
    };
    return {...l, updatedAt:r.updated_at, id:r.source_id!, landlordId:r.owner_id ?? l.landlordId, status:r.status as Listing["status"], isSample:r.is_demo, availability:r.availability as Listing["availability"], featured:promoted.has(r.id), sponsored:promoted.has(r.id),
      images: images.length ? images : r.is_demo ? l.images : [],
      imageRecords: scope === "owner" ? pics.filter(p=>p.listing_id===r.id).map(p=>({id:p.id,url:p.storage_path ? signed.get(p.storage_path) ?? null : p.url})) : undefined,
      verificationBadge: verified,
      verification,
      lastAvailabilityConfirmedAt: r.last_availability_confirmed_at ?? "",
      availabilityReminderSentAt: r.availability_reminder_sent_at ?? null,
      availabilityHiddenAt:r.availability_hidden_at??null,
    };
  });
}
export const getSupabaseListings = () => readListings("public");
export const getAdminSupabaseListings = () => readListings("admin");
export const getMySupabaseListings = () => readListings("owner");
export async function saveSupabaseListing(listing: Listing, id?: string, photos?: {snapshot:string[];order:string[]}, draftOnly=false): Promise<string> {
  return listingRpc("danest_save_listing", {p_listing_id:id ?? null,p_data:{...listing,draftOnly,...(photos ? {photoSnapshot:photos.snapshot,photoOrder:photos.order}: {})}});
}
export async function uploadListingPhoto(uuid: string, file: File): Promise<void> {
  const ext = ({"image/jpeg":"jpg","image/png":"png","image/webp":"webp"} as Record<string,string>)[file.type];
  if (!ext || file.size > 5*1024*1024 || file.size === 0) throw new Error("Only JPEG/PNG/WEBP up to 5 MB");
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("Please sign in");
  const path = `${data.user.id}/${uuid}/${crypto.randomUUID()}.${ext}`;
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",await file.arrayBuffer())),b=>b.toString(16).padStart(2,"0")).join("");
  const uploaded = await supabase.storage.from("listing-images").upload(path,file,{contentType:file.type,upsert:false});
  if (uploaded.error) throw new Error(uploaded.error.message);
  await listingRpc("danest_register_image_hash_10a11", {p_listing_id:uuid,p_path:path,p_sha256:hash});
}
export async function submitSupabaseListing(uuid: string): Promise<{status:Listing["status"]; moderation:Listing["moderation"]}> {
  return listingRpc("danest_submit_listing", {p_listing_id:uuid});
}
