import { useEffect, useMemo, useState } from "react";
import { vietnamDay } from "~/lib/reporting";
import { humaniseAction } from "~/pages/admin/admin-helpers";
import { Search } from "lucide-react";
import type { AuditLogEntry } from "~/types";
import { adminAuditRepository } from "~/api/admin";
import { useAdmin } from "~/state/admin-state";
import { Field, Input, Select } from "~/components/ui/form";
import {
  Card,
  EmptyState,
  LoadingRows,
  PageFooter,
  PageHeader,
} from "~/pages/admin/shared";
import {
  AUDIT_ACTION_LABEL_KEY,
  auditActionTone,
  auditToneClass,
  tdClass,
  thClass,
} from "~/pages/admin/admin-helpers";
import { Pill } from "~/pages/admin/pills";
import { useI18n } from "~/i18n/language-context";

function toneToPill(tone: ReturnType<typeof auditActionTone>) {
  if (tone === "success" || tone === "info") return "done" as const;
  if (tone === "danger") return "danger" as const;
  if (tone === "warning") return "attention" as const;
  return "neutral" as const;
}

export function AuditPage() {
  const { t, pick } = useI18n();
  const { audit: recentAudit, users, loading: adminLoading } = useAdmin();
  const [audit,setAudit]=useState<AuditLogEntry[]>([]);
  const [loading,setLoading]=useState(true),[loadError,setLoadError]=useState("");
  const [refreshKey,setRefreshKey]=useState(0);
  useEffect(()=>{
    let cancelled=false;
    setLoading(true);setLoadError("");
    void adminAuditRepository.list().then(rows=>{if(!cancelled)setAudit(rows);}).catch(err=>{if(!cancelled){setAudit([]);setLoadError(err instanceof Error?err.message:String(err));}}).finally(()=>{if(!cancelled)setLoading(false);});
    return ()=>{cancelled=true;};
  },[recentAudit,refreshKey]);
  const [action, setAction] = useState<"all" | AuditLogEntry["action"]>("all");
  const [query, setQuery] = useState("");
  const [from,setFrom]=useState(""),[through,setThrough]=useState(""),[role,setRole]=useState("all"),[page,setPage]=useState(0);
  const actorNames=useMemo(()=>new Map(users.map(u=>[u.id,u.name])),[users]);
  const actorLabel=(a:string)=>{const id=a.split(" · ")[1];return id&&actorNames.get(id)?`${actorNames.get(id)} · ${a}`:a;};

  const actions=useMemo(()=>Array.from(new Set(audit.map(a=>a.action))).sort(),[audit]);
  const label=(a:string)=>AUDIT_ACTION_LABEL_KEY[a]?t(AUDIT_ACTION_LABEL_KEY[a]):({"availability-confirmed-by-edit":pick("Availability confirmed by edit","Xác nhận tin khi chỉnh sửa"),"catalog-updated":pick("Catalog updated","Cập nhật danh mục"),"required-fields-updated":pick("Required fields updated","Cập nhật trường bắt buộc"),"pilot-config-updated":pick("Pilot configuration updated","Cập nhật cấu hình pilot"),"listing-auto-moderated":pick("Automatic moderation","Kiểm duyệt tự động"),"listing-moderation-decision":pick("Manual moderation decision","Quyết định kiểm duyệt"),"availability-auto-hidden":pick("Automatically hidden","Tự động ẩn tin"),"availability-reminder-sent":pick("Availability reminder sent","Đã gửi nhắc xác nhận"),"availability-admin-reconfirmed":pick("Admin-assisted reconfirmation","Admin hỗ trợ xác nhận")}[a]??humaniseAction(a));
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...audit]
      .filter((entry) => {
        if (action !== "all" && entry.action !== action) return false;
        const day=vietnamDay(entry.createdAt);
        if((from&&day<from)||(through&&day>through))return false;
        if(role!=="all"&&entry.actor.split(" · ")[0].toLowerCase()!==role)return false;
        if (!q) return true;
        return entry.target.toLowerCase().includes(q) || entry.actor.toLowerCase().includes(q) || (actorNames.get(entry.actor.split(" · ")[1])??"").toLowerCase().includes(q) || entry.action.toLowerCase().includes(q);
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [audit, action, query,from,through,role,actorNames]);
  const lastPage=Math.max(0,Math.ceil(filtered.length/50)-1),currentPage=Math.min(page,lastPage);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("admin.audit.title")}
        description={t("admin.audit.description")}
      />

      <Card>
        <div className="mb-3 flex justify-end"><button className="border rounded p-2 text-sm" disabled={loading} onClick={()=>setRefreshKey(k=>k+1)}>{pick("Refresh audit log","Làm mới nhật ký")}</button></div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={t("admin.audit.action")} htmlFor="audit-action">
            <Select id="audit-action" value={action} onChange={(e) => {setPage(0);setAction(e.target.value as "all" | AuditLogEntry["action"]);}}>
              <option value="all">{t("admin.audit.allActions")}</option>
              {actions.map((a) => (
                <option key={a} value={a}>{label(a)}</option>
              ))}
            </Select>
          </Field>
          <Field label={t("admin.audit.search")} htmlFor="audit-search">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input id="audit-search" className="pl-9" value={query} onChange={(e) => {setPage(0);setQuery(e.target.value);}} placeholder={t("admin.audit.searchPlaceholder")} />
            </div>
          </Field>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3"><Field label={pick("From (Vietnam time)","Từ ngày (giờ Việt Nam)")} htmlFor="audit-from"><Input id="audit-from" type="date" value={from} onChange={e=>{setPage(0);setFrom(e.target.value);}}/></Field><Field label={pick("Through","Đến ngày")} htmlFor="audit-through"><Input id="audit-through" type="date" min={from||undefined} value={through} onChange={e=>{setPage(0);setThrough(e.target.value);}}/></Field><Field label={pick("Actor role","Vai trò thực hiện")} htmlFor="audit-role"><Select id="audit-role" value={role} onChange={e=>{setPage(0);setRole(e.target.value);}}>{["all","admin","landlord","renter","system"].map(r=><option key={r} value={r}>{r==="all"?pick("All roles","Tất cả vai trò"):r}</option>)}</Select></Field></div>
        <p className="mt-3 text-xs text-muted-foreground">{t("admin.audit.showing", { shown: filtered.length, total: audit.length })}</p>
      </Card>

      {loading || adminLoading ? (
        <LoadingRows rows={5} />
      ) : loadError ? (
        <p role="alert" className="text-sm text-destructive">{pick("Could not load audit log","Không tải được nhật ký")}: {loadError}</p>
      ) : filtered.length === 0 ? (
        <EmptyState title={t("admin.audit.empty")} description={t("admin.audit.emptyDesc")} />
      ) : (
        <div tabIndex={0} role="region" aria-label={t("admin.nav.audit")} className="overflow-x-auto rounded-2xl border border-border bg-card" style={{ boxShadow: "var(--shadow-surface)" }}>
          <table className="w-full min-w-[900px] border-collapse">
            <thead className="border-b border-border bg-muted/50">
              <tr>
                <th className={thClass} scope="col">{t("admin.audit.colDate")}</th>
                <th className={thClass} scope="col">{t("admin.audit.colAction")}</th>
                <th className={thClass} scope="col">{t("admin.audit.colTarget")}</th>
                <th className={thClass} scope="col">{t("admin.audit.colActor")}</th>
                <th className={thClass} scope="col">{t("admin.audit.colReason")}</th><th className={thClass} scope="col">{pick("Changes","Thay đổi")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.slice(currentPage*50,currentPage*50+50).map((entry) => {
                const tone = auditActionTone(entry.action);
                return (
                  <tr key={entry.id} className="transition-colors hover:bg-accent">
                    <td className={`${tdClass} whitespace-nowrap text-muted-foreground`}>{new Date(entry.createdAt).toLocaleString("vi-VN",{timeZone:"Asia/Ho_Chi_Minh",year:"numeric",month:"short",day:"numeric",hour:"2-digit",minute:"2-digit",second:"2-digit"})}</td>
                    <td className={tdClass}>
                      <Pill tone={toneToPill(tone)}>
                        <span className={auditToneClass(tone)}>{label(entry.action)}</span>
                      </Pill>
                    </td>
                    <td className={`${tdClass} font-medium`}>{entry.target}</td>
                    <td className={`${tdClass} text-muted-foreground`}>{actorLabel(entry.actor)}</td>
                    <td className={`${tdClass} max-w-xs whitespace-normal text-muted-foreground`}>{entry.reason}{entry.isSeeded?<p className="text-xs">{pick("Seeded record","Bản ghi mẫu")}</p>:null}</td>
                    <td className={tdClass}><details><summary className="cursor-pointer">{pick("Before / after","Trước / sau")}</summary><div className="max-w-sm space-y-2"><p>{pick("Before","Trước")}</p><pre className="max-h-60 overflow-auto whitespace-pre-wrap break-all text-xs">{JSON.stringify(entry.oldValues??null,null,2)}</pre><p>{pick("After","Sau")}</p><pre className="max-h-60 overflow-auto whitespace-pre-wrap break-all text-xs">{JSON.stringify(entry.newValues??null,null,2)}</pre></div></details></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex gap-3 items-center justify-end text-sm"><button className="border rounded p-2" disabled={currentPage===0} onClick={()=>setPage(currentPage-1)}>{pick("Previous","Trước")}</button><span>{currentPage+1}/{lastPage+1}</span><button className="border rounded p-2" disabled={currentPage===lastPage} onClick={()=>setPage(currentPage+1)}>{pick("Next","Sau")}</button></div>
      <p className="text-xs text-muted-foreground">{pick("Displayed names are current profile names; the original actor ID and audit values remain unchanged.","Tên hiển thị là tên hồ sơ hiện tại; ID người thực hiện và dữ liệu nhật ký gốc không thay đổi.")}</p>
      <PageFooter />
    </div>
  );
}
