import type {DailyReportRow} from '~/api/backend/reporting';
export function csvCell(value:unknown):string {
  let text=value==null?'':String(value);
  // Excel formula injection protection, including initial whitespace and control characters.
  if(typeof value==='string' && /^[\s\uFEFF]*[=+\-@]|^[\t\r\n]/.test(text))text="'"+text;
  return '"'+text.replace(/"/g,'""')+'"';
}
export function makeCsv(rows:unknown[][]):string {return '\uFEFF'+rows.map(r=>r.map(csvCell).join(',')).join('\r\n');}
export function sumMetric(rows:DailyReportRow[],key:Exclude<keyof DailyReportRow,'day'>):number|null {const known=rows.map(r=>r[key]).filter((x):x is number=>typeof x==='number');return known.length?known.reduce((a,b)=>a+b,0):null;}
export function reportCsv(rows:DailyReportRow[]):string{return makeCsv([['date_vietnam','new_inquiries','first_confirmed_viewings','ordinary_detail_views','sponsored_detail_views','tracked_ordinary_inquiries','tracked_sponsored_inquiries'],...rows.map(r=>[r.day,r.inquiries,r.firstViewings,r.ordinaryViews,r.sponsoredViews,r.ordinaryInquiries,r.sponsoredInquiries])]);}
export function downloadCsv(filename:string,content:string){const url=URL.createObjectURL(new Blob([content],{type:'text/csv;charset=utf-8;'}));const a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export function vietnamDay(value:string):string{return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(value)).filter(p=>['year','month','day'].includes(p.type)).map(p=>[p.type,p.value]).sort((a,b)=>['year','month','day'].indexOf(a[0])-['year','month','day'].indexOf(b[0])).map(p=>p[1]).join('-');}
