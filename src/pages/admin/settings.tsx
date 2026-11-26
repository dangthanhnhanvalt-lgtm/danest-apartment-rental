import { useState, type FormEvent } from "react";
import { CheckCircle2, Lock } from "lucide-react";
import { availabilityStatus } from "~/lib/availability";
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
  const { t } = useI18n();
  const { settings, listings, saveSettings } = useAdmin();
  const { toast } = useToast();
  const [reminder, setReminder] = useState(String(settings.availabilityReminderDays));
  const [grace, setGrace] = useState(String(settings.availabilityGraceDays));
  const [errors, setErrors] = useState<{ reminder?: string; grace?: string }>({});
  const [busy, setBusy] = useState(false);

  const reminderNum = Number(reminder);
  const graceNum = Number(grace);
  const computedHide = Number.isFinite(reminderNum) && Number.isFinite(graceNum) ? reminderNum + graceNum : null;
  const overdueNow = listings.filter((l) => availabilityStatus(l, settings).state === "overdue").length;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const next: { reminder?: string; grace?: string } = {};
    if (!Number.isInteger(reminderNum) || reminderNum < 7 || reminderNum > 30) {
      next.reminder = t("admin.settings.errorReminder");
    }
    if (!Number.isInteger(graceNum) || graceNum < 0 || graceNum > 30) {
      next.grace = t("admin.settings.errorGrace");
    }
    setErrors(next);
    if (next.reminder || next.grace) return;
    setBusy(true);
    try {
      await saveSettings({ availabilityReminderDays: reminderNum, availabilityGraceDays: graceNum });
      toast({ title: t("admin.settings.toastSaved"), description: t("admin.settings.toastSavedDesc"), tone: "success" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("admin.settings.title")}
        description={t("admin.settings.description")}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardTitle>{t("admin.settings.availabilityRules")}</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">{t("admin.settings.availabilityRulesDesc")}</p>
          <form className="mt-4 space-y-4" onSubmit={submit}>
            <Field label={t("admin.settings.reminderThreshold")} htmlFor="reminder-days" error={errors.reminder} hint={t("admin.settings.reminderHint")}>
              <Input
                id="reminder-days"
                type="number"
                min={7}
                max={30}
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
                max={30}
                step={1}
                inputMode="numeric"
                value={grace}
                onChange={(e) => { setGrace(e.target.value); setErrors((p) => ({ ...p, grace: undefined })); }}
              />
            </Field>
            <div className="rounded-lg border border-border bg-muted/50 p-3 text-sm text-foreground">
              {computedHide !== null ? (
                <>
                  {t("admin.settings.hiddenAfter", { days: computedHide })}
                  {t("admin.settings.hiddenAfterBreakdown", { total: computedHide, reminder: reminderNum || 0, grace: graceNum || 0 })}
                </>
              ) : (
                t("admin.settings.hiddenAfter", { days: "—" })
              )}
            </div>
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
            <p className="mt-3 text-xs text-muted-foreground">{t("admin.settings.changesSimulated")}</p>
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

      <PageFooter />
    </div>
  );
}
