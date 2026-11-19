import type { Request, Response } from "express";
import { supabase } from "../config/supabase.ts";

const MONEY_FIELDS = [
  "revenue",
  "directCosts",
  "operatingExpenses",
  "cashBalance",
  "marketingSpend",
] as const;
const COUNT_FIELDS = ["newCustomers", "activeCustomers", "lostCustomers"] as const;

type SnapshotInput = {
  periodStart: string;
  currency: string;
  revenue: number;
  directCosts: number;
  operatingExpenses: number;
  cashBalance: number;
  marketingSpend: number;
  newCustomers: number;
  activeCustomers: number;
  lostCustomers: number;
  notes: string | null;
};

function validNumber(value: unknown, integer = false): value is number {
  return typeof value === "number" && Number.isFinite(value) &&
    value >= 0 && value <= 1_000_000_000_000 && (!integer || Number.isInteger(value));
}

export function validateHealthSnapshot(input: unknown): { value?: SnapshotInput; error?: string } {
  const body = input && typeof input === "object" ? input as Record<string, unknown> : {};
  const periodStart = typeof body.periodStart === "string" ? body.periodStart : "";
  if (!/^\d{4}-\d{2}-01$/.test(periodStart) || Number.isNaN(Date.parse(periodStart))) {
    return { error: "Choose a valid month. The date must be the first day of that month." };
  }
  const currency = typeof body.currency === "string" ? body.currency.trim().toUpperCase() : "";
  if (!/^[A-Z]{3}$/.test(currency)) return { error: "Enter a valid three-letter currency code." };

  const value: Record<string, unknown> = { periodStart, currency };
  for (const field of MONEY_FIELDS) {
    const raw = body[field] === "" || body[field] == null ? 0 : Number(body[field]);
    if (!validNumber(raw)) return { error: `${field} must be a non-negative amount.` };
    value[field] = Math.round(raw * 100) / 100;
  }
  for (const field of COUNT_FIELDS) {
    const raw = body[field] === "" || body[field] == null ? 0 : Number(body[field]);
    if (!validNumber(raw, true)) return { error: `${field} must be a non-negative whole number.` };
    value[field] = raw;
  }
  const notes = typeof body.notes === "string" ? body.notes.trim() : "";
  if (notes.length > 2000) return { error: "Notes must be 2,000 characters or fewer." };
  value.notes = notes || null;
  return { value: value as SnapshotInput };
}

function fromRow(row: any) {
  return {
    id: row.id,
    periodStart: row.period_start,
    currency: String(row.currency || "USD").trim(),
    revenue: Number(row.revenue),
    directCosts: Number(row.direct_costs),
    operatingExpenses: Number(row.operating_expenses),
    cashBalance: Number(row.cash_balance),
    marketingSpend: Number(row.marketing_spend),
    newCustomers: Number(row.new_customers),
    activeCustomers: Number(row.active_customers),
    lostCustomers: Number(row.lost_customers),
    notes: row.notes ?? "",
    updatedAt: row.updated_at,
  };
}

export function diagnoseBusinessHealth(rows: Array<Record<string, any>>) {
  const history = [...rows].sort((a, b) => String(a.period_start).localeCompare(String(b.period_start)));
  const latest = history.at(-1);
  if (!latest) return { status: "insufficient_data", metrics: null, issues: [], nextActions: [], history: [] };

  const revenue = Number(latest.revenue) || 0;
  const directCosts = Number(latest.direct_costs) || 0;
  const operatingExpenses = Number(latest.operating_expenses) || 0;
  const cash = Number(latest.cash_balance) || 0;
  const marketing = Number(latest.marketing_spend) || 0;
  const newCustomers = Number(latest.new_customers) || 0;
  const activeCustomers = Number(latest.active_customers) || 0;
  const lostCustomers = Number(latest.lost_customers) || 0;
  const grossProfit = revenue - directCosts;
  const operatingProfit = grossProfit - operatingExpenses;
  const monthlyNetBurn = Math.max(0, -operatingProfit);
  const runwayMonths = monthlyNetBurn > 0 ? cash / monthlyNetBurn : null;
  const grossMargin = revenue > 0 ? (grossProfit / revenue) * 100 : null;
  const operatingMargin = revenue > 0 ? (operatingProfit / revenue) * 100 : null;
  const acquisitionCost = newCustomers > 0 ? marketing / newCustomers : null;
  const churnRate = activeCustomers + lostCustomers > 0
    ? (lostCustomers / (activeCustomers + lostCustomers)) * 100
    : null;

  const issues: Array<{ severity: "critical" | "warning" | "info"; title: string; detail: string }> = [];
  const nextActions: string[] = [];
  if (revenue === 0) {
    issues.push({ severity: "warning", title: "No revenue recorded", detail: "This month has no recorded revenue. If the business is pre-revenue, track customer validation and conversion milestones instead of treating this as a bookkeeping failure." });
    nextActions.push("Record qualified leads, trials and paid conversions so the next review can identify where sales are getting stuck.");
  }
  if (grossProfit < 0) {
    issues.push({ severity: "critical", title: "Direct costs exceed revenue", detail: "The business is losing money before overheads. Each additional sale may increase the loss until pricing or delivery costs change." });
    nextActions.push("Review unit economics: supplier costs, delivery time, discounts and price per sale. Model a price or cost change before applying it.");
  } else if (grossMargin !== null && grossMargin < 25) {
    issues.push({ severity: "warning", title: "Thin gross margin", detail: `Gross margin is ${grossMargin.toFixed(1)}%. A small cost increase could erase the contribution available for overheads.` });
    nextActions.push("Identify the three largest direct-cost drivers and test whether pricing, packaging or fulfilment can improve contribution per sale.");
  }
  if (monthlyNetBurn > 0 && runwayMonths !== null && runwayMonths < 3) {
    issues.push({ severity: "critical", title: "Less than three months of runway", detail: `At the latest recorded net burn, available cash covers approximately ${runwayMonths.toFixed(1)} months.` });
    nextActions.push("Prepare a 13-week cash plan, pause non-essential commitments and contact creditors or funders early. Recalculate after every material cash change.");
  } else if (monthlyNetBurn > 0 && runwayMonths !== null && runwayMonths < 6) {
    issues.push({ severity: "warning", title: "Runway needs attention", detail: `Available cash covers approximately ${runwayMonths.toFixed(1)} months at the latest recorded net burn.` });
    nextActions.push("Build a 6-month cash forecast and set a weekly spending review before runway falls further.");
  }
  if (marketing > 0 && newCustomers === 0) {
    issues.push({ severity: "warning", title: "Marketing spend has no recorded acquisition", detail: "Marketing spend was recorded, but no new customers were attributed to it. This may indicate weak conversion or missing attribution." });
    nextActions.push("Tag leads by channel and track the path from enquiry to paid customer before increasing campaign spend.");
  } else if (acquisitionCost !== null && revenue > 0 && activeCustomers > 0) {
    const revenuePerActiveCustomer = revenue / activeCustomers;
    if (acquisitionCost > revenuePerActiveCustomer) {
      issues.push({ severity: "warning", title: "Acquisition cost exceeds monthly revenue per active customer", detail: `Estimated acquisition cost is ${acquisitionCost.toFixed(2)} per new customer, versus ${revenuePerActiveCustomer.toFixed(2)} revenue per active customer this month. This is a warning signal, not lifetime value.` });
      nextActions.push("Measure customer lifetime value and payback period by acquisition channel before scaling spend.");
    }
  }
  if (churnRate !== null && churnRate >= 8) {
    issues.push({ severity: churnRate >= 15 ? "critical" : "warning", title: "Customer losses are elevated", detail: `${churnRate.toFixed(1)}% of the active-plus-lost customer count is recorded as lost this month. Confirm the definition is consistent month to month.` });
    nextActions.push("Contact recently lost customers, categorise their reasons for leaving and fix the most common preventable cause.");
  }
  const previous = history.at(-2);
  if (previous && String(previous.currency || "USD").trim() === String(latest.currency || "USD").trim() && Number(previous.revenue) > 0 && revenue < Number(previous.revenue) * 0.85) {
    const decline = (1 - revenue / Number(previous.revenue)) * 100;
    issues.push({ severity: "warning", title: "Revenue has dropped materially", detail: `Revenue is down ${decline.toFixed(1)}% compared with the previous recorded month.` });
    nextActions.push("Break revenue down by product, customer and channel to locate the source of the decline before changing the whole sales strategy.");
  }
  if (operatingExpenses > revenue && revenue > 0 && monthlyNetBurn > 0) {
    issues.push({ severity: "warning", title: "Overheads are larger than current revenue", detail: "Operating expenses alone exceed recorded revenue, before considering direct costs." });
  }
  if (issues.length === 0) {
    issues.push({ severity: "info", title: "No immediate warning detected", detail: "The figures entered do not trigger the current diagnostic rules. Continue recording monthly data; this is not an audit or a guarantee of financial health." });
    nextActions.push("Keep the monthly figures consistent and review changes in margin, customer acquisition and cash runway.");
  }

  const criticalCount = issues.filter((item) => item.severity === "critical").length;
  const warningCount = issues.filter((item) => item.severity === "warning").length;
  const status = criticalCount > 0 ? "critical" : warningCount > 0 ? "attention" : "stable";
  return {
    status,
    metrics: {
      currency: String(latest.currency || "USD").trim(),
      grossProfit: Math.round(grossProfit * 100) / 100,
      grossMargin: grossMargin === null ? null : Math.round(grossMargin * 10) / 10,
      operatingProfit: Math.round(operatingProfit * 100) / 100,
      operatingMargin: operatingMargin === null ? null : Math.round(operatingMargin * 10) / 10,
      monthlyNetBurn: Math.round(monthlyNetBurn * 100) / 100,
      runwayMonths: runwayMonths === null ? null : Math.round(runwayMonths * 10) / 10,
      customerAcquisitionCost: acquisitionCost === null ? null : Math.round(acquisitionCost * 100) / 100,
      churnRate: churnRate === null ? null : Math.round(churnRate * 10) / 10,
    },
    issues,
    nextActions: [...new Set(nextActions)].slice(0, 8),
    history: history.map((row) => ({ periodStart: row.period_start, revenue: Number(row.revenue), expenses: Number(row.direct_costs) + Number(row.operating_expenses), cash: Number(row.cash_balance) })),
  };
}

export async function getBusinessHealth(req: Request, res: Response) {
  try {
    const { data, error } = await supabase
      .from("business_health_snapshots")
      .select("id, period_start, currency, revenue, direct_costs, operating_expenses, cash_balance, marketing_spend, new_customers, active_customers, lost_customers, notes, updated_at")
      .eq("business_id", req.businessMembership!.businessId)
      .order("period_start", { ascending: false })
      .limit(24);
    if (error) {
      console.error("Business health read failed:", error);
      return res.status(500).json({ error: "Unable to load business health records." });
    }
    const rows = data ?? [];
    return res.set("Cache-Control", "private, no-store").json({
      data: { snapshots: rows.map(fromRow), diagnosis: diagnoseBusinessHealth(rows) },
    });
  } catch (error) {
    console.error("Business health read threw:", error);
    return res.status(500).json({ error: "Unable to load business health records." });
  }
}

export async function saveBusinessHealth(req: Request, res: Response) {
  const validation = validateHealthSnapshot(req.body);
  if (!validation.value) return res.status(400).json({ error: validation.error });
  const value = validation.value;
  try {
    const { data, error } = await supabase
      .from("business_health_snapshots")
      .upsert({
        business_id: req.businessMembership!.businessId,
        recorded_by: req.user!.id,
        period_start: value.periodStart,
        currency: value.currency,
        revenue: value.revenue,
        direct_costs: value.directCosts,
        operating_expenses: value.operatingExpenses,
        cash_balance: value.cashBalance,
        marketing_spend: value.marketingSpend,
        new_customers: value.newCustomers,
        active_customers: value.activeCustomers,
        lost_customers: value.lostCustomers,
        notes: value.notes,
        updated_at: new Date().toISOString(),
      }, { onConflict: "business_id,period_start" })
      .select("id, period_start, currency, revenue, direct_costs, operating_expenses, cash_balance, marketing_spend, new_customers, active_customers, lost_customers, notes, updated_at")
      .single();
    if (error || !data) {
      console.error("Business health save failed:", error);
      return res.status(500).json({ error: "Unable to save this month's business figures." });
    }
    const { data: rows, error: readError } = await supabase
      .from("business_health_snapshots")
      .select("id, period_start, currency, revenue, direct_costs, operating_expenses, cash_balance, marketing_spend, new_customers, active_customers, lost_customers, notes, updated_at")
      .eq("business_id", req.businessMembership!.businessId)
      .order("period_start", { ascending: false })
      .limit(24);
    if (readError) {
      console.error("Business health refresh failed:", readError);
      return res.status(500).json({ error: "Figures saved, but the updated diagnosis could not be loaded. Refresh the page." });
    }
    return res.status(201).json({
      data: { snapshot: fromRow(data), snapshots: (rows ?? []).map(fromRow), diagnosis: diagnoseBusinessHealth(rows ?? []) },
    });
  } catch (error) {
    console.error("Business health save threw:", error);
    return res.status(500).json({ error: "Unable to save this month's business figures." });
  }
}
