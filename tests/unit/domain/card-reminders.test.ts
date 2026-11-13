import {
  type ReminderSettings,
  accountSchema,
  dueReminders,
  formatINR,
  looksLikeCardPayment,
} from "@/domain";

import { OWNER, id, istMs } from "./fixtures";

const prefs: ReminderSettings = {
  allDisabled: false,
  missedLogging: false,
  missedLoggingTime: "21:00",
  missedLoggingDays: "daily",
  weeklyReview: false,
  weeklyReviewDay: 3,
  upcomingIncome: false,
  upcomingIncomeDays: 1,
  budgetAlerts: false,
  upcomingCommitments: true,
  upcomingCommitmentDays: 3,
  savingsReview: false,
  savingsReviewFrequency: "monthly",
};
const card = (dueDay: number | null) =>
  accountSchema.parse({
    id: id(120),
    ownerId: OWNER,
    name: "HDFC card",
    kind: "credit_card",
    openingBalanceDate: "2026-10-01",
    dueDay,
  });
const remind = (now: number, owedPaise: number, dueDay: number | null = 12, p = prefs) =>
  dueReminders({
    prefs: p,
    ledger: [],
    budgets: [],
    commitments: [],
    templates: [],
    goals: [],
    nextIncomeDate: null,
    cards: [{ account: card(dueDay), owedPaise }],
    now,
    settings: { timeZone: "Asia/Kolkata", weekStartsOn: 1 },
    money: formatINR,
    dateText: (d) => d,
  });

describe("card due reminders", () => {
  it("reminds within the bills look-ahead, once per due date, linking to the card", () => {
    const [r] = remind(istMs("2026-11-10"), 230_000);
    expect(r).toMatchObject({
      kind: "card_due",
      linkPath: `/accounts/${id(120)}`,
      dedupeKey: `card:${id(120)}:2026-11-12`,
    });
    expect(r!.body).toBe(
      "₹2,300 owed on the card, due 2026-11-12. Pay it as a transfer to the card.",
    );
    // After this month's day has passed, it's next month's.
    expect(remind(istMs("2026-11-28"), 230_000, 1)[0]?.dedupeKey).toBe(
      `card:${id(120)}:2026-12-01`,
    );
  });

  it("stays quiet with nothing owed, no due day, too far ahead, or bills reminders off", () => {
    expect(remind(istMs("2026-11-10"), 0)).toEqual([]);
    expect(remind(istMs("2026-11-10"), 230_000, null)).toEqual([]);
    expect(remind(istMs("2026-11-01"), 230_000)).toEqual([]);
    expect(
      remind(istMs("2026-11-10"), 230_000, 12, { ...prefs, upcomingCommitments: false }),
    ).toEqual([]);
    expect(remind(istMs("2026-11-10"), 230_000, 12, { ...prefs, allDisabled: true })).toEqual([]);
  });
});

describe("the card bill nudge's word match", () => {
  it.each([
    "credit card bill",
    "Paid credit card",
    "HDFC card payment",
    "cc bill",
    "card dues",
    "paying my card",
  ])("notices %j", (text) => expect(looksLikeCardPayment(text)).toBe(true));

  it.each(["birthday card", "card game", "sim card", "lunch", "discard bill"])(
    "leaves %j alone",
    (text) => expect(looksLikeCardPayment(text)).toBe(false),
  );
});
