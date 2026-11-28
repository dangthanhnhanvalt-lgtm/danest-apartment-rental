import {DailyTrend} from '~/components/dashboard-visuals';
import {useEffect,useState} from 'react';
import {readReportListings,readListingPeriodReport,type ListingPeriodReport,type ReportListing,type DailyReportRow} from '~/api/backend/reporting';
import {listingDailyCsv,listingCampaignCsv} from '~/lib/advanced-reporting';
import {downloadCsv,sumMetric} from '~/lib/reporting';
import {useI18n} from '~/i18n/language-context';
import {useAppState} from '~/state/app-state';
import {Button} from '~/components/ui/button';
import {LISTING_STATUS_LABEL_KEY} from '~/pages/admin/admin-helpers';
import type {ListingStatus} from '~/types';

type Metric=Exclude<keyof DailyReportRow,'day'>;
export function ListingPeriodReportPanel(){
 const {session}=useAppState();
 return <ReportPanel key={session?.user.id??'guest'}/>;
}
function ReportPanel(){
 const {pick,t}=useI18n();
 const [options,setOptions]=useState<ReportListing[]|null>(null),[optionError,setOptionError]=useState(''),[id,setId]=useState(''),[period,setPeriod]=useState(30),[revision,setRevision]=useState(0),[optionRevision,setOptionRevision]=useState(0);
 const [report,setReport]=useState<ListingPeriodReport|null>(null),[error,setError]=useState('');
 useEffect(()=>{let active=true;setOptions(null);setOptionError('');readReportListings().then(rows=>{if(active){setOptions(rows);setId(old=>rows.some(r=>r.id===old)?old:rows[0]?.id??'');}}).catch(e=>{if(active){setId('');setOptionError(e instanceof Error?e.message:String(e));}});return()=>{active=false;};},[optionRevision]);
 useEffect(()=>{let active=true;setReport(null);setError('');if(id&&options?.some(o=>o.id===id))readListingPeriodReport(id,period).then(r=>{if(active)setReport(r);}).catch(e=>{if(active)setError(e instanceof Error?e.message:String(e));});return()=>{active=false;};},[id,period,revision,options]);
 const metrics:{key:Metric;label:string}[]=[{key:'inquiries',label:pick('All new inquiries','Tất cả yêu cầu thuê mới')},{key:'firstViewings',label:pick('First confirmed viewings','Lịch xem xác nhận lần đầu')},{key:'ordinaryViews',label:pick('Ordinary detail views','Lượt xem tin thường')},{key:'sponsoredViews',label:pick('Sponsored detail views','Lượt xem tin nổi bật')},{key:'ordinaryInquiries',label:pick('Tracked ordinary inquiries','Yêu cầu tin thường (đã đo)')},{key:'sponsoredInquiries',label:pick('Tracked sponsored inquiries','Yêu cầu tin nổi bật (đã đo)')}];
 const fmt=(n:number|null)=>n===null?'—':n.toLocaleString();
 const filename=report?`danest-listing-${report.listingId}-${report.from}-${report.through}`:'danest-listing';
 const trend=(keys:Metric[],title:string)=>report?<DailyTrend rows={report.days} metrics={metrics.filter(m=>keys.includes(m.key)).sort((a,b)=>keys.indexOf(a.key)-keys.indexOf(b.key))} title={title}/>:null;
 return <section className="rounded-xl border bg-card p-4 space-y-4">
 <h2 className="font-semibold">{pick('Listing performance by period','Hiệu quả từng căn hộ theo kỳ')}</h2>
 <p className="text-sm text-muted-foreground">{pick('Vietnam calendar days; excludes legacy demo listings and sample inquiries. Campaign attribution is based on eligibility when the event occurred, not current status.','Theo ngày Việt Nam; không tính tin demo cũ và yêu cầu mẫu. Phân loại theo hiệu lực chiến dịch tại thời điểm phát sinh, không theo trạng thái hiện tại.')}</p>
 <div className="flex flex-wrap items-end gap-3"><label className="min-w-0 max-w-full text-sm">{pick('Listing','Căn hộ')}<select className="block max-w-full rounded border bg-background p-2" disabled={!options?.length} value={id} onChange={e=>{setReport(null);setId(e.target.value);}}>{!options?.length&&<option value="">{pick('No available options','Không có lựa chọn')}</option>}{options?.map(o=><option key={o.id} value={o.id}>{o.title} · {t(LISTING_STATUS_LABEL_KEY[o.status as ListingStatus]??o.status)}</option>)}</select></label><label className="text-sm">{pick('Period','Kỳ báo cáo')}<select className="block rounded border bg-background p-2" value={period} onChange={e=>{setReport(null);setPeriod(Number(e.target.value));}}>{[7,30,90].map(n=><option value={n} key={n}>{n} {pick('days','ngày')}</option>)}</select></label><Button variant="outline" onClick={()=>{setReport(null);setOptionRevision(n=>n+1);setRevision(n=>n+1);}}>{pick('Refresh','Làm mới')}</Button></div>
 {optionError?<p role="alert" className="text-destructive">{optionError}</p>:!options?<p aria-busy="true">{pick('Loading listings…','Đang tải căn hộ…')}</p>:!options.length?<p>{pick('No listings in your report scope.','Không có căn hộ trong phạm vi báo cáo.')}</p>:error?<p role="alert" className="text-destructive">{error}</p>:!report?<p aria-busy="true">{pick('Loading report…','Đang tải báo cáo…')}</p>:<>
 <p className="text-sm font-medium break-words">{report.title} · {report.from} — {report.through}</p>
 <p className="text-xs text-muted-foreground">{pick('Snapshot:','Thời điểm lấy số liệu:')} {new Date(report.asOf).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'})} · {pick('Tracking started:','Bắt đầu đo:')} {new Date(report.trackingStartedAt).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'})}</p>
 <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">{metrics.map(m=><div key={m.key} className="rounded-xl border border-border bg-card p-3"><p className="text-xs text-muted-foreground">{m.label}</p><p className="text-2xl font-semibold tabular-nums">{fmt(sumMetric(report.days,m.key))}</p></div>)}</div>
 {trend(['ordinaryViews','sponsoredViews'],pick('Daily detail views','Lượt xem chi tiết theo ngày'))}{trend(['ordinaryInquiries','sponsoredInquiries'],pick('Daily tracked inquiries','Yêu cầu thuê ghi nhận theo ngày'))}
 <p className="text-xs text-muted-foreground">{pick('— means no tracking coverage, not zero. Today and the first tracking day may be partial. Tracked inquiries may differ from all inquiries. Counts do not establish advertising lift or unique users.','— nghĩa là chưa có phạm vi đo, không phải 0. Ngày bắt đầu đo và hôm nay có thể chưa đủ 24 giờ. Yêu cầu đã đo có thể khác tổng yêu cầu. Số lượt không chứng minh hiệu quả nhân quả hay số người duy nhất.')}</p>
 <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={()=>downloadCsv(`${filename}-daily.csv`,listingDailyCsv(report))}>{pick('Export daily CSV','Xuất CSV theo ngày')}</Button><Button variant="outline" onClick={()=>downloadCsv(`${filename}-campaigns.csv`,listingCampaignCsv(report))}>{pick('Export campaign CSV','Xuất CSV chiến dịch')}</Button></div>
 <details><summary className="cursor-pointer font-medium text-sm">{pick('Daily data','Dữ liệu theo ngày')}</summary><div tabIndex={0} role="region" aria-label={pick("Daily data table","Bảng dữ liệu theo ngày")} className="overflow-x-auto mt-2"><table className="w-full text-sm text-left"><thead><tr><th className="p-2">{pick('Date','Ngày')}</th>{metrics.map(m=><th className="p-2" key={m.key}>{m.label}</th>)}</tr></thead><tbody>{report.days.map(d=><tr key={d.day} className="border-t"><td className="p-2 whitespace-nowrap">{d.day}</td>{metrics.map(m=><td key={m.key} className="p-2">{fmt(d[m.key])}</td>)}</tr>)}</tbody></table></div></details>
 <h3 className="text-sm font-medium">{pick('Campaigns in selected period','Chiến dịch trong kỳ đã chọn')}</h3>
 {!report.campaigns.length?<p className="text-sm text-muted-foreground">{pick('No campaigns in tracking scope for this period.','Không có chiến dịch thuộc phạm vi đo trong kỳ.')}</p>:<div tabIndex={0} role="region" aria-label={pick("Campaign data table","Bảng dữ liệu chiến dịch")} className="overflow-x-auto"><table className="w-full text-sm text-left"><thead><tr><th className="p-2">{pick('Campaign / scheduled dates','Chiến dịch / ngày dự kiến')}</th><th className="p-2">{pick('Detail views','Lượt xem')}</th><th className="p-2">{pick('Tracked inquiries','Yêu cầu đã đo')}</th></tr></thead><tbody>{report.campaigns.map(c=><tr className="border-t" key={c.id}><td className="p-2"><span title={c.id}>{c.id.slice(0,8)}</span><p className="text-xs">{c.startDate} — {c.endDate}</p>{c.endedAt&&<p className="text-xs">{pick('Closed:','Kết thúc:')} {new Date(c.endedAt).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'})}</p>}</td><td className="p-2">{fmt(c.views)}</td><td className="p-2">{fmt(c.inquiries)}</td></tr>)}</tbody></table></div>}
 </>}
 </section>;
}
