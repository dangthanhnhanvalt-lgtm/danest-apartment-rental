import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  adminAuditRepository,
  adminListingRepository,
  adminReportRepository,
  adminSettingsRepository,
  readAdminKpis,
  type AdminKpis,
} from "~/api/admin";
import { backendAccountsRepository } from "~/api/backend/accounts";
import { DEFAULT_ADMIN_SETTINGS } from "~/lib/availability";
import type {
  AdminSettings,
  AdminUser,
  AuditLogEntry,
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
  kpis: AdminKpis | null;
  loadError: string;
  reconfirm: (id:string,reason:string)=>Promise<void>;
  loading: boolean;
  usersError: string;
  refresh: () => Promise<void>;
  decide: (id: string, status: ListingStatus, reason: string, action: AuditLogEntry["action"]) => Promise<void>;
  verify: (id: string, badge: boolean, reason: string) => Promise<void>;
  setUserStatus: (id: string, status: AdminUser["status"], reason: string) => Promise<void>;
  updateReport: (id: string, patch: Partial<Report>) => Promise<void>;
  saveSettings: (settings: AdminSettings, reason:string) => Promise<void>;
}

const AdminContext = createContext<AdminValue | null>(null);

export function AdminProvider({ children }: { children: ReactNode }) {
  const [kpis,setKpis] = useState<AdminKpis|null>(null);
  const [loadError,setLoadError] = useState("");
  const [listings, setListings] = useState<Listing[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [audit, setAudit] = useState<AuditLogEntry[]>([]);
  const [settings, setSettings] = useState<AdminSettings>(DEFAULT_ADMIN_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [usersError, setUsersError] = useState("");

  const load = useCallback(async () => {
    setUsersError("");
    setLoadError("");
    try {
    const [l, u, r, a, s, k] = await Promise.all([
      adminListingRepository.list(),
      backendAccountsRepository.list().catch((err) => {
        setUsersError(err?.message ?? String(err));
        return [] as AdminUser[];
      }),
      adminReportRepository.list(),
      adminAuditRepository.list(5),
      adminSettingsRepository.get(),
      readAdminKpis(),
    ]);
    setKpis(k);
    setListings(l);
    setUsers(u);
    setReports(r);
    setAudit(a);
    setSettings(s);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err));
      setKpis(null);
      throw err;
    } finally {setLoading(false);}
  }, []);

  useEffect(() => {
    void load().catch(() => {});
  }, [load]);

  const reconfirm = useCallback(async (id:string,reason:string)=>{await adminListingRepository.reconfirmAvailability(id,reason);await load();},[load]);

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
    async (id: string, status: AdminUser["status"], reason: string) => {
      await backendAccountsRepository.setStatus(id, status, reason);
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
    async (next: AdminSettings, reason:string) => {
      await adminSettingsRepository.set(next,reason);
      await load();
    },
    [load],
  );

  const value = useMemo<AdminValue>(
    () => ({ listings, users, reports, audit, settings, kpis, loadError, reconfirm, loading, usersError, refresh: load, decide, verify, setUserStatus, updateReport, saveSettings }),
    [listings, users, reports, audit, settings, kpis, loadError, reconfirm, loading, usersError, load, decide, verify, setUserStatus, updateReport, saveSettings],
  );

  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
}

export function useAdmin(): AdminValue {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error("useAdmin must be used inside AdminProvider");
  return ctx;
}
