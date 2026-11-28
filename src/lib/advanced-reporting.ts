import type {AdminKpis} from '~/api/admin';
import type {ListingPeriodReport} from '~/api/backend/reporting';
import {makeCsv} from './reporting';
// Keep raw numeric units, nulls as blank; export the already displayed snapshot, never fetch again on export.
export function snapshotRows(k:AdminKpis,accounts:{landlords:number;renters:number}|null):unknown[][] {
 const countTotal=Object.values(k.counts).reduce((a,b)=>a+b,0)||1;
 return [['metric','value','unit','snapshot_at'],
 ...([
 ['active_listings',k.activeListings,'count'],['complete_info',k.completePercent,'percent'],['verified_listings',k.verifiedPercent,'percent'],['inquiries',k.inquiries,'count'],
 ['average_first_response',k.averageFirstResponseHours,'hours'],['median_first_response',k.medianFirstResponseHours,'hours'],['response_within_24h',k.responseWithin24HoursPercent,'percent'],['response_24h_denominator',k.responseWithin24HoursDenominator,'count'],['viewing_conversion',k.viewingConversionPercent,'percent'],['overdue',k.overduePercent,'percent'],['overdue_listings',k.overdueListings,'count'],['unknown_confirmation',k.unknownConfirmationListings,'count'],['sponsored_listings',k.sponsoredListings,'count'],['awaiting_response_24h',k.awaitingResponse24Hours,'count'],['registered_users',k.totalUsers,'count'],['landlords',accounts?.landlords??null,'count'],['renters',accounts?.renters??null,'count'],['demo_listings',k.demoListings,'count'],['includes_demo',k.includesDemo,'boolean'],['requiring_attention',k.requiringAttention,'count'],
 ...Object.entries(k.counts).flatMap(([s,n])=>[[`status_${s}`,n,'count'],[`status_${s}_share`,Math.round(n/countTotal*100),'percent']])
 ] as unknown[][]).map(row=>[...row,k.asOf])];
}
export function snapshotCsv(k:AdminKpis,accounts:{landlords:number;renters:number}|null){return makeCsv(snapshotRows(k,accounts));}
export function listingDailyCsv(r:ListingPeriodReport){return makeCsv([['listing_id','listing_title','date_vietnam','new_inquiries','first_confirmed_viewings','ordinary_detail_views','sponsored_detail_views','tracked_ordinary_inquiries','tracked_sponsored_inquiries','snapshot_at','tracking_started_at'],...r.days.map(d=>[r.listingId,r.title,d.day,d.inquiries,d.firstViewings,d.ordinaryViews,d.sponsoredViews,d.ordinaryInquiries,d.sponsoredInquiries,r.asOf,r.trackingStartedAt])]);}
export function listingCampaignCsv(r:ListingPeriodReport){return makeCsv([['listing_id','listing_title','campaign_id','campaign_start','campaign_end','ended_at','period_from','period_through','detail_views','tracked_inquiries','snapshot_at','tracking_started_at'],...r.campaigns.map(c=>[r.listingId,r.title,c.id,c.startDate,c.endDate,c.endedAt,r.from,r.through,c.views,c.inquiries,r.asOf,r.trackingStartedAt])]);}
