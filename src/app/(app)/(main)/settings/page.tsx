import type { Metadata, Route } from "next";
import Link from "next/link";
import {
  Bell,
  ChevronRight,
  Cloud,
  Download,
  IndianRupee,
  ListChecks,
  Palette,
  ShieldCheck,
  Tags,
  Trophy,
  UserRound,
  Wallet,
} from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { AppearanceSettings } from "@/components/preferences/appearance-settings";
import {
  IncomeForm,
  ProfileNameForm,
  RegionForm,
  SpendingForm,
} from "@/components/settings/settings-forms";
import { PrivacyForm, ProgressForm, RemindersForm } from "@/components/settings/preference-forms";
import { Button } from "@/components/ui/button";
import { getProfile, getReminderPreferences, hasAnyTransactions } from "@/lib/data/queries";
import { requestToday, requireSession } from "@/lib/data/session";
import { timeZoneOptions } from "@/lib/format";

export const metadata: Metadata = { title: "Settings" };

type Icon = typeof Cloud;

/** The in-page sections, in order. Each one is a section below with the same `id`. */
const SECTIONS: { id: string; label: string; icon: Icon }[] = [
  { id: "profile", label: "Profile", icon: UserRound },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "money", label: "Money", icon: IndianRupee },
  { id: "reminders", label: "Reminders", icon: Bell },
  { id: "progress", label: "Progress", icon: Trophy },
  { id: "privacy", label: "Privacy", icon: ShieldCheck },
  { id: "sync", label: "Sync", icon: Cloud },
  { id: "data", label: "Data", icon: Download },
];

/** The sub-pages, listed under the sections on desktop (each section also links to its own). */
const PAGES: { href: Route; label: string; icon: Icon }[] = [
  { href: "/settings/privacy", label: "Privacy details", icon: ShieldCheck },
  { href: "/settings/sync", label: "Sync", icon: Cloud },
  { href: "/settings/data", label: "Your data", icon: Download },
];

const MORE: { href: Route; title: string; description: string; icon: Icon }[] = [
  {
    href: "/accounts",
    title: "Accounts",
    description: "Opening balances, default wallet, archive.",
    icon: Wallet,
  },
  {
    href: "/categories",
    title: "Categories",
    description: "Subcategories, rules, merge, uncategorized.",
    icon: Tags,
  },
  {
    href: "/onboarding",
    title: "Setup guide",
    description: "Walk through the first-time setup again.",
    icon: ListChecks,
  },
];

const NAV_LINK =
  "flex min-h-11 items-center gap-2 rounded-md px-3 type-body text-text-secondary outline-none transition-colors duration-(--duration-quick) hover:bg-muted hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50";

/**
 * Jump links: a row that scrolls sideways on phones (so the settings themselves come first), a
 * quiet sticky column on laptops. No box.
 */
function SettingsNav() {
  return (
    <nav aria-label="Settings sections" className="lg:sticky lg:top-24">
      <div className="flex flex-col gap-2">
        <ul className="-mx-gutter flex [scrollbar-width:none] gap-1 overflow-x-auto px-gutter max-sm:[mask-image:linear-gradient(to_right,#000_calc(100%-2rem),transparent)] lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0 [&::-webkit-scrollbar]:hidden">
          {SECTIONS.map(({ id, label, icon: Icon }) => (
            <li key={id} className="shrink-0">
              <a href={`#${id}`} className={NAV_LINK}>
                <Icon className="hidden size-4 shrink-0 lg:block" aria-hidden="true" />
                <span className="truncate">{label}</span>
              </a>
            </li>
          ))}
        </ul>
        <div className="hidden flex-col gap-1 border-t border-(--section-divider) pt-2 lg:flex">
          <p className="px-3 pt-1 type-caption text-text-tertiary">Pages</p>
          <ul className="flex flex-col gap-1">
            {PAGES.map(({ href, label, icon: Icon }) => (
              <li key={href}>
                <Link href={href} className={NAV_LINK}>
                  <Icon className="size-4 shrink-0" aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate">{label}</span>
                  <ChevronRight className="size-4 shrink-0" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </nav>
  );
}

/** One settings group: its name and one line beside the controls on laptops, a hairline above. */
function SettingsSection({
  id,
  headingId,
  title,
  description,
  children,
}: {
  id: string;
  headingId: string;
  title: string;
  description?: string | undefined;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      role="region"
      aria-labelledby={headingId}
      className="grid scroll-mt-24 gap-stack border-t border-(--section-divider) py-section first:border-t-0 first:pt-0 xl:grid-cols-[13rem_minmax(0,1fr)] xl:gap-x-10"
    >
      <div className="flex min-w-0 flex-col gap-0.5">
        <h2 id={headingId} className="type-heading">
          {title}
        </h2>
        {description && (
          <p className="type-caption break-words text-text-secondary">{description}</p>
        )}
      </div>
      <div className="flex min-w-0 flex-col gap-stack">{children}</div>
    </section>
  );
}

/** One of the forms inside the Money section; each still saves on its own. */
function SubSection({
  headingId,
  title,
  description,
  children,
}: {
  headingId: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-labelledby={headingId}
      className="flex flex-col gap-stack py-4 first:pt-0 last:pb-0"
    >
      <div className="flex flex-col gap-0.5">
        <h3 id={headingId} className="scroll-mt-24 type-body font-medium">
          {title}
        </h3>
        {description && <p className="type-caption text-text-secondary">{description}</p>}
      </div>
      {children}
    </section>
  );
}

function PageLink({ href, children }: { href: Route; children: React.ReactNode }) {
  return (
    <Button variant="outline" asChild className="self-start">
      <Link href={href}>
        {children}
        <ChevronRight aria-hidden="true" />
      </Link>
    </Button>
  );
}

export default async function SettingsPage() {
  const session = await requireSession();
  const [profile, reminders, locked] = await Promise.all([
    getProfile(),
    getReminderPreferences(),
    hasAnyTransactions(),
  ]);
  const today = requestToday(profile.timeZone);

  return (
    <>
      <PageHeader
        title="Settings"
        description="Saved to your account and the same on every device."
      />
      <div className="grid gap-6 lg:grid-cols-12 lg:items-start lg:gap-x-12">
        <div className="min-w-0 lg:col-span-3">
          <SettingsNav />
        </div>
        <div className="flex min-w-0 flex-col lg:col-span-9">
          <SettingsSection
            id="profile"
            headingId="settings-profile"
            title="Profile"
            description={session.email ?? undefined}
          >
            <ProfileNameForm displayName={profile.displayName} />
          </SettingsSection>
          <SettingsSection
            id="appearance"
            headingId="settings-appearance"
            title="Appearance"
            description="Saved to your account as soon as you choose."
          >
            <AppearanceSettings />
          </SettingsSection>
          <SettingsSection
            id="money"
            headingId="settings-money"
            title="Money"
            description="Currency, income for planning, and what counts as small."
          >
            <div className="flex flex-col divide-y divide-(--section-divider)">
              <SubSection headingId="settings-region" title="Currency & region">
                <RegionForm
                  currency={profile.currency}
                  timeZone={profile.timeZone}
                  weekStartsOn={profile.weekStartsOn}
                  timeZones={timeZoneOptions(profile.timeZone)}
                  currencyLocked={locked}
                />
              </SubSection>
              <SubSection
                headingId="settings-income"
                title="Allowance & income"
                description="For planning only. Money counts once you record it."
              >
                <IncomeForm
                  incomeFrequency={profile.incomeFrequency}
                  nextIncomeDate={profile.nextIncomeDate}
                  expectedIncomePaise={profile.expectedIncomePaise}
                  today={today}
                />
              </SubSection>
              <SubSection headingId="settings-spending" title="Spending insights">
                <SpendingForm thresholdPaise={profile.smallPurchaseThresholdPaise} />
              </SubSection>
            </div>
          </SettingsSection>
          <SettingsSection
            id="reminders"
            headingId="settings-reminders"
            title="Reminders"
            description="Optional and quiet by default."
          >
            <RemindersForm prefs={reminders} />
          </SettingsSection>
          <SettingsSection
            id="progress"
            headingId="settings-progress"
            title="Progress"
            description="Rewards for logging and reviewing. Optional."
          >
            <ProgressForm showProgress={profile.showProgress} />
          </SettingsSection>
          <SettingsSection id="privacy" headingId="settings-privacy" title="Privacy">
            <PrivacyForm includeNotesInReports={profile.includeNotesInReports} />
            <PageLink href="/settings/privacy">See what’s stored</PageLink>
          </SettingsSection>
          <SettingsSection
            id="sync"
            headingId="settings-sync"
            title="Sync"
            description="Pending, synced and failed entries on this device."
          >
            <PageLink href="/settings/sync">Open sync</PageLink>
          </SettingsSection>
          <SettingsSection
            id="data"
            headingId="settings-data"
            title="Your data"
            description="Export everything or delete your account."
          >
            <PageLink href="/settings/data">Export or delete</PageLink>
          </SettingsSection>
          <section
            role="region"
            aria-labelledby="settings-more"
            className="grid gap-stack border-t border-(--section-divider) py-section xl:grid-cols-[13rem_minmax(0,1fr)] xl:gap-x-10"
          >
            <h2 id="settings-more" className="type-heading">
              More settings
            </h2>
            <ul className="flex flex-col divide-y divide-(--section-divider)">
              {MORE.map(({ href, title, description, icon: Icon }) => (
                <li key={href}>
                  <Link
                    href={href}
                    className="group -mx-2 flex min-h-14 items-center gap-3 rounded-md px-2 py-2 transition-colors duration-(--duration-quick) outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  >
                    <Icon className="size-4 shrink-0 text-text-secondary" aria-hidden="true" />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="type-body font-medium">{title}</span>
                      <span className="type-caption text-text-secondary">{description}</span>
                    </span>
                    <ChevronRight
                      className="size-4 shrink-0 text-text-secondary"
                      aria-hidden="true"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </>
  );
}
