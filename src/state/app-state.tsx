import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  applyQuery,
} from "~/api";
import { readSaved, writeSaved } from "~/api/backend/engagement";
import { backendAuthRepository } from "~/api/backend/auth";
import { monitorActivity } from "~/lib/session-idle";
import { supabase } from "~/lib/supabase";
import type { Listing, ListingQuery, Session, User } from "~/types";
import {
  getSupabaseListings,
  getMySupabaseListings,
  listingUuid, listingRpc, saveSupabaseListing, submitSupabaseListing,
} from "~/api/supabase-listings";

interface AppStateValue {
  listings: Listing[];
  listingsLoading: boolean;
  refreshListings: () => Promise<void>;
  fetchListings: (query?: ListingQuery) => Promise<Listing[]>;
  updateListing: (id: string, patch: Partial<Listing>) => Promise<void>;
  savedIds: string[];
  toggleSaved: (id: string) => Promise<boolean>;
  savedError: string;
  savedLoading: boolean;
  refreshSaved: () => Promise<void>;
  isSaved: (id: string) => boolean;
  compareIds: string[];
  toggleCompare: (id: string) => "added" | "removed" | "full";
  isComparing: (id: string) => boolean;
  clearCompare: () => void;
  session: Session | null;
  login: (email: string, password: string, expectedRole?: "admin") => Promise<Session>;
  register: (name: string, email: string, password: string, role: User["role"], acceptedTerms: boolean) => Promise<Session | null>;
  logout: () => Promise<void>;
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
  const [publicListings,setPublicListings]=useState<Listing[]>([]);
  const [privateListings,setPrivateListings]=useState<{owner:string;rows:Listing[]}>({owner:"",rows:[]});
  const listingGeneration=useRef(0);
  const [listingsLoading, setListingsLoading] = useState(false);
  const [savedState, setSavedState] = useState<{owner:string; ids:string[]}>({owner:"",ids:[]});
  const [savedError,setSavedError] = useState("");
  const [savedLoading,setSavedLoading] = useState(true);
  const savedBusy = useRef(false);
  const savedGeneration = useRef(0);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const [backendReady, setBackendReady] = useState(false);

  // Supabase is the only source of identity. Never restore a demo session.
  useEffect(() => {
    let cancelled = false;
    let generation = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refreshSession = async () => {
      const request = ++generation;
      try {
        const restored = await backendAuthRepository.current();
        if (!cancelled && request === generation) setSession(restored);
      } catch (error) {
        if (!cancelled && request === generation) setSession(null);
        console.error("Account check failed", error);
      } finally {
        if (!cancelled && request === generation) setBackendReady(true);
      }
    };
    void refreshSession();
    const periodic = window.setInterval(() => { void refreshSession(); }, 30000);
    const stopIdle = monitorActivity(() => { setSession(null); void refreshSession(); });
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      clearTimeout(timer);
      generation++;
      if (event === "SIGNED_IN" || event === "INITIAL_SESSION") setSession(old => old?.user.id === next?.user.id ? old : null);
      if (event === "SIGNED_OUT") {
        generation++;
        setSession(null);
        setBackendReady(true);
      } else {
        // Do not await Supabase calls inside its auth callback.
        timer = setTimeout(() => { void refreshSession(); }, 0);
      }
    });
    const onFocus = () => { void refreshSession(); };
    window.addEventListener("focus", onFocus);
    window.addEventListener("danest-profile-updated", onFocus);
    return () => {
      cancelled = true;
      clearInterval(periodic); stopIdle();
      window.removeEventListener("danest-profile-updated", onFocus);
      clearTimeout(timer);
      data.subscription.unsubscribe();
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  const listingOwner = session?.user.role === "landlord" && session.user.accountStatus === "active" ? session.user.id : "";
  const listings=useMemo(()=>{
    const merged=new Map(publicListings.map(l=>[l.id,l]));
    if(listingOwner && privateListings.owner===listingOwner) privateListings.rows.forEach(l=>merged.set(l.id,l));
    return [...merged.values()];
  },[publicListings,privateListings,listingOwner]);
  const refreshListings = useCallback(async () => {
    const generation=++listingGeneration.current;
    setListingsLoading(true);
    try {
      const publicRows=await getSupabaseListings();
      if(generation!==listingGeneration.current) return;
      setPublicListings(publicRows);
      if(!listingOwner){setPrivateListings({owner:"",rows:[]});return;}
      const rows=await getMySupabaseListings();
      const current=await supabase.auth.getUser();
      if(generation===listingGeneration.current && current.data.user?.id===listingOwner) setPrivateListings({owner:listingOwner,rows});
    } catch(error){
      if(generation===listingGeneration.current){setPrivateListings({owner:"",rows:[]});setPublicListings([]);}
      console.error("Unable to load listings",error);
    } finally {if(generation===listingGeneration.current) setListingsLoading(false);}
  },[listingOwner]);
  useEffect(() => {
    void refreshListings();
    const onFocus = () => {if (!window.location.pathname.startsWith("/admin")) void refreshListings();};
    window.addEventListener("focus", onFocus);
    const timer = setInterval(() => { void refreshListings(); }, 20 * 60 * 1000);
    return () => {listingGeneration.current++;window.removeEventListener("focus", onFocus);clearInterval(timer);};
  }, [refreshListings]);

  const fetchListings = useCallback(async (query?: ListingQuery): Promise<Listing[]> => {
  const all = await getSupabaseListings();
  return applyQuery(all, query);
  }, []);

  const updateListing = useCallback(async (id: string, patch: Partial<Listing>) => {
    const uuid = await listingUuid(id);
    const current = listings.find(l => l.id === id);
    if (!current) throw new Error("Listing not found");
    if (patch.status === "paused") await listingRpc("danest_pause_listing", {p_listing_id:uuid});
    else if (patch.status === "published") await submitSupabaseListing(uuid);
    else if (patch.status === "archived") await listingRpc("danest_owner_listing_action", {p_listing_id:uuid,p_action:"archive"});
    else if (patch.status === "draft") await listingRpc("danest_owner_listing_action", {p_listing_id:uuid,p_action:"draft"});
    else if (patch.lastAvailabilityConfirmedAt) await listingRpc("danest_reconfirm_availability", {p_listing_id:uuid});
    else if (patch.availability) await listingRpc("danest_owner_listing_action", {p_listing_id:uuid,p_action:"availability",p_value:patch.availability});
    else if (patch.monthlyRent !== undefined) {
      await saveSupabaseListing({...current,monthlyRent:patch.monthlyRent,costs:{...current.costs,monthlyRent:patch.monthlyRent}},uuid);
      await submitSupabaseListing(uuid);
    } else throw new Error("This feature is not connected yet. No data was changed.");
    await refreshListings();
  }, [listings,refreshListings]);

  const savedOwner = session?.user.role === "tenant" && session.user.accountStatus === "active" ? session.user.id : "";
  const savedIds = useMemo(() => savedState.owner === savedOwner ? savedState.ids : [], [savedState,savedOwner]);
  const refreshSaved = useCallback(async () => {
    const generation = ++savedGeneration.current;
    setSavedError(""); setSavedLoading(true);
    try {
      const ids = savedOwner ? await readSaved(savedOwner) : [];
      if (generation === savedGeneration.current) setSavedState({owner:savedOwner,ids});
    } catch (e) { if (generation === savedGeneration.current) setSavedError(e instanceof Error ? e.message : String(e)); }
    finally { if (generation === savedGeneration.current) setSavedLoading(false); }
  }, [savedOwner]);
  useEffect(() => {
    setCompareIds([]);
    void refreshSaved();
    return () => { savedGeneration.current++; };
  }, [refreshSaved]);
  const toggleSaved = useCallback(async (id:string) => {
    if (!savedOwner) throw new Error("Sign in with an active renter account / Đăng nhập tài khoản người thuê đang hoạt động");
    if (savedLoading || savedState.owner !== savedOwner || savedError || savedBusy.current) throw new Error("Saved list not ready; refresh and try again / Hãy làm mới danh sách yêu thích");
    savedBusy.current = true;
    const generation = savedGeneration.current;
    const save = !savedIds.includes(id);
    try {
      await writeSaved(savedOwner,id,save);
      if (generation !== savedGeneration.current) throw new Error("Account or saved list changed; refresh");
      setSavedState(prev => prev.owner === savedOwner ? {owner:savedOwner,ids:save?[...new Set([...prev.ids,id])]:prev.ids.filter(s=>s!==id)} : prev);
      return save;
    } finally { savedBusy.current = false; }
  }, [savedOwner,savedLoading,savedState.owner,savedError,savedIds]);

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

  const login = useCallback(async (email: string, password: string, expectedRole?: "admin") => {
    const s = await backendAuthRepository.login(email, password, expectedRole);
    setSession(s);
    return s;
  }, []);

  const register = useCallback(
    async (name: string, email: string, password: string, role: User["role"], acceptedTerms: boolean) => {
      const s = await backendAuthRepository.register(name, email, password, role, acceptedTerms);
      setSession(s);
      return s;
    }, [],
  );

  const logout = useCallback(async () => {
    await backendAuthRepository.logout();
    setSession(null);
    setSavedState({owner:"",ids:[]});
    listingGeneration.current++;
    setPrivateListings({owner:"",rows:[]});
    savedGeneration.current++;
    setCompareIds([]);
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
      savedIds,
      savedError,
      savedLoading,
      refreshSaved,
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
      savedIds,
      savedError,
      savedLoading,
      refreshSaved,
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
