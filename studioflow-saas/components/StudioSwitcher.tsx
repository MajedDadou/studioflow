"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Studio } from "@prisma/client";
import { switchStudio } from "@/app/actions";

export function StudioSwitcher({
  studios,
  activeStudioId
}: {
  studios: Studio[];
  activeStudioId: string;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <label className="text-xs font-bold uppercase tracking-wide text-slate-500">
      Fake login studio
      <select
        value={activeStudioId}
        disabled={pending}
        className="mt-2 w-full"
        onChange={(event) => {
          const formData = new FormData();
          formData.set("studioId", event.target.value);
          startTransition(async () => {
            await switchStudio(formData);
            router.refresh();
          });
        }}
      >
        {studios.map((studio) => (
          <option key={studio.id} value={studio.id}>
            {studio.name}
          </option>
        ))}
      </select>
    </label>
  );
}
