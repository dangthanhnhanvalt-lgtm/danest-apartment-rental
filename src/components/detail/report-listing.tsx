import { useState } from "react";
import { createReport } from "~/api/backend/engagement";
import { useAppState } from "~/state/app-state";
import { useI18n } from "~/i18n/language-context";
import { Button } from "~/components/ui/button";
import { Link } from "~/lib/router";
import type { Report } from "~/types";
export function ReportListing({listingId}:{listingId:string}) {
  const {session}=useAppState(); const {pick}=useI18n();
  const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[done,setDone]=useState(false),[error,setError]=useState("");
  const [category,setCategory]=useState<Report["category"]>("inaccurate"),[message,setMessage]=useState("");
  const allowed=session?.user.accountStatus==="active" && ["tenant","landlord"].includes(session.user.role);
  const categories: [Report["category"],string,string][]=[["inaccurate","Incorrect information","Thông tin sai"],["hidden-fees","Hidden fees","Chi phí ẩn"],["duplicate","Duplicate","Tin trùng"],["misleading-photos","Misleading photos","Ảnh gây hiểu nhầm"],["other","Other","Khác"]];
  return <section className="mt-4 rounded-xl border border-border bg-card p-4 space-y-3">
    <Button type="button" variant="outline" onClick={()=>setOpen(!open)}>{pick("Report listing","Phản ánh tin đăng")}</Button>
    {open && (!allowed ? <p>{pick("An active renter or landlord account is required.","Cần tài khoản người thuê hoặc chủ nhà đang hoạt động.")} {!session && <Link to="/login" className="text-link underline">{pick("Sign in","Đăng nhập")}</Link>}</p> : <form className="space-y-3" onSubmit={async e=>{e.preventDefault();if(busy)return;setBusy(true);setError("");setDone(false);try{await createReport(listingId,category,message.trim());setDone(true);setMessage("");}catch(e){setError(e instanceof Error?e.message:String(e));}finally{setBusy(false);}}}>
      <label className="block text-sm">{pick("Category","Lý do")}<select className="mt-1 w-full rounded-md border bg-background p-2" value={category} onChange={e=>setCategory(e.target.value as Report["category"])}>{categories.map(([id,en,vi])=><option key={id} value={id}>{pick(en,vi)}</option>)}</select></label>
      <label className="block text-sm">{pick("Description","Nội dung phản ánh")}<textarea required maxLength={2000} className="mt-1 w-full rounded-md border bg-background p-2" value={message} onChange={e=>setMessage(e.target.value)}/></label>
      <Button type="submit" disabled={busy || !message.trim()}>{pick("Send report","Gửi phản ánh")}</Button>
      {done && <p role="status" className="text-success">{pick("Report sent to administrators.","Đã gửi phản ánh đến quản trị viên.")}</p>}{error && <p role="alert" className="text-destructive">{error}</p>}
    </form>)}
  </section>;
}
