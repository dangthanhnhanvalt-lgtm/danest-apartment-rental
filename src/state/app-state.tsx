import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  applyQuery,
  mockAuthRepository,
  mockListingRepository,
  readSavedIds,
  readSession,
  writeSavedIds,
} from "~/api";
import { backendAuthRepository } from "~/api/backend/auth";
import { isBackendAvailable } from "~/api/backend/provider";
import type { Listing, ListingQuery, Session, User } from "~/types";
import {
  getSupabaseListings,
  getMySupabaseListings,
  createSupabaseListing,
} from "~/api/supabase-listings";

interface AppStateValue {
  listings: Listing[];
  listingsLoading: boolean;
  refreshListings: () => Promise<void>;
  fetchListings: (query?: ListingQuery) => Promise<Listing[]>;
  updateListing: (id: string, patch: Partial<Listing>) => Promise<void>;
  addListing: (listing: Listing) => Promise<void>;
  savedIds: string[];
  toggleSaved: (id: string) => boolean;
  isSaved: (id: string) => boolean;
  compareIds: string[];
  toggleCompare: (id: string) => "added" | "removed" | "full";
  isComparing: (id: string) => boolean;
  clearCompare: () => void;
  session: Session | null;
  login: (email: string, password: string) => Promise<Session>;
  register: (name: string, email: string, password: string, role: User["role"]) => Promise<Session>;
  logout: () => void;
  backendReady: boolean;
  /** True when a user is signed in (real or demo). */
  isAuthenticated: boolean;
  /** True only for a signed-in user whose (demo-mapped) role is landlord. */
  isLandlord: boolean;
  /** Stable demo landlord id for the signed-in landlord, or null when not one. */
  demoLandlordId: string | null;
}

const AppStateContext = createContext<AppStateValue | null>(null);

const MAX_COMPARE = 3;

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [listings, setListings] = useState<Listing[]>([]);
  const [listingsLoading, setListingsLoading] = useState(false);
  const [savedIds, setSavedIds] = useState<string[]>(() => readSavedIds());
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [session, setSession] = useState<Session | null>(() => readSession());
  const backendRef = useRef<boolean>(false);
  const [backendReady, setBackendReady] = useState(false);

  // Detect the Backend Hub once; when reachable, use backend auth + saved.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ok = true;
      if (cancelled) return;
      backendRef.current = ok;
      setBackendReady(true);
      if (ok) {
        // Restore a persisted Appwrite session (survives reload / other device).
        try {
          const restored = await backendAuthRepository.current();
          if (!cancelled && restored) setSession(restored);
        } catch {
          /* stay signed out */
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // When signed in on the backend, only the session is restored (auth works).
  // Saved apartments stay per-browser because client writes are unsupported
  // on this Backend Hub (see db/baas/README.md).

  const refreshListings = useCallback(async () => {
    setListingsLoading(true);

    try {
      // Lấy các căn hộ đã công khai
      const publicListings = await getSupabaseListings();

      // Lấy các căn hộ của chủ nhà đang đăng nhập
      const myListings = await getMySupabaseListings();

      // Gộp dữ liệu và loại bỏ căn hộ trùng ID
      const merged = new Map<string, Listing>();

      publicListings.forEach((listing) => {
        merged.set(listing.id, listing);
      });

      myListings.forEach((listing) => {
        merged.set(listing.id, listing);
      });

      setListings(Array.from(merged.values()));
    } catch (error) {
      console.error("Không tải được danh sách căn hộ:", error);
      setListings([]);
    } finally {
      setListingsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshListings();
    const onFocus = () => {
      if (window.location.pathname.startsWith("/admin")) return;
      void refreshListings();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refreshListings]);

  const fetchListings = useCallback(async (query?: ListingQuery): Promise<Listing[]> => {
  const all = await getSupabaseListings();
  return applyQuery(all, query);
  }, []);

  const updateListing = useCallback(async (id: string, patch: Partial<Listing>) => {
    const updated = await mockListingRepository.update(id, patch);
    setListings((prev) => prev.map((l) => (l.id === id ? updated : l)));
  }, []);

  const addListing = useCallback(async (listing: Listing) => {
    const created = await createSupabaseListing(listing);

    setListings((prev) => [created, ...prev]);
  }, []);

  const persistSaved = useCallback((ids: string[]) => {
    setSavedIds(ids);
    writeSavedIds(ids);
  }, []);

  const toggleSaved = useCallback(
    (id: string) => {
      const nowSaved = !savedIds.includes(id);
      persistSaved(nowSaved ? [...savedIds, id] : savedIds.filter((s) => s !== id));
      // NOTE: browser writes to the Database Hub are not possible on this Backend
      // Hub (clients may not create documents; only read("any") collections are
      // readable). Saved apartments therefore persist per-browser until a server
      // function exists — see db/baas/README.md.
      return nowSaved;
    },
    [savedIds, persistSaved],
  );

  const isSaved = useCallback((id: string) => savedIds.includes(id), [savedIds]);

  const toggleCompare = useCallback(
    (id: string): "added" | "removed" | "full" => {
      if (compareIds.includes(id)) {
        setCompareIds(compareIds.filter((c) => c !== id));
        return "removed";
      }
      if (compareIds.length >= MAX_COMPARE) return "full";
      setCompareIds([...compareIds, id]);
      return "added";
    },
    [compareIds],
  );

  const isComparing = useCallback((id: string) => compareIds.includes(id), [compareIds]);
  const clearCompare = useCallback(() => setCompareIds([]), []);

  const login = useCallback(async (email: string, password: string) => {
    // If the backend was reachable at startup, use ONLY real auth — a wrong
    // password must fail, not silently become a demo session.
    const s = backendRef.current
      ? await backendAuthRepository.login(email, password)
      : await mockAuthRepository.login(email, password);
    setSession(s);
    return s;
  }, []);

  const register = useCallback(
    async (name: string, email: string, password: string, role: User["role"]) => {
      const s = backendRef.current
        ? await backendAuthRepository.register(name, email, password, role)
        : await mockAuthRepository.register(name, email, password, role);
      setSession(s);
      return s;
    },
    [],
  );

  const logout = useCallback(() => {
    if (backendRef.current) void backendAuthRepository.logout().catch(() => undefined);
    void mockAuthRepository.logout();
    setSession(null);
    setSavedIds([]);
  }, []);

  const isAuthenticated = session !== null;
  const demoLandlordId = session && session.user.role === "landlord" ? session.user.id : null;
  const isLandlord = demoLandlordId !== null;

  const value = useMemo<AppStateValue>(
    () => ({
      listings,
      listingsLoading,
      refreshListings,
      fetchListings,
      updateListing,
      addListing,
      savedIds,
      toggleSaved,
      isSaved,
      compareIds,
      toggleCompare,
      isComparing,
      clearCompare,
      session,
      login,
      register,
      logout,
      backendReady,
      isAuthenticated,
      isLandlord,
      demoLandlordId,
    }),
    [
      listings,
      listingsLoading,
      refreshListings,
      fetchListings,
      updateListing,
      addListing,
      savedIds,
      toggleSaved,
      isSaved,
      compareIds,
      toggleCompare,
      isComparing,
      clearCompare,
      session,
      login,
      register,
      logout,
      backendReady,
      isAuthenticated,
      isLandlord,
      demoLandlordId,
    ],
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState(): AppStateValue {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error("useAppState must be used inside AppStateProvider");
  return ctx;
}
