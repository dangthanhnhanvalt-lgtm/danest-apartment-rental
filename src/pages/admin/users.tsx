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
  const { t, pick } = useI18n();
  const label = status === "pending" ? pick("Pending", "Chờ duyệt") : status === "rejected" ? pick("Rejected", "Từ chối") : status === "active" ? t("admin.users.active") : t("admin.users.suspended");
  return <Pill tone={status === "active" ? "done" : status === "pending" ? "attention" : "danger"}>{label}</Pill>;
}

export function UsersPage() {
  const { t, pick } = useI18n();
  const { users, setUserStatus, loading, usersError, refresh } = useAdmin();
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [role, setRole] = useState<RoleFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [nextStatus, setNextStatus] = useState<AdminUser["status"]>("active");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter((u) => {
      if (role !== "all" && u.role !== role) return false;
      if (status !== "all" && u.status !== status) return false;
      if (!q) return true;
      return u.name.toLowerCase().includes(q) || u.id.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
    });
  }, [users, query, role, status]);

  const active = users.filter((u) => u.status === "active").length;
  const suspended = users.filter((u) => u.status === "suspended").length;
  const confirming = confirmId ? users.find((u) => u.id === confirmId) ?? null : null;

  const openConfirm = (id: string, next: AdminUser["status"]) => {
    setConfirmId(id);
    setNextStatus(next);
    setReason("");
    setError("");
  };

  const closeConfirm = () => {
    setConfirmId(null);
    setReason("");
    setError("");
  };

  const submit = async (user: AdminUser) => {
    if (reason.trim().length < 5 || reason.trim().length > 1000) {
      setError(pick("Enter a reason of 5–1000 characters.", "Nhập lý do từ 5–1000 ký tự."));
      return;
    }
    setBusy(true);
    try {
      const next = nextStatus;
      await setUserStatus(user.id, next, reason);
      toast({
        title: pick("Account status updated", "Đã cập nhật trạng thái tài khoản"),
        description: user.name,
        tone: next === "suspended" ? "warning" : "success",
      });
      closeConfirm();
    } catch (err) {
      setError((err as { message?: string })?.message ?? String(err));
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
              <Input id="user-search" className="pl-9" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={pick("Name, email or ID", "Tên, email hoặc ID")} />
            </div>
          </Field>
          <Field label={t("admin.users.role")} htmlFor="user-role">
            <Select id="user-role" value={role} onChange={(e) => setRole(e.target.value as RoleFilter)}>
              <option value="all">{t("admin.users.allRoles")}</option>
              <option value="tenant">{t("admin.users.tenant")}</option>
              <option value="landlord">{t("admin.users.landlord")}</option>
              <option value="admin">Admin</option>
            </Select>
          </Field>
          <Field label={t("admin.users.status")} htmlFor="user-status">
            <Select id="user-status" value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)}>
              <option value="all">{t("admin.users.allStatuses")}</option>
              <option value="active">{t("admin.users.active")}</option>
              <option value="suspended">{t("admin.users.suspended")}</option>
              <option value="pending">{pick("Pending", "Chờ duyệt")}</option>
              <option value="rejected">{pick("Rejected", "Từ chối")}</option>
            </Select>
          </Field>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">{t("admin.users.showing", { shown: filtered.length, total: users.length })}</p>
      </Card>

      {usersError && <Card><p role="alert" className="text-destructive">{pick("Unable to load accounts", "Không tải được tài khoản")}: {usersError}</p><Button onClick={() => { void refresh().catch((err) => setError(String(err))); }}>{pick("Retry", "Thử lại")}</Button></Card>}
      {confirming ? (
        <Card className="border-destructive/20">
          <CardTitle>{pick("Confirm account status change", "Xác nhận thay đổi trạng thái tài khoản")}</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">{confirming.name}: {confirming.status} → {nextStatus}</p>
          <div className="mt-4">
            <Field label={t("admin.users.reason")} htmlFor="suspend-reason" error={error || undefined}>
              <Textarea id="suspend-reason" value={reason} maxLength={1000} onChange={(e) => { setReason(e.target.value); setError(""); }} placeholder={t("admin.users.reasonPlaceholder")} />
            </Field>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant={nextStatus === "suspended" || nextStatus === "rejected" ? "destructive" : "default"} onClick={() => submit(confirming)} disabled={busy}>
              {pick("Confirm", "Xác nhận")}
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
        <div tabIndex={0} role="region" aria-label={t("admin.nav.users")} className="overflow-x-auto rounded-2xl border border-border bg-card" style={{ boxShadow: "var(--shadow-surface)" }}>
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
                        {u.email && <p className="truncate text-xs text-muted-foreground">{u.email}</p>}
                        <p className="truncate text-xs text-muted-foreground">{u.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className={tdClass}>
                    <Pill tone="neutral">{u.role === "admin" ? "Admin" : u.role === "landlord" ? t("admin.users.landlord") : t("admin.users.tenant")}</Pill>
                  </td>
                  <td className={tdClass}>{u.listings}</td>
                  <td className={tdClass}>{u.inquiries}</td>
                  <td className={tdClass}>{formatDate(u.joinedAt)}</td>
                  <td className={tdClass}><StatusPill status={u.status} /></td>
                  <td className={tdClass}>
                    <div className="flex flex-wrap gap-2">
                      {u.role === "admin" ? <span>—</span> : <>
                        {u.status === "pending" && <>
                          <Button size="sm" onClick={() => openConfirm(u.id, "active")} disabled={busy}>{pick("Approve", "Duyệt")}</Button>
                          <Button size="sm" variant="outline" onClick={() => openConfirm(u.id, "rejected")} disabled={busy}>{pick("Reject", "Từ chối")}</Button>
                        </>}
                        {(u.status === "active" || u.status === "pending") && <Button size="sm" variant="outline" onClick={() => openConfirm(u.id, "suspended")} disabled={busy}>{t("admin.users.suspend")}</Button>}
                        {u.status === "suspended" && (u.role === "tenant" || u.approvedAt) && <Button size="sm" onClick={() => openConfirm(u.id, "active")} disabled={busy}>{t("admin.users.activate")}</Button>}
                        {(u.status === "rejected" || u.status === "suspended") && <Button size="sm" variant="outline" onClick={() => openConfirm(u.id, "pending")} disabled={busy}>{pick("Return to review", "Đưa về chờ duyệt")}</Button>}
                      </>}
                    </div>
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
