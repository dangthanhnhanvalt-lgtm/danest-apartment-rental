// Presentation only; no changes to KPI formulas or report coverage.
export function distribution(values: readonly number[]) {
 const total=values.reduce((a,b)=>a+b,0);
 return {total,segments:values.map((count,i)=>({count,percent:total>0?count/total*100:0,offset:total>0?values.slice(0,i).reduce((a,b)=>a+b,0)/total*100:0}))};
}
export function chartBar(value:number|null,max:number):number|null {
 return value===null?null:Math.max(0,Math.min(100,value/Math.max(1,max)*100));
}
