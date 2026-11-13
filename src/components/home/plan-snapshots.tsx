import type { ReactNode } from "react";
import Link from "next/link";

import { DataList, DataRow } from "@/components/layout/primitives";
import {
  type BudgetEvaluation,
  type GoalProgress,
  type Paise,
  type SavingsGoal,
  formatBasisPoints,
} from "@/domain";

type Money = (paise: Paise) => string;

const LINK =
  "rounded-sm font-medium text-foreground underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50";

/**
 * Home's plans, one line each: the monthly budget and the savings goals, each linking to its page
 * where the detail lives. The figures are the domain's evaluations, shown as they are.
 */
export function PlanLines({
  alertCount,
  budgetEval,
  hasBudgets,
  goalCards,
  money,
}: {
  alertCount: number;
  budgetEval: BudgetEvaluation | null;
  hasBudgets: boolean;
  goalCards: { goal: SavingsGoal; progress: GoalProgress }[];
  money: Money;
}) {
  if (!hasBudgets && goalCards.length === 0) {
    return (
      <p className="type-body text-text-secondary" data-testid="plan-first-steps">
        Plan when you’re ready:{" "}
        <Link href="/budgets" className={LINK}>
          set a monthly budget
        </Link>{" "}
        or{" "}
        <Link href="/goals" className={LINK}>
          add a savings goal
        </Link>
        .
      </p>
    );
  }
  const first = goalCards[0];
  const more = goalCards.length - 1;
  return (
    <DataList>
      <BudgetLine
        alertCount={alertCount}
        budgetEval={budgetEval}
        hasBudgets={hasBudgets}
        money={money}
      />
      {first ? (
        <DataRow
          testId="goal-snapshot"
          href={goalCards.length === 1 ? `/goals/${first.goal.id}` : "/goals"}
          title={more > 0 ? `${first.goal.title} +${more} more` : first.goal.title}
          detail={
            <span className="money">
              {money(first.progress.savedPaise)} of {money(first.goal.targetPaise)} set aside
            </span>
          }
          value={
            <span className="text-money-earmark">{money(first.progress.remainingPaise)} to go</span>
          }
        />
      ) : (
        <DataRow
          testId="goal-snapshot"
          href="/goals"
          title="Savings goals"
          detail="None yet"
          value="Add one"
        />
      )}
    </DataList>
  );
}

function BudgetLine({
  alertCount,
  budgetEval,
  hasBudgets,
  money,
}: {
  alertCount: number;
  budgetEval: BudgetEvaluation | null;
  hasBudgets: boolean;
  money: Money;
}) {
  const alert =
    alertCount > 0
      ? `${alertCount} budget${alertCount === 1 ? " has" : "s have"} reached an alert level`
      : null;
  let detail: ReactNode = "No monthly total set";
  let value: ReactNode = hasBudgets ? "All budgets" : "Set one";
  if (budgetEval) {
    const over = budgetEval.remainingPaise < 0;
    detail = (
      <span className="money">
        {money(Math.max(0, budgetEval.spentPaise))} of {money(budgetEval.limitPaise)} ·{" "}
        {formatBasisPoints(budgetEval.usedBp, 0)} used
      </span>
    );
    value = (
      <span className={over ? "text-feedback-warning" : undefined}>
        {over
          ? `${money(-budgetEval.remainingPaise)} over`
          : `${money(budgetEval.remainingPaise)} left`}
      </span>
    );
  }
  return (
    <DataRow
      testId="budget-snapshot"
      href="/budgets"
      title="Monthly budget"
      detail={
        alert ? (
          <>
            {detail}
            <span className="block truncate text-feedback-warning">{alert}</span>
          </>
        ) : (
          detail
        )
      }
      value={value}
    />
  );
}
