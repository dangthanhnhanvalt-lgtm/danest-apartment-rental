import { createClient } from "npm:@supabase/supabase-js@2";
import { createEmail, classifyResult, validWorkerSecret } from "./mail.ts";
const respond=(status:number,body:object)=>new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json","Cache-Control":"no-store"}});
Deno.serve(async(req:Request)=>{
 if(req.method!=="POST")return respond(405,{error:"method"});
 const secret=Deno.env.get("DANEST_MAIL_WORKER_SECRET")??"";
 if(!validWorkerSecret(secret,req.headers.get("x-danest-worker-secret")??""))return respond(401,{error:"unauthorized"});
 const key=Deno.env.get("RESEND_API_KEY"); const from=Deno.env.get("DANEST_MAIL_FROM");
 const url=Deno.env.get("SUPABASE_URL");const service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
 if(Deno.env.get("DANEST_MAIL_ENABLED")!=="true"||!key||!from||!url||!service)return respond(503,{error:"mail_disabled_or_not_configured"});
 const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
 const counts={accepted:0,retry:0,permanent_failure:0,skipped:0};
 try{
  for(let i=0;i<5;i++){
   const {data:q,error}=await admin.rpc("danest_claim_email_10a14");if(error)throw error;if(!q)break;if(q.skipped){counts.skipped++;continue;}
   let result:"accepted"|"retry"|"permanent_failure"="retry";let providerId:string|null=null;
   try{
    const body=createEmail(q.type,q.email,from);
    const res=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${key}`,"Content-Type":"application/json","Idempotency-Key":`danest-notification-${q.id}`},body:JSON.stringify(body),signal:AbortSignal.timeout(8000)});
    const parsed=await res.json().catch(()=>null);result=classifyResult(res.status,parsed?.id);if(result==="accepted")providerId=parsed.id;
   }catch{result="retry";}
   const {data:finished,error:finishError}=await admin.rpc("danest_finish_email_10a14",{p_id:q.id,p_lease:q.lease,p_result:result,p_provider_id:providerId});if(finishError||!finished)throw new Error("finish_not_recorded");counts[result]++;
  }
  return respond(200,counts);
 }catch{return respond(503,{error:"worker_failed",...counts});}
});
