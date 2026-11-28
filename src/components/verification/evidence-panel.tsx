import { useCallback, useEffect, useState } from "react";
import { Button } from "~/components/ui/button";
import { useI18n } from "~/i18n/language-context";
import { downloadEvidence, listEvidence, reviewEvidence, setVerification, uploadEvidence, type EvidenceDecision, type EvidenceKind, type EvidenceRecord } from "~/api/backend/evidence";
import type { Listing } from "~/types";

export function EvidencePanel({listing,admin=false,onChanged}:{listing:Listing;admin?:boolean;onChanged?:()=>Promise<void>|void}) {
  const {pick} = useI18n();
  const [records,setRecords] = useState<EvidenceRecord[]>([]);
  const [loaded,setLoaded] = useState(false);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");
  const [notice,setNotice] = useState("");
  const [kind,setKind] = useState<EvidenceKind>("identity");
  const [file,setFile] = useState<File|null>(null);
  const [fileKey,setFileKey] = useState(0);
  const [reason,setReason] = useState("");
  const [opened,setOpened] = useState<string[]>([]);
  const load = useCallback(async()=>{setRecords(await listEvidence(listing.id));setLoaded(true);},[listing.id]);
  useEffect(()=>{let live=true;setLoaded(false);setRecords([]);setOpened([]);setError("");setNotice("");void listEvidence(listing.id).then(r=>{if(live){setRecords(r);setLoaded(true);}}).catch(e=>{if(live)setError(e instanceof Error?e.message:String(e));});return()=>{live=false;};},[listing.id]);
  const kinds: Record<EvidenceKind,string> = {identity:pick("Identity proof","Minh chứng định danh"),"rental-authorization":pick("Right to rent / ownership proof","Minh chứng quyền cho thuê / sở hữu"),"listing-proof":pick("Supporting listing proof","Minh chứng bổ sung về căn hộ")};
  const decisions: Record<EvidenceDecision,string> = {approved:pick("Approved","Đã chấp thuận"),rejected:pick("Rejected","Đã từ chối"),"corrections-requested":pick("Corrections requested","Yêu cầu bổ sung")};
  const pending = records.filter(r=>!r.review_id);
  const hasStale = pending.some(r=>r.stale);
  const hasBoth = pending.some(r=>r.kind==="identity") && pending.some(r=>r.kind==="rental-authorization");
  const canReview = admin && loaded && !listing.isSample && !listing.verificationBadge && pending.length>0;
  const canApprove = canReview && !hasStale && hasBoth && pending.every(r=>opened.includes(r.id));
  const latestReviewed = [...records].reverse().find(r=>r.review_id);
  const canGrant = admin && loaded && !listing.isSample && !listing.verificationBadge && listing.status==="published" && !pending.length && latestReviewed?.decision==="approved" && !latestReviewed.stale;
  const canUpload = !hasStale && !admin && !listing.isSample && !listing.verificationBadge && ["draft","pending","needs-attention","published","paused","rejected"].includes(listing.status);
  const run = async (fn:()=>Promise<void>, success:string) => {setBusy(true);setError("");setNotice("");try{await fn();setNotice(success);}catch(e){setError(e instanceof Error?e.message:String(e));}finally{setBusy(false);}};
  const review = (decision:EvidenceDecision) => {if(!reason.trim())return;void run(async()=>{await reviewEvidence(listing.id,decision,reason.trim());setOpened([]);setReason("");await load();},pick("Evidence decision saved. Badge is unchanged.","Đã lưu quyết định minh chứng. Huy hiệu chưa thay đổi."));};
  const badge = (value:boolean) => {if(!reason.trim())return;void run(async()=>{await setVerification(listing.id,value,reason.trim());await onChanged?.();},pick("Verification level updated.","Đã cập nhật mức xác minh."));};
  return <section className="space-y-3 rounded-lg border border-border p-3 text-sm" aria-label={pick("Verification evidence","Minh chứng xác minh")}>
    <h3 className="font-semibold">{pick("Verification evidence","Minh chứng xác minh")}</h3>
    <p className="text-xs text-muted-foreground">{pick("Files are private. Evidence approval and the public verification badge are separate decisions.","Giấy tờ được lưu riêng tư. Chấp thuận minh chứng và cấp huy hiệu công khai là hai quyết định riêng.")}</p>
    {listing.isSample ? <p className="text-xs text-muted-foreground">{pick("Demo listings cannot be verified.","Không xác minh tin demo.")}</p> : null}
    {error && <p role="alert" className="break-words text-destructive">{error}</p>}
    {notice && <p role="status" className="text-success">{notice}</p>}
    <Button type="button" size="sm" variant="outline" disabled={busy} onClick={()=>void run(load,pick("Evidence refreshed.","Đã tải lại minh chứng."))}>{pick("Refresh evidence","Tải lại minh chứng")}</Button>
    {!loaded&&!error&&<p>{pick("Loading…","Đang tải…")}</p>}
    {loaded&&!records.length&&<p className="text-muted-foreground">{pick("No evidence submitted.","Chưa có minh chứng.")}</p>}
    {hasStale && <p role="status" className="rounded border border-warning/30 p-2 text-xs">{pick("Pending evidence predates the latest edit. Admin must request corrections before a fresh batch is submitted.","Minh chứng chờ duyệt thuộc phiên bản tin cũ. Admin cần yêu cầu bổ sung trước khi chủ nhà nộp đợt mới.")}</p>}
    <ul className="space-y-2">{records.map(r=><li key={r.id} className="space-y-1 rounded-md border border-border p-2">
      <p className="font-medium">{kinds[r.kind]} · {r.decision?decisions[r.decision]:pick("Pending review","Chờ xét duyệt")}</p>
      <p className="text-xs text-muted-foreground">{new Date(r.uploaded_at).toLocaleString()}</p>
      {r.stale&&<p className="text-xs text-warning">{pick("Previous listing version","Phiên bản tin trước")}</p>}
      {r.reason&&<p className="break-words text-xs">{r.reason}</p>}
      {admin&&<Button type="button" variant="outline" size="sm" disabled={busy} onClick={()=>void run(async()=>{await downloadEvidence(r.id);setOpened(old=>[...new Set([...old,r.id])]);},pick("Download initiated. Open the file locally and inspect it.","Đã yêu cầu tải file. Hãy mở file trên máy và kiểm tra."))}>{opened.includes(r.id)?pick("Download again","Tải lại"):pick("Download for review","Tải để kiểm tra")}</Button>}
    </li>)}</ul>
    {canUpload&&loaded&&<form className="space-y-2" onSubmit={e=>{e.preventDefault();if(!file)return;void run(async()=>{await uploadEvidence(listing.id,kind,file);setFile(null);setFileKey(k=>k+1);await load();},pick("Evidence submitted for admin review.","Đã gửi minh chứng cho Admin."));}}>
      <p className="text-xs">{pick("Submit identity and rental-right proof in the same batch. Use test documents only for now.","Nộp minh chứng định danh và quyền cho thuê cùng đợt. Hiện chỉ dùng giấy tờ giả lập để kiểm thử.")}</p>
      <label className="block text-xs font-medium">{pick("Evidence type","Loại minh chứng")}<select className="mt-1 block w-full rounded-md border border-input bg-background p-2" value={kind} disabled={busy} onChange={e=>setKind(e.target.value as EvidenceKind)}>{Object.entries(kinds).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
      <label className="block text-xs font-medium">{pick("JPEG, PNG, PDF (max 10 MB)","JPEG, PNG, PDF (tối đa 10 MB)")}<input key={fileKey} className="mt-1 block w-full text-xs" type="file" accept="image/jpeg,image/png,application/pdf" disabled={busy} onChange={e=>setFile(e.target.files?.[0]??null)}/></label>
      <Button type="submit" size="sm" disabled={busy||!file}>{pick("Submit evidence","Nộp minh chứng")}</Button>
    </form>}
    {admin&&!listing.isSample&&loaded&&<div className="space-y-2 border-t border-border pt-3">
      <label className="block text-xs font-medium">{pick("Reason for evidence / verification decision","Lý do quyết định minh chứng / xác minh")}<textarea value={reason} onChange={e=>setReason(e.target.value)} maxLength={1000} disabled={busy} className="mt-1 block min-h-20 w-full rounded-md border border-input bg-background p-2"/></label>
      {canReview&&<><p className="text-xs text-muted-foreground">{pick("Approval requires both document types and downloading every pending file. Inspect them before approving.","Chấp thuận cần đủ hai loại giấy tờ và tải từng file đang chờ. Hãy kiểm tra nội dung trước khi duyệt.")}</p><div className="flex flex-wrap gap-2"><Button type="button" size="sm" disabled={busy||!canApprove||!reason.trim()} onClick={()=>review("approved")}>{pick("Approve evidence","Chấp thuận minh chứng")}</Button><Button type="button" size="sm" variant="outline" disabled={busy||!reason.trim()} onClick={()=>review("corrections-requested")}>{pick("Request corrections","Yêu cầu bổ sung")}</Button><Button type="button" size="sm" variant="destructive" disabled={busy||!reason.trim()} onClick={()=>review("rejected")}>{pick("Reject evidence","Từ chối minh chứng")}</Button></div></>}
      <p className="text-xs font-medium">{pick("Public verification:","Xác minh công khai:")} {listing.verificationBadge?pick("Basic verified","Xác minh cơ bản"):pick("Unverified","Chưa xác minh")}</p>
      {listing.verificationBadge?<Button type="button" size="sm" variant="outline" disabled={busy||!reason.trim()} onClick={()=>badge(false)}>{pick("Revoke verification","Thu hồi xác minh")}</Button>:<Button type="button" size="sm" disabled={busy||!canGrant||!reason.trim()} onClick={()=>badge(true)}>{pick("Grant Basic Verified","Cấp xác minh cơ bản")}</Button>}
      {!listing.verificationBadge&&!canGrant&&<p className="text-xs text-muted-foreground">{pick("Publish the listing and approve the evidence batch first. The server also checks the latest moderation and verification requirements.","Cần duyệt công khai tin và chấp thuận minh chứng trước. Backend còn kiểm tra kết quả kiểm duyệt và xác minh mới nhất.")}</p>}
    </div>}
  </section>;
}
