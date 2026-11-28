import {listingRpc} from '~/api/supabase-listings';
export interface DailyReportRow {day:string;inquiries:number;firstViewings:number;ordinaryViews:number|null;sponsoredViews:number|null;ordinaryInquiries:number|null;sponsoredInquiries:number|null}
export interface PeriodReport {from:string;through:string;asOf:string;trackingStartedAt:string;days:DailyReportRow[]}
export interface PilotConfig {monthlyFeeVnd:number;priceMinUsd:number|null;priceMaxUsd:number|null}
export async function readPeriodReport(days:number):Promise<PeriodReport>{const data=await listingRpc('danest_admin_period_report_09d2',{p_days:days});if(!data||!Array.isArray(data.days)||data.days.length!==days)throw new Error('Invalid report response');return data as PeriodReport;}
export async function readPilotConfig():Promise<PilotConfig>{const data=await listingRpc('danest_pilot_config_09d2',{});if(!data||typeof data.monthlyFeeVnd!=='number')throw new Error('Invalid configuration response');return data as PilotConfig;}
export async function savePilotConfig(config:PilotConfig,reason:string):Promise<PilotConfig>{await listingRpc('danest_save_pilot_config_09d2',{p_fee:config.monthlyFeeVnd,p_min:config.priceMinUsd,p_max:config.priceMaxUsd,p_reason:reason});return readPilotConfig();}

export interface ReportListing {id:string;title:string;status:string}
export interface PeriodCampaign {id:string;startDate:string;endDate:string;endedAt:string|null;views:number;inquiries:number}
export interface ListingPeriodReport extends PeriodReport {listingId:string;title:string;campaigns:PeriodCampaign[]}
export async function readReportListings():Promise<ReportListing[]>{const data=await listingRpc('danest_report_listings_10a13',{});if(!Array.isArray(data))throw new Error('Invalid listing options');return data as ReportListing[];}
export async function readListingPeriodReport(id:string,days:number):Promise<ListingPeriodReport>{const data=await listingRpc('danest_listing_report_10a13',{p_listing_id:id,p_days:days});if(!data||data.listingId!==id||!Array.isArray(data.days)||data.days.length!==days||!Array.isArray(data.campaigns))throw new Error('Invalid listing report');return data as ListingPeriodReport;}
