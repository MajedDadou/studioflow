"use client";

import clsx from "clsx";
import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  ["Dashboard", "/dashboard"],
  ["Customers", "/customers"],
  ["Sessions", "/sessions"],
  ["Orders", "/orders"],
  ["Retouch Tasks", "/retouch"],
  ["Products", "/products"],
  ["Retouchers", "/retouchers"],
  ["Local Bridge", "/local-bridge"],
  ["Email Templates", "/email-templates"],
  ["Reports", "/reports"],
  ["Settings", "/settings"],
  ["Pricing", "/pricing"]
];

export function NavLinks() {
  const pathname = usePathname();

  return (
    <nav className="mt-5 grid gap-1 sm:grid-cols-2 lg:grid-cols-1">
      {links.map(([label, href]) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={clsx(
              "rounded-xl px-3 py-2.5 text-sm font-bold transition",
              active
                ? "bg-studio-orange text-white shadow-sm"
                : "text-slate-700 hover:bg-studio-paper hover:text-studio-orangeDark"
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
