import { createClient } from "npm:@supabase/supabase-js@2";

// Server only. Never copy a service role key into a VITE_ variable.
const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store, private",
  "X-Content-Type-Options": "nosniff",
};
const fail = (status: number, error: string) => new Response(JSON.stringify({error}), {status,headers:{...headers,"Content-Type":"application/json"}});
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null,{status:204,headers});
  if (req.method !== "POST") return fail(405,"Method not allowed");
  try {
    const token = req.headers.get("Authorization")?.match(/^Bearer (\S+)$/i)?.[1];
    if (!token) return fail(401,"Sign in required");
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) return fail(503,"Server configuration missing");
    const admin = createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
    // The actor is always derived from an Auth-verified token, never the request body.
    const {data:auth,error:authError} = await admin.auth.getUser(token);
    if (authError || !auth.user) return fail(401,"Invalid user session");
    const body = await req.json().catch(()=>null);
    const id = body?.evidence_id;
    if (typeof id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return fail(400,"Invalid evidence ID");
    // This RPC checks active Admin status and writes an access-request audit record.
    const {data:path,error} = await admin.rpc("danest_authorize_evidence_access",{p_actor_id:auth.user.id,p_evidence_id:id});
    if (error || typeof path !== "string") return fail(403,"Evidence access denied or unavailable");
    const ext = path.split(".").pop()?.toLowerCase() ?? "";
    const mime: Record<string,string> = {jpg:"image/jpeg",jpeg:"image/jpeg",png:"image/png",pdf:"application/pdf"};
    if (!mime[ext]) return fail(415,"Unsupported evidence type");
    const {data:file,error:downloadError} = await admin.storage.from("verification-evidence").download(path);
    if (downloadError || !file || !file.size || file.size > 10*1024*1024) return fail(404,"Evidence file unavailable");
    // Record retrieval only after the storage read succeeds. Fail closed if logging fails.
    const {error:deliveryError} = await admin.rpc("danest_record_evidence_delivery",{p_actor_id:auth.user.id,p_evidence_id:id});
    if (deliveryError) return fail(503,"Could not record evidence retrieval");
    return new Response(file,{status:200,headers:{...headers,"Content-Type":mime[ext],"Content-Disposition":`attachment; filename="danest-evidence-${id}.${ext}"`}});
  } catch { return fail(500,"Evidence request failed"); }
});
