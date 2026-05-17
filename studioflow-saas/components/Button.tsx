import clsx from "clsx";
import Link from "next/link";
import type { ReactNode } from "react";

type ButtonProps = {
  children: ReactNode;
  href?: string;
  type?: "button" | "submit";
  variant?: "primary" | "secondary" | "ghost" | "danger";
  className?: string;
  name?: string;
  value?: string;
  disabled?: boolean;
};

const variants = {
  primary: "bg-studio-orange text-white hover:bg-studio-orangeDark border-studio-orange",
  secondary: "bg-white text-studio-ink hover:border-studio-orange border-studio-line",
  ghost: "bg-transparent text-slate-700 hover:bg-white border-transparent",
  danger: "bg-red-50 text-red-700 hover:border-red-300 border-red-200"
};

export function Button({
  children,
  href,
  type = "button",
  variant = "secondary",
  className,
  name,
  value,
  disabled
}: ButtonProps) {
  const classes = clsx(
    "inline-flex min-h-11 items-center justify-center rounded-xl border px-4 py-2.5 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-50",
    variants[variant],
    className
  );

  if (href) {
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    );
  }

  return (
    <button type={type} name={name} value={value} disabled={disabled} className={classes}>
      {children}
    </button>
  );
}
