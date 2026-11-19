import "./testEnv.ts";
import assert from "node:assert/strict";
import { diagnoseBusinessHealth, validateHealthSnapshot } from "../controllers/businessHealthController.ts";

const valid = validateHealthSnapshot({
  periodStart: "2026-10-01",
  currency: "NGN",
  revenue: 500000,
  directCosts: 150000,
  operatingExpenses: 250000,
  cashBalance: 400000,
  marketingSpend: 60000,
  newCustomers: 20,
  activeCustomers: 80,
  lostCustomers: 5,
  notes: "October close",
});
assert.ok(valid.value, "a complete monthly snapshot is accepted");
assert.equal(valid.value?.currency, "NGN");
assert.equal(validateHealthSnapshot({ ...valid.value, periodStart: "2026-10-12" }).error?.includes("first day"), true);
assert.equal(validateHealthSnapshot({ ...valid.value, revenue: -1 }).error?.includes("non-negative"), true);
assert.equal(validateHealthSnapshot({ ...valid.value, newCustomers: 1.5 }).error?.includes("whole number"), true);
assert.equal(validateHealthSnapshot({ ...valid.value, currency: "N" }).error?.includes("currency"), true);

const critical = diagnoseBusinessHealth([{
  period_start: "2026-10-01",
  currency: "NGN",
  revenue: 100000,
  direct_costs: 70000,
  operating_expenses: 80000,
  cash_balance: 20000,
  marketing_spend: 15000,
  new_customers: 0,
  active_customers: 40,
  lost_customers: 8,
}]);
assert.equal(critical.status, "critical", "short runway is classified as critical");
assert.equal(critical.metrics?.monthlyNetBurn, 50000);
assert.equal(critical.metrics?.runwayMonths, 0.4);
assert.ok(critical.issues.some(issue => issue.title === "Marketing spend has no recorded acquisition"));
assert.ok(critical.nextActions.length > 0);

const stable = diagnoseBusinessHealth([{
  period_start: "2026-10-01",
  currency: "NGN",
  revenue: 500000,
  direct_costs: 100000,
  operating_expenses: 100000,
  cash_balance: 1000000,
  marketing_spend: 0,
  new_customers: 10,
  active_customers: 100,
  lost_customers: 1,
}]);
assert.equal(stable.status, "stable");
assert.equal(diagnoseBusinessHealth([]).status, "insufficient_data");
const currencyChange = diagnoseBusinessHealth([
  { period_start: "2026-09-01", currency: "NGN", revenue: 500000, direct_costs: 100000, operating_expenses: 100000, cash_balance: 1000000, marketing_spend: 0, new_customers: 10, active_customers: 100, lost_customers: 1 },
  { period_start: "2026-10-01", currency: "USD", revenue: 100, direct_costs: 10, operating_expenses: 10, cash_balance: 1000, marketing_spend: 0, new_customers: 10, active_customers: 100, lost_customers: 1 },
]);
assert.equal(currencyChange.issues.some(issue => issue.title === "Revenue has dropped materially"), false,
  "revenue trends are not compared across different currencies");


console.log("Business health validation and diagnostic tests passed.");
