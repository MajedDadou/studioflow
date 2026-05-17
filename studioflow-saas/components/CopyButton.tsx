"use client";

import { useState } from "react";

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      className="inline-flex min-h-11 items-center justify-center rounded-xl border border-studio-line bg-white px-4 py-2.5 text-sm font-bold text-studio-ink transition hover:border-studio-orange"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1800);
      }}
    >
      {copied ? "Copied" : "Copy generated email"}
    </button>
  );
}
