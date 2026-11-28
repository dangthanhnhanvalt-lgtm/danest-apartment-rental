import { useState } from "react";
import { Calculator, CircleHelp, Info } from "lucide-react";
import { formatUSD, summarizeCosts, summarizeStay, rentalMonthOptions, knownCost, knownRate, usageBasedCost, estimateUsage } from "~/lib/format";
import { useI18n } from "~/i18n/language-context";
import type { Listing } from "~/types";

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 py-1.5">
      <span className={muted ? "text-sm text-muted-foreground" : "text-sm text-foreground"}>{label}</span>
      <span className={muted ? "text-sm text-muted-foreground" : "text-sm font-medium text-foreground"}>{value}</span>
    </div>
  );
}



export function CostBreakdown({ listing }: { listing: Listing }) {
  const { t, pick } = useI18n();
  const monthsOptions=rentalMonthOptions(listing);
  const [selected,setSelected]=useState<number>(monthsOptions[0]??0);
  const months=monthsOptions.includes(selected)?selected:(monthsOptions[0]??0);
  const [quantities,setQuantities]=useState<Record<string,string>>({});
  const calculated=estimateUsage(listing,quantities);
  const stay=summarizeStay(calculated,months);
  const amount=(i:Listing["costs"]["items"][number])=>knownCost(i)?formatUSD(i.amount!,true):t("cost.notProvided");
  const estimateTag = (
    <span className="rounded border border-border bg-muted px-1.5 py-0.5 text-xs font-semibold text-warning">
      {t("cost.estimate")}
    </span>
  );
  const summary = summarizeCosts(calculated);
  const rates=listing.costs.items.filter(usageBasedCost);
  const monthlyItems = listing.costs.items.filter((i) => i.cadence === "monthly" && !usageBasedCost(i));
  const fixedItems = monthlyItems.filter((i) => i.state === "fixed" && knownCost(i));
  const variableItems = monthlyItems.filter((i) => (i.state === "variable" || i.state === "reported") && knownCost(i));
  const unknownItems = monthlyItems.filter((i) => !knownCost(i));
  const oneTimeItems = listing.costs.items.filter((i) => i.cadence === "one-time");

  const segments = [{label:t("cost.monthlyRent"),value:calculated.costs.monthlyRent,color:"#172C3D"},{label:pick("Known monthly extras","Phụ phí tháng đã biết"),value:summary.confirmedMonthly-calculated.costs.monthlyRent,color:"#829987"},{label:pick("Estimated monthly extras","Phụ phí tháng ước tính"),value:summary.estimatedMonthly-summary.confirmedMonthly,color:"#D9CBB8"}];
  const chartValid=summary.estimatedMonthly>0&&segments.every(s=>Number.isFinite(s.value)&&s.value>=0);
  return (
    <section aria-labelledby="cost-breakdown-title" className="rounded-2xl border border-border bg-card p-5 md:p-6" style={{ boxShadow: "var(--shadow-surface)" }}>
      <div className="flex items-center gap-2">
        <Calculator className="size-5 text-link" aria-hidden="true" />
        <h2 id="cost-breakdown-title" className="text-xl font-semibold text-foreground">
          {t("cost.title")}
        </h2>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{t("cost.subtitle")}</p>

      <div className="mt-5 rounded-xl border border-border bg-[#F1F3EF] p-4 text-[#172C3D] dark:bg-muted dark:text-foreground sm:p-5">
        <p className="text-xs font-semibold uppercase tracking-wider">{t("cost.estimatedMonthly")}</p>
        <p className="mt-1 text-3xl font-bold tabular-nums">{formatUSD(summary.estimatedMonthly,true)}</p>
        {summary.unknownItems.length>0&&<p className="mt-2 text-sm font-medium text-[#845820] dark:text-warning">{t("cost.unknownWarn",{count:summary.unknownItems.length})}</p>}
        {chartValid&&<><div className="mt-4 flex h-3 overflow-hidden rounded-full bg-card" aria-hidden="true">{segments.map(s=><span key={s.label} style={{width:`${s.value/summary.estimatedMonthly*100}%`,background:s.color}}/>)}</div>
          <dl className="mt-3 space-y-2">{segments.map(s=><div key={s.label} className="flex items-center gap-2 text-sm"><span className="size-2.5 shrink-0 rounded-sm" style={{background:s.color}} aria-hidden="true"/><dt className="flex-1">{s.label}</dt><dd className="font-semibold tabular-nums">{formatUSD(s.value,true)}</dd></div>)}</dl></>}
      </div>
      <div className="mt-4 divide-y divide-border">
        <div className="flex items-baseline justify-between gap-3 pb-2">
          <span className="text-base font-medium text-foreground">{t("cost.monthlyRent")}</span>
          <span className="text-base font-semibold text-foreground">{formatUSD(listing.costs.monthlyRent,true)}</span>
        </div>

        {fixedItems.length > 0 ? (
          <div className="py-3">
            <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">{t("cost.fixed")}</p>
            {fixedItems.map((item) => (
              <Row key={item.id} label={`${item.label} · ${item.unit}`} value={amount(item)} />
            ))}
          </div>
        ) : null}

        {variableItems.length > 0 ? (
          <div className="py-3">
            <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">{t("cost.metered")}</p>
            {variableItems.map((item) => (
              <div key={item.id} className="flex flex-wrap items-baseline justify-between gap-2 py-1.5">
                <span className="flex flex-wrap items-center gap-2 text-sm text-foreground">
                  {item.label} · {item.unit}
                  {estimateTag}
                </span>
                <span className="text-sm font-medium text-foreground">{amount(item)}</span>
              </div>
            ))}
          </div>
        ) : null}

        {unknownItems.length > 0 ? (
          <div className="py-3">
            <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">{t("cost.notProvidedTitle")}</p>
            {unknownItems.map((item) => (
              <div key={item.id} className="flex flex-wrap items-baseline justify-between gap-2 py-1.5">
                <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <CircleHelp className="size-3.5" aria-hidden="true" />
                  {item.label} · {item.unit}
                </span>
                <span className="text-sm text-muted-foreground">{t("cost.notProvided")}</span>
              </div>
            ))}
          </div>
        ) : null}

        {rates.length>0&&<div className="py-3 space-y-3"><p className="text-xs font-semibold uppercase text-muted-foreground">{pick("Usage-based fees — enter estimated monthly usage","Phí theo mức sử dụng — nhập lượng ước tính mỗi tháng")}</p>{rates.map(i=><div key={i.id} className="space-y-1"><Row label={`${i.label} · ${i.unit}`} value={knownRate(i)?formatUSD(i.amount!,true):t("cost.notProvided")}/>{knownRate(i)&&<label className="block text-xs text-muted-foreground">{pick("Monthly quantity","Số lượng mỗi tháng")}<input aria-label={`${i.label} ${pick("monthly quantity","số lượng mỗi tháng")}`} type="number" min={0} max={1000000} step="any" className="mt-1 w-full rounded-lg border border-border bg-background p-2" value={quantities[i.id]??""} onChange={e=>setQuantities(prev=>({...prev,[i.id]:e.target.value}))} placeholder={pick("Not estimated","Chưa ước tính")}/></label>}</div>)}</div>}
        {oneTimeItems.length > 0 ? (
          <div className="py-3">
            <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">{t("cost.oneTime")}</p>
            {oneTimeItems.map((item) => (
              <Row key={item.id} label={`${item.label} · ${item.unit}`} value={amount(item)} />
            ))}
          </div>
        ) : null}
      </div>

      <div className="mt-4 space-y-3 rounded-xl border border-border bg-background p-4">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-base font-medium text-foreground">{t("cost.estimatedInitial")}</span>
          <span className="text-lg font-semibold text-foreground">{formatUSD(summary.initialPayment.estimated,true)}</span>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-sm text-muted-foreground">
            {t("cost.deposit", { count: listing.costs.depositMonths })}
          </span>
          <span className="text-sm font-medium text-foreground">{formatUSD(listing.costs.depositAmount,true)}</span>
        </div>
        {summary.oneTimeTotal > 0 ? (
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-sm text-muted-foreground">{t("cost.oneTime")}</span>
            <span className="text-sm font-medium text-foreground">{formatUSD(summary.oneTimeTotal,true)}</span>
          </div>
        ) : null}
        {summary.unknownItems.length > 0 ? (
          <p className="text-sm text-warning">
            {t("cost.unknownWarn", { count: summary.unknownItems.length })}
          </p>
        ) : null}
      </div>

      <div className="mt-4 space-y-3 rounded-xl border border-border bg-card p-4">
        <label className="block text-sm font-semibold">{t("cost.stayDuration")}
          <select className="mt-2 w-full rounded-lg border border-border bg-background p-2" value={months} disabled={!monthsOptions.length} onChange={e=>setSelected(Number(e.target.value))}>
            {!monthsOptions.length && <option value={0}>{t("cost.notProvided")}</option>}
            {monthsOptions.map(m=><option key={m} value={m}>{m} {t(m===1?"common.month":"common.months")}</option>)}
          </select>
        </label>
        {stay && <><Row label={t("cost.stayExclDeposit")} value={formatUSD(stay.withoutDeposit,true)} /><Row label={t("cost.stayInclDeposit")} value={formatUSD(stay.withDeposit,true)} /></>}
        <p className="text-xs text-muted-foreground">{pick("Assumes first month's known and estimated costs are paid on move-in. One-time fees are counted once; deposit is shown separately. Unknown costs are excluded.","Giả định trả chi phí tháng đầu khi nhận nhà. Phí một lần chỉ tính một lần; tiền cọc được tách riêng. Khoản chưa biết không được tính vào tổng.")}</p>
      </div>
      <p className="mt-4 flex gap-2 text-sm text-muted-foreground">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        {t("cost.disclaimer")}
      </p>
    </section>
  );
}
