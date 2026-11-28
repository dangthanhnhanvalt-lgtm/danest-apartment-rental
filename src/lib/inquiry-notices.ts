type NoticeLike={id:string;type:string;payload:Record<string,unknown>;message_read_at:string|null};
export const isMessageNotice=(n:NoticeLike)=>n.type==="inquiry-created"||(n.type==="inquiry-replied"&&n.payload?.event==="message");
export function loadedMessageNoticeIds(notices:NoticeLike[],messages:{id:string;sender_id:string}[],userId:string){
 const incoming=new Set(messages.filter(m=>m.sender_id!==userId).map(m=>m.id));
 return notices.filter(n=>isMessageNotice(n)&&!n.message_read_at&&(n.type==="inquiry-created"?incoming.size>0:typeof n.payload.message_id==="string"&&incoming.has(n.payload.message_id))).map(n=>n.id);
}
export function parseVietnamViewingTime(value:string):Date|null{
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))return null;
 const date=new Date(`${value}:00+07:00`);
 if(!Number.isFinite(date.getTime()))return null;
 const shifted=new Date(date.getTime()+7*3600000).toISOString().slice(0,16);
 return shifted===value?date:null;
}
