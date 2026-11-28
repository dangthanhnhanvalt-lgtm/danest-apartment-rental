import { useEffect, useState, type FormEvent } from "react";
import { X, Lock } from "lucide-react";
import { createInquiry, getInquiryContact, readInquiries, type InquiryContact } from "~/api/backend/inquiries";
import { formatUSD } from "~/lib/format";
import { Link } from "~/lib/router";
import { useAppState } from "~/state/app-state";
import { Button } from "~/components/ui/button";
import { useI18n } from "~/i18n/language-context";
import type { Listing } from "~/types";

const localToday = () => { const parts = new Intl.DateTimeFormat("en-CA", {timeZone:"Asia/Ho_Chi_Minh",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date()); return ["year","month","day"].map(k=>parts.find(p=>p.type===k)?.value).join("-"); };
const field = "w-full rounded-lg border border-border bg-background p-2.5 text-sm";
export function ContactCard({listing}:{listing:Listing}) {
  // Remount when identity or listing changes so private contact never persists across accounts.
  const {session}=useAppState();
  return <ContactForm key={`${session?.user.id ?? "guest"}:${session?.user.accountStatus}:${listing.id}`} listing={listing}/>;
}
function ContactForm({listing}:{listing:Listing}) {
  const {session,backendReady}=useAppState(); const {pick,t}=useI18n();
  const allowed=session?.user.role==="tenant" && session.user.accountStatus==="active";
  const [type,setType]=useState<"question"|"viewing-request">("viewing-request");
  const [message,setMessage]=useState(""); const [budget,setBudget]=useState(String(listing.monthlyRent));
  const [duration,setDuration]=useState(String(listing.rentalDurationMonths[0]));
  const [moveIn,setMoveIn]=useState(""); const [occupants,setOccupants]=useState("1");
  const [contact,setContact]=useState<InquiryContact|null>(null); const [sent,setSent]=useState(false);
  const [busy,setBusy]=useState(false); const [error,setError]=useState("");
  useEffect(()=>{let active=true;if(allowed) void readInquiries().then(rows=>{const i=rows.find(r=>r.listingId===listing.id && r.tenantId===session?.user.id);return i?getInquiryContact(i.id):null;}).then(c=>{if(active)setContact(c);}).catch(()=>{if(active)setContact(null);}); return()=>{active=false;};},[allowed,listing.id,session?.user.id]);
  async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();if(!allowed||busy)return;setBusy(true);setError("");try{
    const id=await createInquiry(listing.id,{type,message:message.trim(),budget:Number(budget),duration:Number(duration),moveIn,occupants:Number(occupants)});
    setSent(true);setMessage("");try{setContact(await getInquiryContact(id));}catch{ /* Request succeeded; contact can be retried in My requests. */ }
  }catch(e){setError(e instanceof Error?e.message:String(e));}finally{setBusy(false);}}
  return <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
    <div><p className="text-xs font-semibold uppercase text-muted-foreground">{t("contact.title")}</p><p className="font-heading text-2xl font-semibold">{formatUSD(listing.monthlyRent)}{t("common.perMonth")}</p><p className="text-sm text-muted-foreground">{t("listing.perMonthEstimate")}</p><p className="mt-3 font-medium">{listing.landlord.displayName}</p><p className="text-xs text-muted-foreground">{listing.landlord.languages.join(", ")}</p></div>
    {contact ? <div className="space-y-1 rounded-lg border border-border p-3 text-sm"><p className="font-semibold">{pick("Contact unlocked", "Đã mở thông tin liên hệ")}</p>{contact.name&&<p>{contact.name}</p>}{contact.email&&<a className="block break-all underline" href={`mailto:${contact.email}`}>{contact.email}</a>}{contact.phone&&<a className="block underline" href={`tel:${contact.phone}`}>{contact.phone}</a>}</div>:<p className="flex gap-2 rounded-lg bg-muted p-3 text-xs"><Lock className="size-4 shrink-0"/>{t("contact.privateHint")}</p>}
    {!backendReady?<p>{pick("Checking account…","Đang kiểm tra tài khoản…")}</p>:!session?<Button asChild className="w-full"><Link to="/login?intent=inquire">{t("contact.loginButton")}</Link></Button>:!allowed?<p className="text-sm">{pick("An active renter account is required.","Cần tài khoản người thuê đang hoạt động.")}</p>:sent?<div className="space-y-3 rounded-lg bg-accent p-3"><p>{pick("Request saved. Wait for the landlord's reply before scheduling a viewing.","Đã gửi yêu cầu. Hãy chờ chủ nhà phản hồi trước khi hẹn lịch xem.")}</p><Button asChild><Link to="/requests">{pick("My requests","Yêu cầu của tôi")}</Link></Button></div>:<form className="space-y-3" onSubmit={submit}>
      <label className="block text-sm">{pick("Request type","Loại yêu cầu")}<select className={field} value={type} onChange={e=>setType(e.target.value as typeof type)}><option value="viewing-request">{pick("Request a viewing","Yêu cầu xem nhà")}</option><option value="question">{pick("Ask a question","Hỏi thông tin")}</option></select></label>
      <label className="block text-sm">{pick("Monthly budget (USD)","Ngân sách tháng (USD)")}<input required type="number" min="1" step="0.01" max="9999999999.99" className={field} value={budget} onChange={e=>setBudget(e.target.value)}/></label>
      <div className="grid grid-cols-2 gap-2"><label className="text-sm">{pick("Months","Số tháng thuê")}<input required type="number" min={Math.max(1,listing.rentalDurationMonths[0])} max={Math.min(12,listing.rentalDurationMonths[1])} className={field} value={duration} onChange={e=>setDuration(e.target.value)}/></label><label className="text-sm">{pick("Occupants","Số người ở")}<input required type="number" min="1" max="2147483647" className={field} value={occupants} onChange={e=>setOccupants(e.target.value)}/></label></div>
      <label className="block text-sm">{pick("Move-in date","Ngày dự kiến chuyển vào")}<input required type="date" min={localToday()} className={field} value={moveIn} onChange={e=>setMoveIn(e.target.value)}/></label>
      <label className="block text-sm">{pick("Message","Nội dung yêu cầu")}<textarea required maxLength={4000} rows={3} className={field} value={message} onChange={e=>setMessage(e.target.value)}/></label>
      {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={busy} className="w-full">{busy?pick("Sending…","Đang gửi…"):pick("Send request","Gửi yêu cầu thuê")}</Button>
      <Link to="/requests" className="block text-center text-sm underline">{pick("My requests","Yêu cầu của tôi")}</Link>
      <p className="text-xs text-muted-foreground">{pick("Viewing time is agreed in the conversation after a landlord replies. Listings without an active owner cannot accept requests.","Lịch xem được thống nhất trong cuộc trao đổi sau khi chủ nhà phản hồi. Tin chưa có chủ nhà hoạt động không thể nhận yêu cầu.")}</p>
    </form>}
  </section>;
}

export function ContactBar({ listing }: { listing: Listing }) {
  const [open, setOpen] = useState(false);
  const { t } = useI18n();
  return (
    <>
      <div className="fixed inset-x-0 bottom-0 z-[70] border-t border-border bg-card px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 lg:hidden">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">{formatUSD(listing.monthlyRent)}{t("common.perMonth")}</p>
            <p className="truncate text-xs text-muted-foreground">{t("contact.responseUnknown")}</p>
          </div>
          <Button size="lg" onClick={() => setOpen(true)}>
            {t("contact.title")}
          </Button>
        </div>
      </div>

      {open ? (
        <div className="fixed inset-0 z-[85] lg:hidden">
          <div className="absolute inset-0" style={{ backgroundColor: "var(--overlay-bg)" }} onClick={() => setOpen(false)} aria-hidden="true" />
          <div role="dialog" aria-modal="true" aria-label={t("contact.title")} className="absolute inset-x-0 bottom-0 max-h-[92dvh] overflow-y-auto overscroll-contain rounded-t-2xl bg-card pb-[env(safe-area-inset-bottom)]">
            <div className="sticky top-0 flex items-center justify-between border-b border-border bg-card px-5 py-4">
              <h2 className="text-lg font-semibold text-foreground">{t("contact.title")}</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={t("contact.closeForm")}
                className="flex size-10 items-center justify-center rounded-full text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>
            <div className="p-4">
              <ContactCard listing={listing} />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
