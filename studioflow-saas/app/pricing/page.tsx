import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { prisma } from "@/lib/prisma";
import { formatMoney, safeJsonList } from "@/lib/format";

export default async function PricingPage() {
  const plans = await prisma.subscriptionPlan.findMany({ orderBy: { sortOrder: "asc" } });

  return (
    <AppShell>
      <PageHeader
        title="Pricing"
        description="Database-backed subscription structure for future SaaS packaging. Stripe is intentionally not integrated in this MVP."
      />
      <div className="grid gap-5 xl:grid-cols-4">
        {plans.map((plan) => (
          <article key={plan.id} className="rounded-2xl border border-studio-line bg-white p-6 shadow-soft">
            <h2 className="text-xl font-black text-studio-ink">{plan.name}</h2>
            <p className="mt-3 text-4xl font-black text-studio-orange">
              {plan.priceDkk === 0 ? "Free" : formatMoney(plan.priceDkk * 100)}
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-500">per month</p>
            <p className="mt-4 text-sm text-slate-600">{plan.description}</p>
            <ul className="mt-5 grid gap-2 text-sm text-slate-700">
              {safeJsonList(plan.featuresJson).map((feature) => <li key={feature} className="rounded-xl bg-studio-paper p-3 font-semibold">{feature}</li>)}
            </ul>
            <div className="mt-5 rounded-xl border border-studio-line p-3 text-sm text-slate-600">
              <p>Users: {plan.userLimit}</p>
              <p>Order limit: {plan.orderLimit ?? "Unlimited"}</p>
              <p>Bridge automation: {plan.bridgeAutomation ? "Included" : "Not included"}</p>
            </div>
          </article>
        ))}
      </div>
    </AppShell>
  );
}
