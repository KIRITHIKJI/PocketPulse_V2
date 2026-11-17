import { ForgetDevice } from "@/components/offline/forget-device";
import type { Metadata } from "next";
import Link from "next/link";
import { ChartPie, PiggyBank, ShieldCheck, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Welcome" };

const PILLARS = [
  {
    icon: Zap,
    title: "Record in seconds",
    body: "One-tap tiles for tea, bus and snacks. Or type “tea 15, bus 20” and confirm.",
  },
  {
    icon: ChartPie,
    title: "Understand honestly",
    body: "Category trends and repeated small purchases, each backed by your actual entries.",
  },
  {
    icon: PiggyBank,
    title: "Save on purpose",
    body: "Earmark money for goals and see your Safe to Spend until your next allowance.",
  },
  {
    icon: ShieldCheck,
    title: "Private by default",
    body: "Nothing is shared with parents or anyone else unless you export it yourself.",
  },
] as const;

export default async function WelcomePage({
  searchParams,
}: {
  searchParams: Promise<{ deleted?: string }>;
}) {
  const { deleted } = await searchParams;
  return (
    <div className="flex flex-1 flex-col justify-center gap-12 py-8 lg:py-16">
      {deleted === "1" && (
        <>
          <ForgetDevice accountDeleted />
          <p role="status" className="type-body text-text-secondary">
            Your account and everything in it have been deleted.
          </p>
        </>
      )}
      <section className="flex max-w-3xl flex-col gap-6">
        <p className="type-label text-text-secondary">Track. Understand. Save.</p>
        <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl">
          Know where every <span className="money">₹10</span> goes.
        </h1>
        <p className="max-w-xl text-lg text-pretty text-text-secondary">
          PocketPulse makes logging tiny expenses effortless, shows you patterns without judgement,
          and helps your pocket money last.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button size="lg" asChild>
            <Link href="/register">Create account</Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/login">Sign in</Link>
          </Button>
        </div>
      </section>
      <ul className="grid gap-x-8 border-t border-(--section-divider) sm:grid-cols-2 lg:grid-cols-4">
        {PILLARS.map(({ icon: Icon, title, body }) => (
          <li
            key={title}
            className="flex flex-col gap-1.5 border-b border-(--section-divider) py-5 lg:border-b-0"
          >
            <h2 className="flex items-center gap-2 type-body font-medium">
              <Icon className="size-4 text-text-secondary" aria-hidden="true" />
              {title}
            </h2>
            <p className="type-body text-text-secondary">{body}</p>
          </li>
        ))}
      </ul>
      <p className="max-w-2xl type-caption text-text-secondary">
        PocketPulse reports only what you enter. Your tracked balance is not a verified bank
        balance, and no bank connection is required.
      </p>
    </div>
  );
}
