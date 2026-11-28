// Presentation only: the existing validation and persistence remain authoritative.
export const listingFormSteps = [["basics","size"],["location"],["photos"],["amenities"],["costs"],["rental","terms"],["review"]] as const;
export function stepForSection(section:string):number {const i=listingFormSteps.findIndex(group=>(group as readonly string[]).includes(section));return i<0?0:i;}
export function clampListingStep(step:number):number{return Math.max(0,Math.min(listingFormSteps.length-1,Math.trunc(Number.isFinite(step)?step:0)));}
