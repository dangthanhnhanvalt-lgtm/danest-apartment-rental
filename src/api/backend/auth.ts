
import { supabase } from "~/lib/supabase";
import { sessionExpired } from "~/lib/session-idle";
import type { AccountStatus, Session, User } from "~/types";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return (
    ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "??"
  );
}

async function getAppSession(): Promise<Session | null> {
  const local = await supabase.auth.getSession();
  if (!local.data.session) return null;
  if (sessionExpired(local.data.session)) {
    await supabase.auth.signOut({scope:"local"});
    return null;
  }
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    return null;
  }

  const authUser = data.user;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("full_name, role, account_status")
    .eq("id", authUser.id)
    .single();

  if (profileError || !profile) {
    throw new Error(
      "Không thể tải hồ sơ người dùng: " +
        (profileError?.message ?? "Profile not found")
    );
  }

  if (!["tenant", "landlord", "admin"].includes(profile.role) ||
      !["active", "pending", "rejected", "suspended"].includes(profile.account_status)) {
    throw new Error("Invalid account profile.");
  }
  if (profile.account_status === "suspended" || profile.account_status === "rejected") {
    await supabase.auth.signOut({scope:"local"});
    throw new Error("Account suspended or rejected / Tài khoản bị khóa hoặc từ chối.");
  }
  if (profile.account_status !== "active" && profile.role !== "landlord") {
    throw new Error("Account is not active / Tài khoản chưa hoạt động.");
  }
  const name = profile.full_name || authUser.email?.split("@")[0] || "User";

  const user: User = {
    id: authUser.id,
    name,
    email: authUser.email ?? "",
    role: profile.role as User["role"],
    avatarInitials: initials(name),
    accountStatus: profile.account_status as AccountStatus,
  };

  return { user, isDemo: false };
}

export const backendAuthRepository = {
  async login(email: string, password: string, expectedRole?: "admin"): Promise<Session> {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;

    try {
      const session = await getAppSession();
      if (!session) throw new Error("Không thể khôi phục phiên đăng nhập.");
      if (expectedRole && (session.user.role !== expectedRole || session.user.accountStatus !== "active")) {
        throw new Error("Admin account required / Cần tài khoản quản trị đang hoạt động.");
      }
      return session;
    } catch (error) {
      await supabase.auth.signOut({ scope: "local" });
      throw error;
    }
  },

  async register(
    name: string,
    email: string,
    password: string,
    role: User["role"],
    acceptedTerms: boolean
  ): Promise<Session | null> {
    if (role !== "tenant" && role !== "landlord") {
      throw new Error("Vai trò đăng ký không hợp lệ.");
    }

    if (!acceptedTerms) throw new Error("Terms and privacy consent required");
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name,
          role,
          terms_accepted: true,
          terms_version: "danest-pilot-2026-11",
        },
      },
    });

    if (error) throw error;

    if (!data.session) {
      return null;
    }

    const session = await getAppSession();
    if (!session) throw new Error("Không thể tải hồ sơ sau khi đăng ký.");

    return session;
  },

  async logout(): Promise<void> {
    const { error } = await supabase.auth.signOut({scope:"local"});
    if (error) throw error;
  },

  async current(): Promise<Session | null> {
    return getAppSession();
  },
};
