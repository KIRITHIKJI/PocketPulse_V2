import { Info } from "lucide-react";

/**
 * What Home's figures are and aren't, said once behind an info icon instead of under every
 * figure. A native disclosure: no JavaScript, keyboard and screen readers get it for free. The
 * note floats over the hero; the nearest positioned ancestor (the hero) places it.
 */
export function FiguresInfo({ untracked }: { untracked: number }) {
  return (
    <details className="group inline-block align-middle normal-case">
      <summary
        aria-label="About these figures"
        className="-m-2.5 flex size-10 cursor-pointer list-none items-center justify-center rounded-full text-text-secondary outline-none group-open:text-foreground hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 pointer-coarse:size-11 [&::-webkit-details-marker]:hidden"
      >
        <Info className="size-3.5" aria-hidden="true" />
      </summary>
      <div className="absolute inset-x-0 top-7 z-20 flex flex-col gap-2 rounded-xl border border-(--panel-border) bg-popover p-4 type-caption font-normal tracking-normal text-popover-foreground shadow-(--elevation-2) sm:right-auto sm:w-96">
        <p>
          <strong className="font-semibold">Tracked balance</strong> is your opening balances plus
          what you’ve recorded, across every account, cards and loans included. It isn’t a bank
          balance.
          {untracked > 0 &&
            ` ${untracked} account${untracked === 1 ? " starts" : "s start"} tracking later.`}
        </p>
        <p>
          <strong className="font-semibold">Safe to Spend</strong> is an estimate from what you’ve
          recorded, after goals and bills. It isn’t a limit to use up.
        </p>
        <p>
          <strong className="font-semibold">Spending</strong> is expenses minus refunds. A budget is
          a target, not reserved money; money set aside for a goal is still in your balance.
        </p>
      </div>
    </details>
  );
}
