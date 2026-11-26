
import { supabase } from "~/lib/supabase";
import type { Session, User } from "~/types";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return (
    ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "??"
  );
}

async function getAppSession(): Promise<Session | null> {
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    return null;
  }

  const authUser = data.user;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", authUser.id)
    .single();

  if (profileError || !profile) {
    throw new Error(
      "Không thể tải hồ sơ người dùng: " +
        (profileError?.message ?? "Profile not found")
    );
  }

  const name = profile.full_name || authUser.email?.split("@")[0] || "User";

  const user: User = {
    id: authUser.id,
    name,
    email: authUser.email ?? "",
    role: profile.role as User["role"],
    avatarInitials: initials(name),
  };

  return { user, isDemo: false };
}

export const backendAuthRepository = {
  async login(email: string, password: string): Promise<Session> {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;

    const session = await getAppSession();
    if (!session) throw new Error("Không thể khôi phục phiên đăng nhập.");

    return session;
  },

  async register(
    name: string,
    email: string,
    password: string,
    role: User["role"]
  ): Promise<Session> {
    if (role !== "tenant" && role !== "landlord") {
      throw new Error("Vai trò đăng ký không hợp lệ.");
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name,
          role,
        },
      },
    });

    if (error) throw error;

    if (!data.session) {
      throw new Error(
        "Đăng ký đã được gửi. Vui lòng xác nhận email trước khi đăng nhập."
      );
    }

    const session = await getAppSession();
    if (!session) throw new Error("Không thể tải hồ sơ sau khi đăng ký.");

    return session;
  },

  async logout(): Promise<void> {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  async current(): Promise<Session | null> {
    return getAppSession();
  },
};
