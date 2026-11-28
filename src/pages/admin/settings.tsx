import {AdminEmailStatus} from "~/components/admin-email-status";
import { AdminCatalogSettings } from "~/components/admin-catalog-settings";
import { AdminPilotSettings } from "~/components/admin-pilot-settings";
import { useEffect, useState, type FormEvent } from "react";
import { CheckCircle2, Lock } from "lucide-react";
import { supabase } from "~/lib/supabase";
import { useAdmin } from "~/state/admin-state";
import { useToast } from "~/components/ui/toast";
import { Button } from "~/components/ui/button";
import { Field, Input } from "~/components/ui/form";
import {
  Card,
  CardTitle,
  PageFooter,
  PageHeader,
} from "~/pages/admin/shared";
import { useI18n } from "~/i18n/language-context";

const SCOPE = [
  "admin.settings.scope1",
  "admin.settings.scope2",
  "admin.settings.scope3",
  "admin.settings.scope4",
  "admin.settings.scope5",
];

export function AdminSettingsPage() {
  const { t, pick } = useI18n();
  const { settings, kpis, saveSettings } = useAdmin();
  const { toast } = useToast();
  const [reminder, setReminder] = useState(String(settings.availabilityReminderDays));
  const [grace, setGrace] = useState(String(settings.availabilityGraceDays));
  useEffect(()=>{setReminder(String(settings.availabilityReminderDays));setGrace(String(settings.availabilityGraceDays));},[settings.availabilityReminderDays,settings.availabilityGraceDays]);
  const [errors, setErrors] = useState<{ reminder?: string; grace?: string }>({});
  const [reason,setReason]=useState("");
  const [saveError,setSaveError]=useState("");
  const [busy, setBusy] = useState(false);
  const [preview,setPreview]=useState<Record<string,number>|null>(null);
  const [previewError,setPreviewError]=useState("");
  const [previewBusy,setPreviewBusy]=useState(false);
  const loadPreview=async()=>{setPreviewBusy(true);setPreview(null);setPreviewError("");try{const {data,error}=await supabase.rpc("danest_maintenance_preview_09c1");if(error)throw error;setPreview(data as Record<string,number>);}catch(e){setPreviewError(e instanceof Error?e.message:String((e as {message?:string})?.message??e));}finally{setPreviewBusy(false);}};


  const reminderNum = Number(reminder);
  const graceNum = Number(grace);
  const overdueNow = kpis?.overdueListings ?? "—";

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const next: { reminder?: string; grace?: string } = {};
    if (!Number.isInteger(reminderNum) || !reminder.trim() || reminderNum < 1 || reminderNum > 365) {
      next.reminder = t("admin.settings.errorReminder");
    }
    if (!Number.isInteger(graceNum) || !grace.trim() || graceNum < 0 || graceNum > 90) {
      next.grace = t("admin.settings.errorGrace");
    }
    setErrors(next);
    if (next.reminder || next.grace) return;
    if(!reason.trim() || reason.trim().length>1000){setSaveError(pick("Enter a reason (1–1000 characters)","Nhập lý do (1–1000 ký tự)"));return;}
    setSaveError("");setBusy(true);
    try {
      await saveSettings({ availabilityReminderDays: reminderNum, availabilityGraceDays: graceNum },reason.trim());
      setReason("");
      toast({ title: t("admin.settings.toastSaved"), description: t("admin.settings.toastSavedDesc"), tone: "success" });
    } catch(err){setSaveError(err instanceof Error?err.message:String(err));} finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("admin.settings.title")}
        description={t("admin.settings.description")}
      />

      <nav aria-label={pick("Settings sections","Các nhóm cấu hình")} className="flex flex-wrap gap-2 rounded-2xl border border-border bg-card p-3">{[["availability",pick("Availability & maintenance","Xác nhận & tự động")],["pilot",pick("Promotion & moderation","Tin nổi bật & kiểm duyệt")],["catalog",pick("Catalog & required fields","Danh mục & trường bắt buộc")],["email",pick("Email queue","Hàng đợi email")]].map(([id,label])=><Button key={id} type="button" variant="outline" size="sm" onClick={()=>{const target=document.getElementById(`settings-${id}`);target?.focus({preventScroll:true});target?.scrollIntoView({block:"start"});}}>{label}</Button>)}</nav>
      <div id="settings-availability" tabIndex={-1} className="scroll-mt-24 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card>
          <CardTitle>{t("admin.settings.availabilityRules")}</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">{t("admin.settings.availabilityRulesDesc")}</p>
          <form className="mt-4 space-y-4" onSubmit={submit}>
            <Field label={t("admin.settings.reminderThreshold")} htmlFor="reminder-days" error={errors.reminder} hint={t("admin.settings.reminderHint")}>
              <Input
                id="reminder-days"
                type="number"
                min={1}
                max={365}
                step={1}
                inputMode="numeric"
                value={reminder}
                onChange={(e) => { setReminder(e.target.value); setErrors((p) => ({ ...p, reminder: undefined })); }}
              />
            </Field>
            <Field label={t("admin.settings.gracePeriod")} htmlFor="grace-days" error={errors.grace} hint={t("admin.settings.graceHint")}>
              <Input
                id="grace-days"
                type="number"
                min={0}
                max={90}
                step={1}
                inputMode="numeric"
                value={grace}
                onChange={(e) => { setGrace(e.target.value); setErrors((p) => ({ ...p, grace: undefined })); }}
              />
            </Field>
            <div className="rounded-lg border border-border bg-muted/50 p-3 text-sm text-foreground">
              {pick("The grace period starts when the reminder is actually recorded. Hiding happens on a subsequent maintenance run, not at a fixed calendar deadline.","Thời gian gia hạn bắt đầu khi hệ thống ghi nhận thông báo nhắc nhở. Tin được ẩn ở lần chạy tiếp theo đủ điều kiện, không phải một ngày cố định.")}
            </div>
            <Field label={pick("Reason for change","Lý do thay đổi")} htmlFor="settings-reason" error={saveError||undefined}><Input id="settings-reason" value={reason} maxLength={1000} onChange={e=>setReason(e.target.value)} required/></Field>
            <Button type="submit" disabled={busy}>{t("admin.settings.saveSettings")}</Button>
          </form>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardTitle>{t("admin.settings.currentEffect")}</CardTitle>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">{t("admin.settings.overdueNow")}</dt>
                <dd className="font-medium text-foreground">{overdueNow}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">{t("admin.settings.savedReminder")}</dt>
                <dd className="font-medium text-foreground">{t("admin.settings.days", { count: settings.availabilityReminderDays })}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">{t("admin.settings.savedGrace")}</dt>
                <dd className="font-medium text-foreground">{t("admin.settings.days", { count: settings.availabilityGraceDays })}</dd>
              </div>
            </dl>
            <p className="mt-3 text-xs text-muted-foreground">{pick("Saved rules apply when the server maintenance runs. Preview does not send notices or hide listings. Cron is managed in Supabase.","Quy tắc đã lưu được áp dụng khi máy chủ chạy maintenance. Xem trước không gửi thông báo hoặc ẩn tin. Cron được quản lý tại Supabase.")}</p>
          </Card>

          <Card>
            <CardTitle>{pick("Maintenance preview","Xem trước tác vụ tự động")}</CardTitle>
            <Button type="button" variant="outline" disabled={previewBusy} onClick={()=>void loadPreview()}>{previewBusy?pick("Checking…","Đang kiểm tra…"):pick("Preview only","Chỉ xem trước")}</Button>
            {previewError&&<p role="alert" className="mt-2 text-destructive">{previewError}</p>}
            {preview&&<dl className="mt-3 space-y-2 text-sm">{[["listing_reminders",pick("Listing reminders","Tin cần nhắc xác nhận")],["listings_to_hide",pick("Listings to hide","Tin đủ điều kiện ẩn")],["inquiry_reminders",pick("Inquiry reminders","Yêu cầu cần nhắc phản hồi")],["published_missing_confirmation",pick("Missing confirmation date","Tin thiếu ngày xác nhận")],["viewing_reminders",pick("Viewing reminders (recipients)","Nhắc lịch xem (số người nhận)")]].map(([key,label])=><div key={key} className="flex justify-between gap-3"><dt>{label}</dt><dd>{preview[key]??"—"}</dd></div>)}</dl>}
          </Card>
          <Card>
            <CardTitle>{t("admin.settings.prototypeScope")}</CardTitle>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              {SCOPE.map((item) => (
                <li key={item} className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-link" aria-hidden="true" />
                  <span>{t(item)}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
              <Lock className="size-3" aria-hidden="true" /> {t("admin.settings.internalDemo")}
            </p>
          </Card>
        </div>
      </div>

      <div id="settings-pilot" tabIndex={-1} className="scroll-mt-24"><AdminPilotSettings /></div>
      <div id="settings-catalog" tabIndex={-1} className="scroll-mt-24"><AdminCatalogSettings /></div>
      <div id="settings-email" tabIndex={-1} className="scroll-mt-24"><AdminEmailStatus /></div>
      <PageFooter />
    </div>
  );
}
