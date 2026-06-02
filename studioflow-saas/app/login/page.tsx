import Link from "next/link";
import { Button } from "@/components/Button";
import { loginDevUser } from "@/app/actions";
import { getLoginOptions, getOptionalAuthContext } from "@/lib/auth";

export default async function LoginPage() {
  const [users, context] = await Promise.all([getLoginOptions(), getOptionalAuthContext()]);

  return (
    <main className="min-h-screen bg-studio-paper px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/" className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-studio-orange text-sm font-black text-white">
              SF
            </span>
            <span>
              <span className="block text-lg font-black tracking-normal text-studio-ink">StudioFlow</span>
              <span className="block text-xs font-semibold text-slate-500">Development login</span>
            </span>
          </Link>
          {context ? <Button href="/dashboard" variant="primary">Continue to dashboard</Button> : null}
        </header>

        <section className="rounded-2xl border border-studio-line bg-white p-6 shadow-soft">
          <div className="max-w-3xl">
            <p className="mb-3 inline-flex rounded-full bg-orange-50 px-3 py-1 text-xs font-black uppercase text-studio-orangeDark">
              Auth-ready local mode
            </p>
            <h1 className="text-3xl font-black tracking-normal text-studio-ink">Choose a demo user</h1>
            <p className="mt-3 text-sm text-slate-600">
              This is still a development login, but it now uses real user, membership, studio, and role records. A future Clerk, Auth.js, or Supabase Auth integration can replace only this login boundary.
            </p>
          </div>

          {context ? (
            <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
              Signed in as <strong>{context.user.name}</strong> for <strong>{context.studio.name}</strong> with role <strong>{context.role.name}</strong>.
            </div>
          ) : null}
        </section>

        <section className="mt-6 grid gap-4 lg:grid-cols-2">
          {users.map((user) => (
            <article key={user.id} className="rounded-2xl border border-studio-line bg-white p-5 shadow-soft">
              <div className="flex flex-col gap-1">
                <h2 className="text-xl font-black text-studio-ink">{user.name}</h2>
                <p className="text-sm text-slate-600">{user.email}</p>
              </div>

              <div className="mt-4 grid gap-3">
                {user.memberships.map((membership) => (
                  <form key={membership.id} action={loginDevUser} className="rounded-xl bg-studio-paper p-4">
                    <input type="hidden" name="userId" value={user.id} />
                    <input type="hidden" name="studioId" value={membership.studioId} />
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-black text-studio-ink">{membership.studio.name}</p>
                        <p className="mt-1 text-sm text-slate-600">
                          {membership.role.name} - {membership.studio.subscription?.plan.name ?? "No plan"} plan
                        </p>
                      </div>
                      <Button type="submit" variant="primary">Sign in</Button>
                    </div>
                  </form>
                ))}
                {user.memberships.length === 0 ? (
                  <p className="rounded-xl bg-studio-paper p-4 text-sm font-semibold text-slate-500">
                    This user has no active studio memberships.
                  </p>
                ) : null}
              </div>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
