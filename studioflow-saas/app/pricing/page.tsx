import { changeSubscriptionPlan } from "@/app/actions";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/Button";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { getPlanUsage } from "@/lib/billing";
import { formatMoney, safeJsonList } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { getActiveStudio } from "@/lib/studio";

function orderLimitLabel(limit: number | null) {
  return typeof limit === "number" ? `${limit} orders` : "Unlimited orders";
}

export default async function PricingPage({
  searchParams
}: {
  searchParams?: Promise<{ billingMessage?: string }>;
}) {
  const studio = await getActiveStudio();
  const resolvedSearchParams = (await searchParams) ?? {};
  const [plans, subscription, invoices, paymentCustomer] = await Promise.all([
    prisma.subscriptionPlan.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.studioSubscription.findUnique({ where: { studioId: studio.id }, include: { plan: true } }),
    prisma.invoice.findMany({ where: { studioId: studio.id }, orderBy: { createdAt: "desc" }, take: 5 }),
    prisma.paymentCustomer.findUnique({ where: { studioId: studio.id } })
  ]);
  const usagePairs = await Promise.all(plans.map(async (plan) => [plan.id, await getPlanUsage(studio.id, plan)] as const));
  const usageByPlan = new Map(usagePairs);
  const currentPlanSort = subscription?.plan.sortOrder ?? 0;

  return (
    <AppShell>
      <PageHeader
        title="Pricing"
        description={`Local subscription structure for ${studio.name}. No real payment provider is connected yet.`}
        actions={<Button href="/billing" variant="primary">Open billing</Button>}
      />

      {resolvedSearchParams.billingMessage ? (
        <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800">
          {resolvedSearchParams.billingMessage}
        </div>
      ) : null}

      <section className="mb-6 grid gap-4 lg:grid-cols-[1fr_1fr]">
        <div className="rounded-2xl border border-studio-line bg-white p-5 shadow-soft">
          <p className="text-sm font-bold text-slate-500">Current studio plan</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <h2 className="text-2xl font-black text-studio-ink">{subscription?.plan.name ?? "No plan"}</h2>
            <StatusBadge status={subscription?.status ?? "Not configured"} />
          </div>
          <p className="mt-2 text-sm text-slate-600">
            Billing customer: {paymentCustomer ? `${paymentCustomer.provider} / ${paymentCustomer.providerCustomerId}` : "Not connected"}
          </p>
          <p className="mt-2 text-sm font-semibold text-slate-600">This MVP never stores card numbers, CVC, or bank details.</p>
        </div>
        <div className="rounded-2xl border border-studio-line bg-white p-5 shadow-soft">
          <p className="text-sm font-bold text-slate-500">Recent invoices for this studio</p>
          <div className="mt-3 grid gap-2 text-sm">
            {invoices.map((invoice) => (
              <div key={invoice.id} className="flex items-center justify-between rounded-xl bg-studio-paper p-3">
                <span className="font-bold text-studio-ink">{invoice.status}</span>
                <span>{formatMoney(invoice.amount)}</span>
              </div>
            ))}
            {invoices.length === 0 ? <p className="font-semibold text-slate-500">No invoices seeded for this studio.</p> : null}
          </div>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-4">
        {plans.map((plan) => {
          const usage = usageByPlan.get(plan.id);
          const isCurrent = subscription?.planId === plan.id;
          const actionLabel = isCurrent ? "Current plan" : plan.sortOrder > currentPlanSort ? "Fake upgrade" : "Fake downgrade";
          const blocked = Boolean(usage?.blockers.length);

          return (
            <article key={plan.id} className="rounded-2xl border border-studio-line bg-white p-6 shadow-soft">
              <div className="flex min-h-16 items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black text-studio-ink">{plan.name}</h2>
                  {isCurrent ? <p className="mt-1 text-xs font-black uppercase text-studio-orangeDark">Current subscription</p> : null}
                </div>
                <StatusBadge status={plan.bridgeAutomation ? "Bridge included" : "Manual bridge"} />
              </div>
              <p className="mt-3 text-4xl font-black text-studio-orange">
                {plan.priceDkk === 0 ? "Free" : formatMoney(plan.priceDkk * 100)}
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-500">per month</p>
              <p className="mt-4 text-sm text-slate-600">{plan.description}</p>
              <ul className="mt-5 grid gap-2 text-sm text-slate-700">
                {safeJsonList(plan.featuresJson).map((feature) => (
                  <li key={feature} className="rounded-xl bg-studio-paper p-3 font-semibold">{feature}</li>
                ))}
              </ul>
              <div className="mt-5 rounded-xl border border-studio-line p-3 text-sm text-slate-600">
                <p>Users: {plan.userLimit}</p>
                <p>{orderLimitLabel(plan.orderLimit)}</p>
                <p>Bridge automation: {plan.bridgeAutomation ? "Included" : "Not included"}</p>
              </div>
              {blocked ? (
                <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-800">
                  {usage?.blockers.join(" ")}
                </div>
              ) : null}
              <form action={changeSubscriptionPlan} className="mt-5">
                <input type="hidden" name="planId" value={plan.id} />
                <input type="hidden" name="returnTo" value="/pricing" />
                <Button type="submit" variant={isCurrent ? "secondary" : "primary"} disabled={isCurrent || blocked} className="w-full">
                  {actionLabel}
                </Button>
              </form>
            </article>
          );
        })}
      </div>
    </AppShell>
  );
}
