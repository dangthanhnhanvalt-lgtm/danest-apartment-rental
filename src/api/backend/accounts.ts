import { supabase } from "~/lib/supabase";
import type { AdminUser } from "~/types";

// Calls are guarded by the phase 03 database policies and checked RPC.
export const backendAccountsRepository = {
  async list(): Promise<AdminUser[]> {
    const role = await supabase.rpc("danest_active_role");
    if (role.error) throw role.error;
    if (role.data !== "admin") throw new Error("Admin permission required");
    const result: AdminUser[] = [];
    for (let offset = 0; ; offset += 100) {
      const { data, error } = await supabase.from("profiles")
        .select("id,full_name,role,account_status,approved_at,created_at,is_sample")
        .order("id").range(offset, offset + 99);
      if (error) throw error;
      const ids = (data ?? []).map(row => row.id);
      const emails = ids.length ? await supabase.rpc("danest_admin_account_emails_09e1", {p_ids:ids}) : {data:[],error:null};
      if (emails.error) throw emails.error;
      const emailById = new Map<string,string>((emails.data ?? []).map((r:{user_id:string;login_email:string})=>[r.user_id,r.login_email ?? ""]));
      for (const row of data ?? []) {
        if (!["tenant", "landlord", "admin"].includes(row.role) ||
            !["active", "pending", "rejected", "suspended"].includes(row.account_status)) throw new Error("Unexpected profile values");
        const [listings, inquiries] = await Promise.all([
          supabase.from("properties").select("id", { count: "exact", head: true }).eq("owner_id", row.id),
          row.role === "landlord"
            ? supabase.from("inquiries").select("id,properties!inner(owner_id)", { count: "exact", head: true }).eq("properties.owner_id", row.id)
            : supabase.from("inquiries").select("id", { count: "exact", head: true }).eq("tenant_id", row.id),
        ]);
        if (listings.error) throw listings.error;
        if (inquiries.error) throw inquiries.error;
        result.push({ id: row.id, name: row.full_name || "User", email: emailById.get(row.id) ?? "", role: row.role,
          status: row.account_status, approvedAt: row.approved_at, joinedAt: row.created_at,
          listings: listings.count ?? 0, inquiries: inquiries.count ?? 0, isSample: row.is_sample });
      }
      if (!data || data.length < 100) break;
    }
    return result;
  },
  async setStatus(id: string, status: AdminUser["status"], reason: string): Promise<void> {
    const { error } = await supabase.rpc("danest_set_account_status", {
      p_user_id: id, p_status: status, p_reason: reason.trim(),
    });
    if (error) throw error;
  },
};
