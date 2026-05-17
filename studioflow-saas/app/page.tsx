import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatMoney } from "@/lib/format";
import { Button } from "@/components/Button";

export default async function LandingPage() {
  const plans = await prisma.subscriptionPlan.findMany({ orderBy: { sortOrder: "asc" } });

  return (
    <main className="min-h-screen bg-studio-paper">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6">
        <Link href="/" className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-studio-orange text-sm font-black text-white">
            SF
          </span>
          <span className="text-lg font-black text-studio-ink">StudioFlow</span>
        </Link>
        <nav className="flex items-center gap-3">
          <Button href="/login" variant="ghost">Studio switcher</Button>
          <Button href="/dashboard" variant="primary">Open demo</Button>
        </nav>
      </header>

      <section className="mx-auto grid max-w-7xl gap-10 px-6 py-12 lg:grid-cols-[1fr_0.9fr] lg:items-center">
        <div>
          <p className="mb-4 inline-flex rounded-full bg-orange-100 px-4 py-2 text-sm font-bold text-studio-orangeDark">
            Internal workflow for photo studios
          </p>
          <h1 className="max-w-4xl text-5xl font-black leading-tight tracking-normal text-studio-ink lg:text-6xl">
            Turn photo selections into clear orders, retouch tasks, and folder plans.
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-slate-600">
            StudioFlow is not another gallery or booking platform. It is an internal order and retouch workflow tool for photo studios.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button href="/dashboard" variant="primary">Test the MVP</Button>
            <Button href="/pricing">View pricing preview</Button>
          </div>
        </div>

        <div className="photo-grid rounded-[2rem] border border-studio-line p-5 shadow-soft">
          <div className="grid gap-4">
            <div className="rounded-2xl bg-white p-5 shadow-soft">
              <p className="text-sm font-bold text-slate-500">Order FG-2026-0001</p>
              <div className="mt-4 grid gap-3">
                {["IMG_1023.CR3 - Print 20x30 - Standard retouch", "1025 - Canvas - Background cleanup", "IMG_1024.CR3 - Digital image"].map((line) => (
                  <div key={line} className="rounded-xl border border-studio-line bg-studio-paper px-4 py-3 text-sm font-semibold text-studio-ink">
                    {line}
                  </div>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-2xl bg-white p-5 shadow-soft">
                <p className="text-sm font-bold text-slate-500">Retouch</p>
                <p className="mt-2 text-3xl font-black text-studio-orange">7</p>
                <p className="text-sm text-slate-600">tasks waiting</p>
              </div>
              <div className="rounded-2xl bg-white p-5 shadow-soft">
                <p className="text-sm font-bold text-slate-500">Bridge</p>
                <p className="mt-2 text-3xl font-black text-emerald-600">Dry-run</p>
                <p className="text-sm text-slate-600">safe by default</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-5 px-6 py-10 md:grid-cols-3">
        <div className="rounded-2xl border border-studio-line bg-white p-6 shadow-soft">
          <h2 className="text-xl font-black text-studio-ink">The problem</h2>
          <p className="mt-3 text-sm text-slate-600">
            Photo studios often track selections, frames, products, and retouch notes on paper or scattered messages.
          </p>
        </div>
        <div className="rounded-2xl border border-studio-line bg-white p-6 shadow-soft">
          <h2 className="text-xl font-black text-studio-ink">The solution</h2>
          <p className="mt-3 text-sm text-slate-600">
            StudioFlow connects customers, sessions, selected files, products, retouch tasks, deadlines, and safe folder plans.
          </p>
        </div>
        <div className="rounded-2xl border border-studio-line bg-white p-6 shadow-soft">
          <h2 className="text-xl font-black text-studio-ink">How it works</h2>
          <p className="mt-3 text-sm text-slate-600">
            Create a session, build an order from selected filenames, generate retouch communication, and preview local folder automation.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-10">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-3xl font-black text-studio-ink">Pricing preview</h2>
            <p className="mt-2 text-sm text-slate-600">Subscription structure only. No payment integration in this MVP.</p>
          </div>
          <Button href="/pricing">Open pricing page</Button>
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          {plans.map((plan) => (
            <div key={plan.id} className="rounded-2xl border border-studio-line bg-white p-5 shadow-soft">
              <h3 className="text-lg font-black text-studio-ink">{plan.name}</h3>
              <p className="mt-2 text-2xl font-black text-studio-orange">
                {plan.priceDkk === 0 ? "Free" : formatMoney(plan.priceDkk * 100)}
              </p>
              <p className="mt-2 text-sm text-slate-600">{plan.description}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
