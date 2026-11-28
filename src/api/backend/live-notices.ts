import {useEffect,useRef,useState} from "react";
import {supabase} from "~/lib/supabase";
import {readNotifications,isMessageNotice,type Notice} from "~/api/backend/engagement";
let channelSeq=0;
export function useLiveNotices(userId:string|undefined, refresh:()=>void|Promise<void>){
 const cb=useRef(refresh);cb.current=refresh;
 useEffect(()=>{
  if(!userId)return;
  let disposed=false, running=false, pending=false;
  let timer:ReturnType<typeof setTimeout>|undefined;
  const run=async()=>{if(disposed)return;if(running){pending=true;return;}running=true;try{await cb.current();}catch{/* consumer owns errors */}finally{running=false;if(pending&&!disposed){pending=false;queue();}}};
  const queue=()=>{if(disposed||timer!==undefined)return;timer=setTimeout(()=>{timer=undefined;void run();},180);};
  const ch=supabase.channel(`dn-notices-${userId}-${++channelSeq}`).on("postgres_changes",{event:"INSERT",schema:"public",table:"notifications",filter:`recipient_id=eq.${userId}`},queue).on("postgres_changes",{event:"UPDATE",schema:"public",table:"notifications",filter:`recipient_id=eq.${userId}`},queue).subscribe(status=>{if(status==="SUBSCRIBED")queue();});
  const poll=setInterval(()=>{if(document.visibilityState==="visible")queue();},30000);
  window.addEventListener("focus",queue);document.addEventListener("visibilitychange",queue);
  queue();return()=>{disposed=true;if(timer!==undefined)clearTimeout(timer);clearInterval(poll);window.removeEventListener("focus",queue);document.removeEventListener("visibilitychange",queue);void supabase.removeChannel(ch);};
 },[userId]);
}
export function useNoticeCounts(userId:string|undefined){
 const [data,setData]=useState<{id:string;rows:Notice[]}|null>(null);
 useLiveNotices(userId,async()=>{if(!userId)return;try{setData({id:userId,rows:await readNotifications(userId)});}catch{setData(null);}});
 const rows=data?.id===userId?data?.rows??[]:[];
 return {notifications:rows.filter(n=>!n.read_at).length,messages:rows.filter(n=>isMessageNotice(n)&&!n.message_read_at).length};
}
