import type { AdminSettings, Listing } from "~/types";
export const DEFAULT_ADMIN_SETTINGS:AdminSettings={availabilityGraceDays:3,availabilityReminderDays:14};
export type AvailabilityState="fresh"|"reminder"|"overdue"|"hidden"|"unknown";
export interface AvailabilityStatus {daysSinceConfirmed:number;state:AvailabilityState;reminderDue:boolean;graceDaysLeft:number;hideAfterDays:number}
export function availabilityStatus(listing:Listing,settings?:AdminSettings,now=new Date()):AvailabilityStatus{
  const DAY=86400000;
  const confirmed=Date.parse(listing.lastAvailabilityConfirmedAt), reminded=Date.parse(listing.availabilityReminderSentAt??"");
  const known=Number.isFinite(confirmed), days=known?Math.max(0,Math.floor((+now-confirmed)/DAY)):0;
  const reminderRecorded=Number.isFinite(reminded)&&(!known||reminded>=confirmed);
  const due=known&&!!settings&&+now-confirmed>settings.availabilityReminderDays*DAY;
  const state:AvailabilityState=listing.status==="hidden"&&listing.availabilityHiddenAt?"hidden":!known?"unknown":due||reminderRecorded?"overdue":"fresh";
  return {daysSinceConfirmed:days,state,reminderDue:due||reminderRecorded,graceDaysLeft:settings&&reminderRecorded?Math.max(0,Math.ceil((reminded+settings.availabilityGraceDays*DAY-+now)/DAY)):settings?.availabilityGraceDays??0,hideAfterDays:settings?settings.availabilityReminderDays+settings.availabilityGraceDays:0};
}
export function isPubliclyVisible(listing:Listing):boolean{return listing.status==="published";}
