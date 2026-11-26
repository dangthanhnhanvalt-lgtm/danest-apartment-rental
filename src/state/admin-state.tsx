import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  adminAuditRepository,
  adminListingRepository,
  adminReportRepository,
  adminSettingsRepository,
  adminUserRepository,
  allInquiries,
  computeKpis,
  type AdminKpis,
} from "~/api/admin";
import { DEFAULT_ADMIN_SETTINGS } from "~/lib/availability";
import type {
  AdminSettings,
  AdminUser,
  AuditLogEntry,
  Inquiry,
  Listing,
  ListingStatus,
  Report,
} from "~/types";

interface AdminValue {
  listings: Listing[];
  users: AdminUser[];
  reports: Report[];
  audit: AuditLogEntry[];
  settings: AdminSettings;
  inquiries: Inquiry[];
  kpis: AdminKpis;
  loading: boolean;
  refresh: () => Promise<void>;
  decide: (id: string, status: ListingStatus, reason: string, action: AuditLogEntry["action"]) => Promise<void>;
  verify: (id: string, badge: boolean, reason: string) => Promise<void>;
  setUserStatus: (id: string, status: AdminUser["status"]) => Promise<void>;
  updateReport: (id: string, patch: Partial<Report>) => Promise<void>;
  saveSettings: (settings: AdminSettings) => Promise<void>;
}

const AdminContext = createContext<AdminValue | null>(null);

export function AdminProvider({ children }: { children: ReactNode }) {
  const [listings, setListings] = useState<Listing[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [audit, setAudit] = useState<AuditLogEntry[]>([]);
  const [settings, setSettings] = useState<AdminSettings>(DEFAULT_ADMIN_SETTINGS);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [l, u, r, a, s] = await Promise.all([
      adminListingRepository.list(),
      adminUserRepository.list(),
      adminReportRepository.list(),
      adminAuditRepository.list(),
      adminSettingsRepository.get(),
    ]);
    setListings(l);
    setUsers(u);
    setReports(r);
    setAudit(a);
    setSettings(s);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const inquiries = useMemo(() => allInquiries(), [listings]);

  const kpis = useMemo(() => computeKpis(listings, users, inquiries, settings), [listings, users, inquiries, settings]);

  const decide = useCallback(
    async (id: string, status: ListingStatus, reason: string, action: AuditLogEntry["action"]) => {
      await adminListingRepository.updateStatus(id, status, reason, action);
      await load();
    },
    [load],
  );

  const verify = useCallback(
    async (id: string, badge: boolean, reason: string) => {
      await adminListingRepository.setVerification(id, badge, reason);
      await load();
    },
    [load],
  );

  const setUserStatus = useCallback(
    async (id: string, status: AdminUser["status"]) => {
      await adminUserRepository.setStatus(id, status);
      await load();
    },
    [load],
  );

  const updateReport = useCallback(
    async (id: string, patch: Partial<Report>) => {
      await adminReportRepository.update(id, patch);
      await load();
    },
    [load],
  );

  const saveSettings = useCallback(
    async (next: AdminSettings) => {
      await adminSettingsRepository.set(next);
      await load();
    },
    [load],
  );

  const value = useMemo<AdminValue>(
    () => ({ listings, users, reports, audit, settings, inquiries, kpis, loading, refresh: load, decide, verify, setUserStatus, updateReport, saveSettings }),
    [listings, users, reports, audit, settings, inquiries, kpis, loading, load, decide, verify, setUserStatus, updateReport, saveSettings],
  );

  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
}

export function useAdmin(): AdminValue {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error("useAdmin must be used inside AdminProvider");
  return ctx;
}
