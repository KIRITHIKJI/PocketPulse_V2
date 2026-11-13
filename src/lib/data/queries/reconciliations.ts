import "server-only";

import { cache } from "react";

import { type Reconciliation, type Transaction } from "@/domain";
import { DataLoadError } from "@/lib/data/errors";
import { afterLedgerRow, fetchAll, fetchLedgerPages } from "@/lib/data/paging";
import { rowToReconciliation, rowToTransaction } from "@/lib/data/mappers";
import { requireSession } from "@/lib/data/session";
import { LEDGER_COLUMNS } from "./ledger";
import { type Row, UUID_PATTERN } from "./shared";

/** Every balance check on one account, newest first. */
export const getReconciliations = cache(async (accountId: string): Promise<Reconciliation[]> => {
  if (!UUID_PATTERN.test(accountId)) return [];
  const { supabase } = await requireSession();
  const { data, error } = await supabase
    .from("reconciliations")
    .select("*")
    .eq("account_id", accountId)
    .order("as_of", { ascending: false })
    .limit(200);
  if (error) throw new DataLoadError("your balance checks", error.code);
  return (data ?? []).map(rowToReconciliation);
});

/**
 * Non-deleted entries that touch one account (as its account, or either side of a transfer),
 * dated before `until` and, with `since`, from then on. Newest first.
 */
export const getAccountEntries = cache(
  async (accountId: string, since: string | null, until: string): Promise<Transaction[]> => {
    if (!UUID_PATTERN.test(accountId)) return [];
    const { supabase } = await requireSession();
    const rows = await fetchAll((from, to) => {
      let query = supabase
        .from("transactions")
        .select<string, Row>(LEDGER_COLUMNS)
        .is("deleted_at", null)
        .or(
          `account_id.eq.${accountId},from_account_id.eq.${accountId},to_account_id.eq.${accountId}`,
        )
        .lt("occurred_at", until);
      if (since) query = query.gte("occurred_at", since);
      return query.order("occurred_at", { ascending: false }).order("id").range(from, to);
    }, "this account’s entries");
    return rows.map(rowToTransaction);
  },
);

/** Non-deleted entries on any account in a window, for "recorded on another account?" hints. */
export async function getEntriesBetween(since: string, until: string): Promise<Transaction[]> {
  const { supabase } = await requireSession();
  const rows = await fetchLedgerPages((after, limit) => {
    let query = supabase
      .from("transactions")
      .select<string, Row>(LEDGER_COLUMNS)
      .is("deleted_at", null)
      .gte("occurred_at", since)
      .lt("occurred_at", until);
    if (after) query = query.or(afterLedgerRow(after));
    return query.order("occurred_at", { ascending: false }).order("id").limit(limit);
  }, "your entries");
  return rows.map(rowToTransaction);
}
