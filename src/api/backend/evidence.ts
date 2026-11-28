import { supabase } from "~/lib/supabase";
import { listingUuid, listingRpc } from "~/api/supabase-listings";

export type EvidenceKind = "identity" | "rental-authorization" | "listing-proof";
export type EvidenceDecision = "approved" | "rejected" | "corrections-requested";
export interface EvidenceRecord {
  id: string;
  kind: EvidenceKind;
  uploaded_at: string;
  review_id: string | null;
  decision: EvidenceDecision | null;
  reason: string | null;
  stale?: boolean;
}
const fileTypes: Record<string,string> = {"image/jpeg":"jpg", "image/png":"png", "application/pdf":"pdf"};
export async function listEvidence(id: string): Promise<EvidenceRecord[]> {
  return await listingRpc("danest_list_evidence", {p_listing_id: await listingUuid(id)}) as EvidenceRecord[];
}
export async function uploadEvidence(id: string, kind: EvidenceKind, file: File) {
  const ext = fileTypes[file.type];
  if (!ext || file.size === 0 || file.size > 10*1024*1024) throw new Error("JPEG, PNG or PDF only; maximum 10 MB.");
  const {data, error} = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("Please sign in again.");
  const uuid = await listingUuid(id);
  const path = `${data.user.id}/${uuid}/${crypto.randomUUID()}.${ext}`;
  const upload = await supabase.storage.from("verification-evidence").upload(path, file, {contentType:file.type,upsert:false});
  if (upload.error) throw new Error(upload.error.message);
  try { await listingRpc("danest_register_evidence", {p_listing_id:uuid,p_kind:kind,p_path:path}); }
  catch (err) { throw new Error(`File uploaded but registration failed; contact support. ${err instanceof Error ? err.message : String(err)}`); }
}
export async function reviewEvidence(id: string, decision: EvidenceDecision, reason: string) {
  await listingRpc("danest_review_evidence", {p_listing_id:await listingUuid(id),p_decision:decision,p_reason:reason});
}
export async function setVerification(id: string, badge: boolean, reason: string) {
  await listingRpc("danest_set_verification", {p_listing_id:await listingUuid(id),p_level:badge?"basic_verified":"unverified",p_reason:reason});
}
export async function downloadEvidence(id: string) {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) throw new Error("Please sign in again.");
  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL.replace(/\/$/, "")}/functions/v1/danest-evidence-download`, {
    method:"POST", headers:{Authorization:`Bearer ${data.session.access_token}`,apikey:import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,"Content-Type":"application/json"}, body:JSON.stringify({evidence_id:id}), cache:"no-store"
  });
  if (!response.ok) {
    const body = await response.json().catch(()=>null);
    throw new Error(body?.error || `Evidence download failed (${response.status})`);
  }
  const blob = await response.blob();
  const ext = fileTypes[blob.type];
  if (!ext || !blob.size || blob.size > 10*1024*1024) throw new Error("Invalid evidence response.");
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `danest-evidence-${id}.${ext}`;
  document.body.append(a); a.click(); a.remove();
  window.setTimeout(()=>URL.revokeObjectURL(url), 1000);
}
