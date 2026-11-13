import * as React from "react";

import { HubTabs, type HubTabsKey } from "@/components/layout/hub-tabs";
import { cn } from "@/lib/utils";

/**
 * The one page title per view (`type-title`), a one-line description, the page's actions and, on
 * a hub's screens, the hub's tabs under them.
 */
export function PageHeader({
  title,
  description,
  actions,
  tabs,
  className,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  tabs?: HubTabsKey;
  className?: string;
}) {
  const heading = (
    <div className={cn("flex flex-wrap items-end justify-between gap-x-4 gap-y-3", className)}>
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="type-title text-balance">{title}</h1>
        {description ? (
          <p className="max-w-2xl type-body text-pretty text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
  if (!tabs) return heading;
  return (
    <div className="flex flex-col gap-4">
      {heading}
      <HubTabs hub={tabs} />
    </div>
  );
}
