import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { AdminUser } from "~/types";
import { formatDate, initials } from "~/lib/format";
import { useAdmin } from "~/state/admin-state";
import { useToast } from "~/components/ui/toast";
import { Button } from "~/components/ui/button";
import { Field, Input, Select, Textarea } from "~/components/ui/form";
import {
  Card,
  CardTitle,
  EmptyState,
  LoadingRows,
  PageFooter,
  PageHeader,
} from "~/pages/admin/shared";
import {
  thClass,
  tdClass,
} from "~/pages/admin/admin-helpers";
import { Pill } from "~/pages/admin/pills";
import { useI18n } from "~/i18n/language-context";

type RoleFilter = "all" | AdminUser["role"];
type StatusFilter = "all" | AdminUser["status"];

function UserAvatar({ name }: { name: string }) {
  return (
    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-link" aria-hidden="true">
      {initials(name)}
    </span>
  );
}

function StatusPill({ status }: { status: AdminUser["status"] }) {
  const { t } = useI18n();
  return <Pill tone={status === "active" ? "done" : "danger"}>{status === "active" ? t("admin.users.active") : t("admin.users.suspended")}</Pill>;
}

export function UsersPage() {
  const { t } = useI18n();
  const { users, setUserStatus, loading } = useAdmin();
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [role, setRole] = useState<RoleFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter((u) => {
      if (role !== "all" && u.role !== role) return false;
      if (status !== "all" && u.status !== status) return false;
      if (!q) return true;
      return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
    });
  }, [users, query, role, status]);

  const active = users.filter((u) => u.status === "active").length;
  const suspended = users.filter((u) => u.status === "suspended").length;
  const confirming = confirmId ? users.find((u) => u.id === confirmId) ?? null : null;

  const openConfirm = (id: string) => {
    setConfirmId(id);
    setReason("");
    setError("");
  };

  const closeConfirm = () => {
    setConfirmId(null);
    setReason("");
    setError("");
  };

  const submit = async (user: AdminUser) => {
    if (user.status === "active" && reason.trim().length < 5) {
      setError(t("admin.users.errorReasonMin"));
      return;
    }
    setBusy(true);
    try {
      const next = user.status === "active" ? "suspended" : "active";
      await setUserStatus(user.id, next);
      toast({
        title: next === "suspended" ? t("admin.users.toast.suspended") : t("admin.users.toast.activated"),
        description: next === "suspended" ? t("admin.users.toast.suspendedDesc", { name: user.name }) : t("admin.users.toast.activatedDesc", { name: user.name }),
        tone: next === "suspended" ? "warning" : "success",
      });
      closeConfirm();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("admin.users.title")}
        description={t("admin.users.description")}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { labelKey: "admin.users.total", value: users.length },
          { labelKey: "admin.users.active", value: active },
          { labelKey: "admin.users.suspended", value: suspended },
        ].map((s) => (
          <div key={s.labelKey} className="rounded-xl border border-border bg-card p-5" style={{ boxShadow: "var(--shadow-surface)" }}>
            <p className="text-xs text-muted-foreground">{t(s.labelKey)}</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{s.value}</p>
          </div>
        ))}
      </div>

      <Card>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Field label={t("admin.users.search")} htmlFor="user-search">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input id="user-search" className="pl-9" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("admin.users.searchPlaceholder")} />
            </div>
          </Field>
          <Field label={t("admin.users.role")} htmlFor="user-role">
            <Select id="user-role" value={role} onChange={(e) => setRole(e.target.value as RoleFilter)}>
              <option value="all">{t("admin.users.allRoles")}</option>
              <option value="tenant">{t("admin.users.tenant")}</option>
              <option value="landlord">{t("admin.users.landlord")}</option>
            </Select>
          </Field>
          <Field label={t("admin.users.status")} htmlFor="user-status">
            <Select id="user-status" value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)}>
              <option value="all">{t("admin.users.allStatuses")}</option>
              <option value="active">{t("admin.users.active")}</option>
              <option value="suspended">{t("admin.users.suspended")}</option>
            </Select>
          </Field>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">{t("admin.users.showing", { shown: filtered.length, total: users.length })}</p>
      </Card>

      {confirming ? (
        <Card className="border-destructive/20">
          <CardTitle>{confirming.status === "active" ? t("admin.users.suspendTitle") : t("admin.users.activateTitle")}</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            {confirming.status === "active"
              ? t("admin.users.suspendDesc", { name: confirming.name })
              : t("admin.users.activateDesc", { name: confirming.name })}
          </p>
          {confirming.status === "active" ? (
            <div className="mt-4">
              <Field label={t("admin.users.reason")} htmlFor="suspend-reason" error={error || undefined} hint={t("admin.users.reasonHint")}>
                <Textarea
                  id="suspend-reason"
                  value={reason}
                  onChange={(e) => {
                    setReason(e.target.value);
                    if (error) setError("");
                  }}
                  placeholder={t("admin.users.reasonPlaceholder")}
                />
              </Field>
            </div>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant={confirming.status === "active" ? "destructive" : "default"} onClick={() => submit(confirming)} disabled={busy}>
              {confirming.status === "active" ? t("admin.users.confirmSuspension") : t("admin.users.confirmActivation")}
            </Button>
            <Button variant="ghost" onClick={closeConfirm} disabled={busy}>{t("common.cancel")}</Button>
          </div>
        </Card>
      ) : null}

      {loading ? (
        <LoadingRows />
      ) : filtered.length === 0 ? (
        <EmptyState title={t("admin.users.empty")} description={t("admin.users.emptyDesc")} />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card" style={{ boxShadow: "var(--shadow-surface)" }}>
          <table className="w-full min-w-[880px] border-collapse">
            <thead className="border-b border-border bg-muted/50">
              <tr>
                <th className={thClass} scope="col">{t("admin.users.colUser")}</th>
                <th className={thClass} scope="col">{t("admin.users.colRole")}</th>
                <th className={thClass} scope="col">{t("admin.users.colListings")}</th>
                <th className={thClass} scope="col">{t("admin.users.colInquiries")}</th>
                <th className={thClass} scope="col">{t("admin.users.colJoined")}</th>
                <th className={thClass} scope="col">{t("admin.users.colStatus")}</th>
                <th className={thClass} scope="col">{t("admin.users.colAction")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((u) => (
                <tr key={u.id} className="transition-colors hover:bg-accent">
                  <td className={tdClass}>
                    <div className="flex items-center gap-3">
                      <UserAvatar name={u.name} />
                      <div className="min-w-0">
                        <p className="truncate font-medium text-foreground">{u.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className={tdClass}>
                    <Pill tone="neutral">{u.role === "landlord" ? t("admin.users.landlord") : t("admin.users.tenant")}</Pill>
                  </td>
                  <td className={tdClass}>{u.listings}</td>
                  <td className={tdClass}>{u.inquiries}</td>
                  <td className={tdClass}>{formatDate(u.joinedAt)}</td>
                  <td className={tdClass}><StatusPill status={u.status} /></td>
                  <td className={tdClass}>
                    <Button
                      variant="outline"
                      size="sm"
                      className={u.status === "active" ? "text-destructive hover:text-destructive" : undefined}
                      onClick={() => openConfirm(u.id)}
                      disabled={busy}
                    >
                      {u.status === "active" ? t("admin.users.suspend") : t("admin.users.activate")}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <PageFooter />
    </div>
  );
}
