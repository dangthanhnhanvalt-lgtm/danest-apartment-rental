import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { AuditLogEntry } from "~/types";
import { formatDate } from "~/lib/format";
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
  AUDIT_ACTIONS,
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
  const { t } = useI18n();
  const { audit, loading } = useAdmin();
  const [action, setAction] = useState<"all" | AuditLogEntry["action"]>("all");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...audit]
      .filter((entry) => {
        if (action !== "all" && entry.action !== action) return false;
        if (!q) return true;
        return entry.target.toLowerCase().includes(q) || entry.actor.toLowerCase().includes(q);
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [audit, action, query]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("admin.audit.title")}
        description={t("admin.audit.description")}
      />

      <Card>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={t("admin.audit.action")} htmlFor="audit-action">
            <Select id="audit-action" value={action} onChange={(e) => setAction(e.target.value as "all" | AuditLogEntry["action"])}>
              <option value="all">{t("admin.audit.allActions")}</option>
              {AUDIT_ACTIONS.map((a) => (
                <option key={a} value={a}>{t(AUDIT_ACTION_LABEL_KEY[a])}</option>
              ))}
            </Select>
          </Field>
          <Field label={t("admin.audit.search")} htmlFor="audit-search">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input id="audit-search" className="pl-9" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("admin.audit.searchPlaceholder")} />
            </div>
          </Field>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">{t("admin.audit.showing", { shown: filtered.length, total: audit.length })}</p>
      </Card>

      {loading ? (
        <LoadingRows rows={5} />
      ) : filtered.length === 0 ? (
        <EmptyState title={t("admin.audit.empty")} description={t("admin.audit.emptyDesc")} />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card" style={{ boxShadow: "var(--shadow-surface)" }}>
          <table className="w-full min-w-[900px] border-collapse">
            <thead className="border-b border-border bg-muted/50">
              <tr>
                <th className={thClass} scope="col">{t("admin.audit.colDate")}</th>
                <th className={thClass} scope="col">{t("admin.audit.colAction")}</th>
                <th className={thClass} scope="col">{t("admin.audit.colTarget")}</th>
                <th className={thClass} scope="col">{t("admin.audit.colActor")}</th>
                <th className={thClass} scope="col">{t("admin.audit.colReason")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((entry) => {
                const tone = auditActionTone(entry.action);
                return (
                  <tr key={entry.id} className="transition-colors hover:bg-accent">
                    <td className={`${tdClass} whitespace-nowrap text-muted-foreground`}>{formatDate(entry.createdAt)}</td>
                    <td className={tdClass}>
                      <Pill tone={toneToPill(tone)}>
                        <span className={auditToneClass(tone)}>{t(AUDIT_ACTION_LABEL_KEY[entry.action])}</span>
                      </Pill>
                    </td>
                    <td className={`${tdClass} font-medium`}>{entry.target}</td>
                    <td className={`${tdClass} text-muted-foreground`}>{entry.actor}</td>
                    <td className={`${tdClass} max-w-xs whitespace-normal text-muted-foreground`}>{entry.reason}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <PageFooter />
    </div>
  );
}
