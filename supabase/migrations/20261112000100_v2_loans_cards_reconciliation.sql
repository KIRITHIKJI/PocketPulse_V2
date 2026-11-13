-- V2 Phase 2B: credit cards, loans and balance checks (doc/V2_SPEC.md section 5).
--
-- Additive. No column, row or table is dropped and no data is rewritten. Five CHECK constraints
-- are dropped and re-created in the same statement batch with a wider list (account kinds,
-- transaction types, sources, ledger shape, notification kinds): every value they allowed before
-- is still allowed, so every V1 row stays valid and loads unchanged.
--
-- * Credit cards and loans are accounts. A card purchase is an expense on the card; paying the
--   bill is a transfer to it. Borrowing, lending and repaying are transfers with a loan account.
--   None of that needs a new transaction type.
-- * A balance check compares the real balance with the recorded one. A difference can be settled
--   by one correction, `adjustment_in` or `adjustment_out`: an account, a positive amount, no
--   category. Corrections move the balance and are never income or spending.
-- * record_reconciliation works the recorded balance and the difference out itself, at the
--   check's instant, from wallet_balances. It never takes those figures from the client.
--
-- Everything new is SECURITY INVOKER, scoped to auth.uid(), and owner-only under RLS.

-- ---------------------------------------------------------------------------------------------
-- Accounts: credit cards and loans

alter table public.accounts drop constraint accounts_kind_check;
alter table public.accounts add constraint accounts_kind_check check (kind in (
  'cash', 'bank', 'upi_wallet', 'card', 'other', 'credit_card', 'loan_borrowed', 'loan_lent'
));

alter table public.accounts
  -- Who the loan is with ("Ravi"). Loans only.
  add column counterparty text,
  -- Credit cards only: the limit (for "available credit") and the days a reminder can use.
  add column credit_limit_paise bigint,
  add column statement_day smallint,
  add column due_day smallint,
  add constraint accounts_counterparty_check check (
    counterparty is null
    or (char_length(btrim(counterparty)) between 1 and 60 and kind in ('loan_borrowed', 'loan_lent'))
  ),
  add constraint accounts_credit_limit_check check (
    credit_limit_paise is null
    or (credit_limit_paise between 1 and 999999999999 and kind = 'credit_card')
  ),
  add constraint accounts_card_days_check check (
    (statement_day is null or (statement_day between 1 and 28 and kind = 'credit_card'))
    and (due_day is null or (due_day between 1 and 28 and kind = 'credit_card'))
  ),
  -- The default wallet is where everyday spending comes from; a loan never is.
  add constraint accounts_default_not_loan check (
    not is_default or kind not in ('loan_borrowed', 'loan_lent')
  );

-- ---------------------------------------------------------------------------------------------
-- Transactions: balance corrections

alter table public.transactions drop constraint transactions_type_check;
alter table public.transactions add constraint transactions_type_check check (type in (
  'income', 'expense', 'refund', 'transfer', 'allocation', 'allocation_release',
  'adjustment_in', 'adjustment_out'
));

alter table public.transactions drop constraint transactions_source_check;
alter table public.transactions add constraint transactions_source_check check (source in (
  'manual', 'quick_add', 'parsed_text', 'voice', 'recurring', 'import', 'reconciliation'
));

-- The same branches as before, plus one for corrections: one account, nothing else.
alter table public.transactions drop constraint transactions_shape;
alter table public.transactions add constraint transactions_shape check (
  case type
    when 'transfer' then
      from_account_id is not null and to_account_id is not null
      and from_account_id <> to_account_id
      and account_id is null and goal_id is null and refund_of_id is null
      and category_id is null and subcategory_id is null
    when 'allocation' then
      goal_id is not null and account_id is null and from_account_id is null
      and to_account_id is null and refund_of_id is null and category_id is null
      and subcategory_id is null
    when 'allocation_release' then
      goal_id is not null and account_id is null and from_account_id is null
      and to_account_id is null and refund_of_id is null and category_id is null
      and subcategory_id is null
    when 'refund' then
      account_id is not null and refund_of_id is not null and refund_of_id <> id
      and from_account_id is null and to_account_id is null and goal_id is null
    when 'adjustment_in' then
      account_id is not null and from_account_id is null and to_account_id is null
      and goal_id is null and refund_of_id is null and category_id is null
      and subcategory_id is null and recurring_template_id is null
    when 'adjustment_out' then
      account_id is not null and from_account_id is null and to_account_id is null
      and goal_id is null and refund_of_id is null and category_id is null
      and subcategory_id is null and recurring_template_id is null
    else -- income, expense
      account_id is not null and refund_of_id is null
      and from_account_id is null and to_account_id is null and goal_id is null
  end
);

-- Only a balance check makes a correction, and a correction is all a balance check makes.
alter table public.transactions add constraint transactions_reconciliation_source check (
  (source = 'reconciliation') = (type in ('adjustment_in', 'adjustment_out'))
);

-- Same as before, plus: a correction's amount, account, time and currency are fixed. It was
-- worked out for one check; to change it, delete it (or Undo) and check the balance again.
create or replace function public.transactions_guard() returns trigger
language plpgsql set search_path = '' as $$
declare
  acct_currency text;
  original public.transactions;
  goal public.savings_goals;
  refunded bigint;
  refund_predates boolean;
  new_active boolean := new.deleted_at is null and new.voided_at is null;
begin
  -- Server-owned bookkeeping fields.
  if tg_op = 'INSERT' then
    new.idempotency_key := coalesce(new.idempotency_key, new.id::text);
    new.version := 1;
    new.created_at := now();
    new.updated_at := now();
  else
    if new.id <> old.id or new.owner_id <> old.owner_id or new.type <> old.type
       or new.idempotency_key <> old.idempotency_key or new.created_at <> old.created_at
       or new.batch_id is distinct from old.batch_id then
      perform public.raise_rule('transaction_field_immutable',
        'Id, owner, type, idempotency key, batch and creation time cannot change. Delete and re-add instead.');
    end if;
    if new.type in ('adjustment_in', 'adjustment_out')
       and (new.amount_paise <> old.amount_paise or new.account_id <> old.account_id
            or new.occurred_at <> old.occurred_at or new.currency <> old.currency) then
      perform public.raise_rule('correction_fixed',
        'A balance correction can''t be changed. Delete it and check the balance again.');
    end if;
    new.version := old.version + 1;
    new.updated_at := now();
  end if;

  -- Currency must match every account involved.
  for acct_currency in
    select a.currency from public.accounts a
    where a.owner_id = new.owner_id
      and a.id in (new.account_id, new.from_account_id, new.to_account_id)
  loop
    if acct_currency <> new.currency then
      perform public.raise_rule('currency_mismatch',
        format('Transaction currency %s differs from the account currency %s.', new.currency, acct_currency));
    end if;
  end loop;

  -- Categories: expense categories for expenses/refunds, income categories for income.
  -- Corrections have no category (transactions_shape).
  if new.type in ('income', 'expense', 'refund') then
    perform public.check_category_pair(
      new.owner_id, new.category_id, new.subcategory_id,
      case when new.type = 'income' then 'income' else 'expense' end);
  end if;

  -- Refunds: linked to an active expense of the same user, same currency, not earlier, and the
  -- active refunds never exceed it. The original row is locked so concurrent refunds serialize.
  if new.type = 'refund' then
    select * into original from public.transactions
      where owner_id = new.owner_id and id = new.refund_of_id for update;
    if original.type is distinct from 'expense' then
      perform public.raise_rule('refund_without_expense', 'A refund must be linked to one of your expenses.');
    end if;
    if new_active then
      if not public.is_active_tx(original) then
        perform public.raise_rule('refund_of_inactive_expense', 'That expense was deleted or voided.');
      end if;
      if original.currency <> new.currency then
        perform public.raise_rule('currency_mismatch', 'A refund must use the expense''s currency.');
      end if;
      if new.occurred_at < original.occurred_at then
        perform public.raise_rule('refund_before_expense', 'A refund cannot be dated before its expense.');
      end if;
      select coalesce(sum(amount_paise), 0) into refunded from public.transactions
        where owner_id = new.owner_id and refund_of_id = new.refund_of_id and type = 'refund'
          and id <> new.id and deleted_at is null and voided_at is null;
      if refunded + new.amount_paise > original.amount_paise then
        perform public.raise_rule('refund_exceeds_expense',
          format('Only %s paise of this expense can still be refunded.', original.amount_paise - refunded));
      end if;
    end if;
  end if;

  -- Expenses with refunds: can't shrink below, move after, or deactivate under their refunds.
  if tg_op = 'UPDATE' and new.type = 'expense' then
    select coalesce(sum(amount_paise), 0), coalesce(bool_or(occurred_at < new.occurred_at), false)
      into refunded, refund_predates
      from (select amount_paise, occurred_at from public.transactions
            where owner_id = new.owner_id and refund_of_id = new.id and type = 'refund'
              and deleted_at is null and voided_at is null) r;
    if refunded > 0 then
      if new.deleted_at is not null or new.voided_at is not null then
        perform public.raise_rule('expense_has_refunds', 'Delete its refunds first.');
      end if;
      if new.amount_paise < refunded then
        perform public.raise_rule('expense_below_refunds', 'The expense cannot be smaller than its refunds.');
      end if;
      if refund_predates then
        perform public.raise_rule('refund_before_expense', 'A refund cannot be dated before its expense.');
      end if;
      if new.currency <> old.currency then
        perform public.raise_rule('currency_mismatch', 'An expense with refunds cannot change currency.');
      end if;
    end if;
  end if;

  -- Goal earmarks: per goal, active allocations − releases never drops below zero.
  if new.type in ('allocation', 'allocation_release') then
    select * into goal from public.savings_goals
      where owner_id = new.owner_id and id = new.goal_id for update;
    if goal.currency <> new.currency then
      perform public.raise_rule('currency_mismatch', 'Use the goal''s currency.');
    end if;
    if tg_op = 'INSERT' and new.type = 'allocation' and goal.status = 'archived' then
      perform public.raise_rule('goal_archived', 'Unarchive the goal before setting money aside.');
    end if;
    perform public.check_goal_earmark(new.owner_id, new.goal_id, new);
    if tg_op = 'UPDATE' and old.goal_id <> new.goal_id then
      perform public.check_goal_earmark(old.owner_id, old.goal_id, new);
    end if;
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Balances: corrections move their account's balance (a mirror of src/domain/balances.ts)

create or replace function public.wallet_balances(p_closing timestamptz, p_opening timestamptz default null)
returns jsonb
language sql stable security invoker set search_path = '' as $$
  with me as (
    select (select auth.uid()) as uid
  ),
  zone as (
    select coalesce(
      (select p.time_zone from public.profiles p, me where p.id = me.uid),
      'Asia/Kolkata'
    ) as name
  ),
  wallets as (
    select a.id, a.opening_balance_paise,
      (a.opening_balance_date::timestamp at time zone (select name from zone)) as tracking_start
    from public.accounts a, me
    where a.owner_id = me.uid
  ),
  active as (
    select t.type, t.amount_paise, t.occurred_at, t.account_id, t.from_account_id,
      t.to_account_id
    from public.transactions t, me
    where t.owner_id = me.uid and t.deleted_at is null and t.voided_at is null
  ),
  moves as (
    select account_id as wallet_id, occurred_at,
      case when type in ('expense', 'adjustment_out') then -amount_paise else amount_paise end as delta
    from active where type in ('income', 'expense', 'refund', 'adjustment_in', 'adjustment_out')
    union all
    select from_account_id, occurred_at, -amount_paise from active where type = 'transfer'
    union all
    select to_account_id, occurred_at, amount_paise from active where type = 'transfer'
  ),
  per_wallet as (
    select w.id,
      case when p_opening is null or p_opening < w.tracking_start then null
        else w.opening_balance_paise + coalesce(sum(m.delta) filter (
          where m.occurred_at >= w.tracking_start and m.occurred_at < p_opening), 0)
      end as opening_paise,
      case when p_closing < w.tracking_start then null
        else w.opening_balance_paise + coalesce(sum(m.delta) filter (
          where m.occurred_at >= w.tracking_start and m.occurred_at < p_closing), 0)
      end as closing_paise,
      count(m.wallet_id) filter (where m.occurred_at < w.tracking_start) as before_opening
    from wallets w left join moves m on m.wallet_id = w.id
    group by w.id, w.opening_balance_paise, w.tracking_start
  )
  select jsonb_build_object(
    'accounts', coalesce(jsonb_agg(jsonb_build_object(
      'account_id', id,
      'opening_paise', opening_paise::text,
      'closing_paise', closing_paise::text,
      'entries_before_opening', before_opening
    ) order by id), '[]'::jsonb),
    'opening_total_paise',
      case when p_opening is null then null else coalesce(sum(opening_paise), 0)::text end,
    'closing_total_paise', coalesce(sum(closing_paise), 0)::text
  )
  from per_wallet
$$;

-- One account's recorded balance just before an instant (null before it's tracked). The same
-- rule as every other balance, because it reads wallet_balances.
create function public.recorded_balance_at(p_account uuid, p_at timestamptz) returns bigint
language sql stable security invoker set search_path = '' as $$
  select (w ->> 'closing_paise')::bigint
    from jsonb_array_elements(public.wallet_balances(p_at) -> 'accounts') w
   where w ->> 'account_id' = p_account::text
$$;

-- ---------------------------------------------------------------------------------------------
-- Balance checks

create table public.reconciliations (
  -- Client-generated, like a transaction id: a retried save finds the first one.
  id uuid primary key,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  account_id uuid not null,
  -- When the real balance was read (the correction, if any, is dated here too).
  as_of timestamptz not null,
  stated_balance_paise bigint not null
    check (stated_balance_paise between -999999999999 and 999999999999),
  -- Worked out by the database at as_of; never taken from the client (reconciliations_guard).
  recorded_balance_paise bigint not null,
  difference_paise bigint not null,
  correction_id uuid,
  -- matched: no difference. corrected: its correction is active. open: a difference left as it is
  -- (or whose correction was undone or deleted).
  status text not null check (status in ('matched', 'corrected', 'open')),
  note text check (char_length(note) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, id),
  unique (owner_id, correction_id),
  check (difference_paise = stated_balance_paise - recorded_balance_paise),
  check ((status = 'matched') = (difference_paise = 0)),
  check (correction_id is null or difference_paise <> 0),
  check (status <> 'corrected' or correction_id is not null),
  foreign key (owner_id, account_id) references public.accounts (owner_id, id) on delete no action,
  foreign key (owner_id, correction_id) references public.transactions (owner_id, id)
    on delete no action
);
create index reconciliations_account on public.reconciliations (owner_id, account_id, as_of desc);

-- The figures and the status are the database's: recorded balance and difference are worked out
-- here, the correction must be exactly that difference on that account at that instant, and the
-- status follows whether the correction is still active. A check, once saved, never changes
-- except for its status and note.
create function public.reconciliations_guard() returns trigger
language plpgsql set search_path = '' as $$
declare
  recorded bigint;
  correction public.transactions;
begin
  if tg_op = 'INSERT' then
    perform 1 from public.accounts where owner_id = new.owner_id and id = new.account_id;
    if not found then
      perform public.raise_rule('account_not_found', 'Choose one of your own accounts.');
    end if;
    recorded := public.recorded_balance_at(new.account_id, new.as_of);
    if recorded is null then
      perform public.raise_rule('account_not_tracked',
        'This account isn''t tracked yet at that time. Choose a time on or after its opening date.');
    end if;
    new.recorded_balance_paise := recorded;
    new.difference_paise := new.stated_balance_paise - recorded;
    new.created_at := now();
  elsif new.id <> old.id or new.owner_id <> old.owner_id or new.account_id <> old.account_id
     or new.as_of <> old.as_of or new.stated_balance_paise <> old.stated_balance_paise
     or new.recorded_balance_paise <> old.recorded_balance_paise
     or new.difference_paise <> old.difference_paise
     or new.correction_id is distinct from old.correction_id or new.created_at <> old.created_at then
    perform public.raise_rule('reconciliation_fixed',
      'A balance check can''t be changed. Check the balance again instead.');
  end if;

  if new.correction_id is not null then
    select * into correction from public.transactions
      where owner_id = new.owner_id and id = new.correction_id;
    if correction.type is distinct from
         (case when new.difference_paise > 0 then 'adjustment_in' else 'adjustment_out' end)
       or correction.account_id <> new.account_id
       or correction.amount_paise <> abs(new.difference_paise)
       or correction.occurred_at <> new.as_of then
      perform public.raise_rule('correction_mismatch',
        'A correction must be exactly the difference, on that account, at the time of the check.');
    end if;
  end if;
  new.status := case
    when new.difference_paise = 0 then 'matched'
    when correction.id is not null and public.is_active_tx(correction) then 'corrected'
    else 'open'
  end;
  new.updated_at := now();
  return new;
end;
$$;

create trigger reconciliations_guard before insert or update on public.reconciliations
  for each row execute function public.reconciliations_guard();

-- Deleting a correction (or Undo) reopens its check; restoring it closes the check again.
create function public.reconciliation_follows_correction() returns trigger
language plpgsql set search_path = '' as $$
begin
  update public.reconciliations set note = note
    where owner_id = new.owner_id and correction_id = new.id;
  return null;
end;
$$;

create trigger reconciliation_follows_correction
  after update of deleted_at, voided_at on public.transactions
  for each row
  when (new.type in ('adjustment_in', 'adjustment_out')
        and (old.deleted_at is distinct from new.deleted_at
             or old.voided_at is distinct from new.voided_at))
  execute function public.reconciliation_follows_correction();

-- A correction can't exist without the check that made it. Checked when the database
-- transaction commits, because record_reconciliation writes the correction first.
create function public.correction_needs_check() returns trigger
language plpgsql set search_path = '' as $$
begin
  perform 1 from public.reconciliations
    where owner_id = new.owner_id and correction_id = new.id;
  if not found then
    perform public.raise_rule('correction_without_check',
      'A balance correction is only made by checking a balance.');
  end if;
  return null;
end;
$$;

create constraint trigger correction_needs_check
  after insert on public.transactions
  deferrable initially deferred
  for each row
  when (new.type in ('adjustment_in', 'adjustment_out'))
  execute function public.correction_needs_check();

alter table public.reconciliations enable row level security;
-- New tables get Supabase's broad default grants; narrow them as for every other table. No
-- delete: every check stays in the account's history (account deletion removes them through
-- auth.users). `anon` gets nothing.
revoke all on public.reconciliations from anon, authenticated;
grant select, insert, update on public.reconciliations to authenticated;
create policy owner_select on public.reconciliations for select to authenticated
  using (owner_id = (select auth.uid()));
create policy owner_insert on public.reconciliations for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy owner_update on public.reconciliations for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

-- Records a balance check and, when asked, its correction, in one database transaction.
--
-- p_check:      {id, account_id, as_of, stated_balance_paise, note?, seen_difference_paise?}
-- p_correction: null, or {id, type, amount_paise}
--
-- The recorded balance and the difference are worked out here at as_of. If the client's
-- correction (or the difference it showed, `seen_difference_paise`) isn't that difference, the
-- records changed since the screen read them: nothing is written and the answer is
-- {status: 'stale'} with the current figures, for the screen to show. A check without a
-- correction is 'matched' with no difference, else 'open'.
--
-- Idempotent by both ids: replaying the same check is 'duplicate' and changes nothing.
create function public.record_reconciliation(p_check jsonb, p_correction jsonb default null)
returns jsonb
language plpgsql set search_path = '' as $$
declare
  uid uuid := public.require_uid();
  check_id uuid;
  acct public.accounts;
  checked_at timestamptz;
  stated bigint;
  recorded bigint;
  difference bigint;
  existing public.reconciliations;
  saved public.reconciliations;
  correction_type text;
  correction_result jsonb;
  existing_correction jsonb;
begin
  if p_check is null or jsonb_typeof(p_check) <> 'object'
     or (p_correction is not null and jsonb_typeof(p_correction) not in ('object', 'null')) then
    perform public.raise_rule('invalid_payload', 'Expected a balance check.');
  end if;
  if jsonb_typeof(p_correction) = 'null' then
    p_correction := null;
  end if;
  check_id := (p_check ->> 'id')::uuid;
  checked_at := (p_check ->> 'as_of')::timestamptz;
  stated := (p_check ->> 'stated_balance_paise')::bigint;
  if check_id is null or (p_correction is not null and p_correction ->> 'id' is null) then
    perform public.raise_rule('missing_id', 'A balance check needs client-generated ids.');
  end if;
  if checked_at is null or stated is null then
    perform public.raise_rule('invalid_payload', 'A balance check needs a time and a balance.');
  end if;

  -- Locked, so two checks of one account queue here and each sees the other's correction.
  select * into acct from public.accounts
    where owner_id = uid and id = (p_check ->> 'account_id')::uuid for update;
  if acct.id is null then
    return jsonb_build_object('status', 'not_found');
  end if;

  select * into existing from public.reconciliations where owner_id = uid and id = check_id;
  if existing.id is not null then
    select to_jsonb(t) into existing_correction from public.transactions t
      where t.owner_id = uid and t.id = existing.correction_id;
    if existing.account_id = acct.id and existing.as_of = checked_at
       and existing.stated_balance_paise = stated
       and existing.correction_id is not distinct from (p_correction ->> 'id')::uuid then
      return jsonb_build_object('status', 'duplicate', 'check', to_jsonb(existing),
        'correction', existing_correction);
    end if;
    return jsonb_build_object('status', 'conflict', 'reason', 'different_content',
      'check', to_jsonb(existing));
  end if;

  if checked_at > now() + interval '5 minutes' then
    perform public.raise_rule('check_in_future', 'A balance can''t be checked in the future.');
  end if;
  recorded := public.recorded_balance_at(acct.id, checked_at);
  if recorded is null then
    perform public.raise_rule('account_not_tracked',
      'This account isn''t tracked yet at that time. Choose a time on or after its opening date.');
  end if;
  difference := stated - recorded;
  correction_type := case when difference > 0 then 'adjustment_in' else 'adjustment_out' end;

  if (p_check ? 'seen_difference_paise'
        and (p_check ->> 'seen_difference_paise')::bigint is distinct from difference)
     or (p_correction is not null
        and (difference = 0
             or p_correction ->> 'type' is distinct from correction_type
             or (p_correction ->> 'amount_paise')::bigint is distinct from abs(difference))) then
    return jsonb_build_object('status', 'stale',
      'recorded_balance_paise', recorded::text, 'difference_paise', difference::text);
  end if;

  if p_correction is not null then
    correction_result := public.insert_transaction(jsonb_build_object(
      'id', p_correction ->> 'id', 'type', correction_type, 'amount_paise', abs(difference),
      'currency', acct.currency, 'occurred_at', checked_at, 'account_id', acct.id,
      'source', 'reconciliation', 'description', 'Balance correction'
    ), null);
    if correction_result ->> 'status' <> 'applied' then
      perform public.raise_rule('conflict', 'This correction id is already in use.');
    end if;
  end if;

  insert into public.reconciliations
    (id, owner_id, account_id, as_of, stated_balance_paise, recorded_balance_paise,
     difference_paise, correction_id, status, note)
  values
    (check_id, uid, acct.id, checked_at, stated, recorded, difference,
     (correction_result -> 'transaction' ->> 'id')::uuid,
     case when difference = 0 then 'matched' else 'open' end,
     nullif(btrim(p_check ->> 'note'), ''))
  on conflict do nothing
  returning * into saved;
  if saved.id is null then
    -- Raising rolls back the correction too: both are saved or neither is.
    perform public.raise_rule('conflict', 'This balance check id is already in use.');
  end if;
  return jsonb_build_object('status', 'applied', 'check', to_jsonb(saved),
    'correction', correction_result -> 'transaction');
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Reminders: a card's due day

alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in (
  'missed_logging', 'weekly_review', 'upcoming_income', 'budget_threshold',
  'upcoming_commitment', 'savings_review', 'achievement', 'card_due'
));

-- New functions are executable by PUBLIC by default; only signed-in users may call these.
revoke execute on all functions in schema public from public, anon;

grant execute on function
  public.recorded_balance_at(uuid, timestamptz),
  public.record_reconciliation(jsonb, jsonb)
to authenticated;
