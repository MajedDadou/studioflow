import { changeSubscriptionPlan } from "@/app/actions";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/Button";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { FUTURE_PAYMENT_PROVIDERS, LOCAL_BILLING_PROVIDER, getPlanUsage } from "@/lib/billing";
import { formatDate, formatDateTime, formatMoney, safeJsonList } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { getActiveStudio } from "@/lib/studio";

function limitProgress(current: number, limit: number | null) {
  if (typeof limit !== "number") return "Unlimited";
  return `${current} / ${limit}`;
}

function payloadPreview(payload: string | null) {
  if (!payload) return "-";
  try {
    return JSON.stringify(JSON.parse(payload), null, 2);
  } catch {
    return payload;
  }
}

export default async function BillingPage({
  searchParams
}: {
  searchParams?: Promise<{ billingMessage?: string }>;
}) {
  const studio = await getActiveStudio();
  const resolvedSearchParams = (await searchParams) ?? {};
  const [plans, subscription, paymentCustomer, invoices, paymentEvents, currentUsage] = await Promise.all([
    prisma.subscriptionPlan.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.studioSubscription.findUnique({ where: { studioId: studio.id }, include: { plan: true } }),
    prisma.paymentCustomer.findUnique({ where: { studioId: studio.id } }),
    prisma.invoice.findMany({ where: { studioId: studio.id }, orderBy: { createdAt: "desc" }, take: 12 }),
    prisma.paymentEvent.findMany({ where: { studioId: studio.id }, orderBy: { createdAt: "desc" }, take: 12 }),
    getPlanUsage(studio.id)
  ]);
  const usagePairs = await Promise.all(plans.map(async (plan) => [plan.id, await getPlanUsage(studio.id, plan)] as const));
  const usageByPlan = new Map(usagePairs);
  const currentPlanSort = subscription?.plan.sortOrder ?? 0;

  return (
    <AppShell>
      <PageHeader
        title="Billing"
        description="Local billing simulator for private beta testing. Plan changes are database-only and never charge a card."
        actions={<Button href="/pricing">View pricing</Button>}
      />

      {resolvedSearchParams.billingMessage ? (
        <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800">
          {resolvedSearchParams.billingMessage}
        </div>
      ) : null}

      <section className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950">
        <h2 className="text-lg font-black">Payment integration status</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <p className="rounded-xl bg-white/80 p-4">Current provider mode: {LOCAL_BILLING_PROVIDER}</p>
          <p className="rounded-xl bg-white/80 p-4">Future providers prepared: {FUTURE_PAYMENT_PROVIDERS.join(" or ")}</p>
          <p className="rounded-xl bg-white/80 p-4">No card numbers, CVC, bank details, or payment methods are stored.</p>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1fr_1fr_1fr]">
        <div className="rounded-2xl border border-studio-line bg-white p-6 shadow-soft">
          <p className="text-sm font-bold text-slate-500">Current subscription</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <h2 className="text-2xl font-black text-studio-ink">{subscription?.plan.name ?? "No plan"}</h2>
            <StatusBadge status={subscription?.status ?? "Not configured"} />
          </div>
          <div className="mt-4 grid gap-2 text-sm text-slate-600">
            <p>Monthly price: {subscription ? formatMoney(subscription.plan.priceDkk * 100) : "-"}</p>
            <p>Started: {formatDate(subscription?.startedAt)}</p>
            <p>Trial ends: {formatDate(subscription?.trialEndsAt)}</p>
            <p>Renews: {formatDate(subscription?.renewsAt)}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-studio-line bg-white p-6 shadow-soft">
          <p className="text-sm font-bold text-slate-500">Plan usage</p>
          <div className="mt-4 grid gap-3 text-sm">
            <div className="rounded-xl bg-studio-paper p-3">
              <p className="font-black text-studio-ink">Users</p>
              <p className="mt-1">{limitProgress(currentUsage.activeUsers, currentUsage.userLimit)}</p>
            </div>
            <div className="rounded-xl bg-studio-paper p-3">
              <p className="font-black text-studio-ink">Orders</p>
              <p className="mt-1">{limitProgress(currentUsage.orderCount, currentUsage.orderLimit)}</p>
            </div>
            <div className="rounded-xl bg-studio-paper p-3">
              <p className="font-black text-studio-ink">Bridge automation</p>
              <p className="mt-1">{currentUsage.bridgeAutomationAvailable ? "Available" : "Dry-run only"}</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-studio-line bg-white p-6 shadow-soft">
          <p className="text-sm font-bold text-slate-500">Payment customer record</p>
          <div className="mt-4 grid gap-2 text-sm text-slate-600">
            <p>Provider: {paymentCustomer?.provider ?? "Not created yet"}</p>
            <p className="break-all">Customer ID: {paymentCustomer?.providerCustomerId ?? "-"}</p>
            <p>Created: {formatDateTime(paymentCustomer?.createdAt)}</p>
            <p className="font-semibold text-studio-ink">This is a local test customer record, not a stored payment method.</p>
          </div>
        </div>
      </section>

      {currentUsage.blockers.length > 0 ? (
        <section className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm font-semibold text-red-800">
          {currentUsage.blockers.join(" ")}
        </section>
      ) : null}

      <section className="mt-6 rounded-2xl border border-studio-line bg-white p-6 shadow-soft">
        <h2 className="text-lg font-black text-studio-ink">Manage plan locally</h2>
        <div className="mt-4 grid gap-4 xl:grid-cols-4">
          {plans.map((plan) => {
            const usage = usageByPlan.get(plan.id);
            const isCurrent = subscription?.planId === plan.id;
            const blocked = Boolean(usage?.blockers.length);
            const actionLabel = isCurrent ? "Current plan" : plan.sortOrder > currentPlanSort ? "Fake upgrade" : "Fake downgrade";

            return (
              <article key={plan.id} className="rounded-xl border border-studio-line p-4">
                <div className="flex min-h-14 items-start justify-between gap-3">
                  <h3 className="font-black text-studio-ink">{plan.name}</h3>
                  {isCurrent ? <StatusBadge status="Active" /> : null}
                </div>
                <p className="mt-2 text-2xl font-black text-studio-orange">{plan.priceDkk === 0 ? "Free" : formatMoney(plan.priceDkk * 100)}</p>
                <p className="mt-2 text-sm text-slate-600">{plan.description}</p>
                <ul className="mt-3 grid gap-2 text-sm text-slate-700">
                  {safeJsonList(plan.featuresJson).map((feature) => (
                    <li key={feature} className="rounded-lg bg-studio-paper p-2 font-semibold">{feature}</li>
                  ))}
                </ul>
                <div className="mt-3 text-sm text-slate-600">
                  <p>Users: {plan.userLimit}</p>
                  <p>Orders: {typeof plan.orderLimit === "number" ? plan.orderLimit : "Unlimited"}</p>
                  <p>Bridge: {plan.bridgeAutomation ? "Included" : "Dry-run only"}</p>
                </div>
                {blocked ? (
                  <p className="mt-3 rounded-lg bg-red-50 p-2 text-sm font-semibold text-red-800">{usage?.blockers.join(" ")}</p>
                ) : null}
                <form action={changeSubscriptionPlan} className="mt-4">
                  <input type="hidden" name="planId" value={plan.id} />
                  <input type="hidden" name="returnTo" value="/billing" />
                  <Button type="submit" variant={isCurrent ? "secondary" : "primary"} disabled={isCurrent || blocked} className="w-full">
                    {actionLabel}
                  </Button>
                </form>
              </article>
            );
          })}
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-studio-line bg-white p-6 shadow-soft">
        <h2 className="text-lg font-black text-studio-ink">Invoices</h2>
        <div className="mt-4 overflow-hidden rounded-xl border border-studio-line">
          <table>
            <thead>
              <tr>
                <th>Status</th>
                <th>Amount</th>
                <th>Provider invoice</th>
                <th>Issued</th>
                <th>Paid</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => (
                <tr key={invoice.id} className="border-t border-studio-line">
                  <td className="px-5 py-4"><StatusBadge status={invoice.status} /></td>
                  <td className="px-5 py-4 font-bold text-studio-ink">{formatMoney(invoice.amount)}</td>
                  <td className="break-all px-5 py-4 text-sm text-slate-600">{invoice.providerInvoiceId ?? "-"}</td>
                  <td className="px-5 py-4 text-sm text-slate-500">{formatDate(invoice.issuedAt)}</td>
                  <td className="px-5 py-4 text-sm text-slate-500">{formatDate(invoice.paidAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {invoices.length === 0 ? <p className="p-5 text-sm text-slate-600">No invoices yet.</p> : null}
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-studio-line bg-white p-6 shadow-soft">
        <h2 className="text-lg font-black text-studio-ink">Payment events</h2>
        <div className="mt-4 grid gap-3">
          {paymentEvents.map((event) => (
            <div key={event.id} className="rounded-xl bg-studio-paper p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="font-black text-studio-ink">{event.eventType}</p>
                <StatusBadge status={event.processedAt ? "Processed" : "Pending"} />
              </div>
              <p className="mt-1 break-all text-sm text-slate-600">{event.provider} / {event.externalId}</p>
              <pre className="mt-3 max-h-48 overflow-auto rounded-lg bg-white p-3 text-xs text-slate-700">{payloadPreview(event.payloadJson)}</pre>
            </div>
          ))}
          {paymentEvents.length === 0 ? <p className="rounded-xl bg-studio-paper p-4 text-sm text-slate-600">No payment events yet.</p> : null}
        </div>
      </section>
    </AppShell>
  );
}
