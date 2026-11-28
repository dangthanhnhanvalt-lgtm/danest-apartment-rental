import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { cn } from "~/lib/utils";

interface RouterValue {
  path: string;
  query: URLSearchParams;
  hash: string;
  navigate: (to: string, opts?: { replace?: boolean; scroll?: boolean }) => void;
}

const RouterContext = createContext<RouterValue | null>(null);

function parseLocation(): { path: string; query: URLSearchParams; hash: string } {
  return {
    path: window.location.pathname,
    query: new URLSearchParams(window.location.search),
    hash: decodeURIComponent(window.location.hash.replace(/^#/, "")),
  };
}

export function RouterProvider({ children }: { children: ReactNode }) {
  const [location, setLocation] = useState(parseLocation);

  useEffect(() => {
    const onPop = () => setLocation(parseLocation());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const navigate = useCallback((to: string, opts?: { replace?: boolean; scroll?: boolean }) => {
    if (opts?.replace) {
      window.history.replaceState({}, "", to);
    } else {
      window.history.pushState({}, "", to);
    }
    setLocation(parseLocation());
    if (opts?.scroll !== false && !to.includes("#")) window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  const value = useMemo(() => ({ ...location, navigate }), [location, navigate]);
  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
}

export function useRouter(): RouterValue {
  const ctx = useContext(RouterContext);
  if (!ctx) throw new Error("useRouter must be used inside RouterProvider");
  return ctx;
}

interface LinkProps {
  to: string;
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  "aria-label"?: string;
}

export function Link({ to, children, className, onClick, ...rest }: LinkProps) {
  const { navigate } = useRouter();
  return (
    <a
      href={to}
      className={cn(className)}
      {...rest}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        onClick?.();
        navigate(to);
      }}
    >
      {children}
    </a>
  );
}

export function useNavigate() {
  return useRouter().navigate;
}

export function buildSearchUrl(filters: Record<string, string | number | boolean | null | undefined>): string {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => {
    if (v === null || v === undefined || v === "" || v === false) return;
    params.set(k, String(v));
  });
  const qs = params.toString();
  return qs ? `/search?${qs}` : "/search";
}
