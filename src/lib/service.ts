import { Prisma } from '@prisma/client';
import Decimal from 'decimal.js';
import { randomUUID } from 'node:crypto';
import { db } from './db';
import { hashToken } from './auth';
import { HttpError } from './http';
import { convert, recurring, summarize } from './finance';
import { seedWorkspace } from './seed';
import type { Action } from './validation';
export const iso = (d: Date) => d.toISOString().slice(0, 10);
export async function getData(workspaceId: string) {
  const [workspace, accounts, rows, rates, budgets, goals, imports, audits, balances, count] =
    await db.$transaction(
      [
        db.workspace.findUniqueOrThrow({ where: { id: workspaceId } }),
        db.account.findMany({ where: { workspaceId }, orderBy: { createdAt: 'asc' } }),
        db.transaction.findMany({
          where: { workspaceId },
          orderBy: [{ date: 'desc' }, { id: 'desc' }],
          take: 10001,
        }),
        db.exchangeRate.findMany({ where: { workspaceId }, orderBy: { date: 'desc' } }),
        db.budget.findMany({ where: { workspaceId }, orderBy: { category: 'asc' } }),
        db.goal.findMany({ where: { workspaceId }, orderBy: { createdAt: 'asc' } }),
        db.importBatch.findMany({
          where: { workspaceId },
          orderBy: { createdAt: 'desc' },
          take: 50,
          include: { account: { select: { name: true } } },
        }),
        db.auditEvent.findMany({
          where: { workspaceId },
          orderBy: { createdAt: 'desc' },
          take: 30,
        }),
        db.transaction.groupBy({
          by: ['accountId'],
          where: { workspaceId },
          _sum: { amount: true },
          orderBy: { accountId: 'asc' },
        }),
        db.transaction.count({ where: { workspaceId } }),
      ],
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  const today = iso(new Date());
  const month = today.slice(0, 7);
  const currency = workspace.currency;
  const normalized = rows.slice(0, 10000).flatMap((t) => {
    const account = accounts.find((a) => a.id === t.accountId)!;
    const amount = convert(t.amount.toString(), account.currency, currency, iso(t.date), rates);
    return amount ? [{ ...t, amount: amount.toString() }] : [];
  });
  const current = normalized.filter((t) => iso(t.date).startsWith(month));
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() - 5 + i, 1));
    const key = iso(d).slice(0, 7);
    return {
      month: key,
      label: d.toLocaleDateString('en', { month: 'short', timeZone: 'UTC' }),
      ...summarize(normalized.filter((t) => iso(t.date).startsWith(key))),
    };
  });
  const spending = new Map<string, Decimal>();
  for (const t of current)
    if (t.kind === 'expense' || t.kind === 'refund')
      spending.set(t.category, (spending.get(t.category) || new Decimal(0)).minus(t.amount));
  let networth = new Decimal(0);
  let missingHoldings = 0;
  const accountData = accounts.map((a) => {
    const balance = new Decimal(a.openingBalance.toString()).plus(
      balances.find((b) => b.accountId === a.id)?._sum?.amount?.toString() || 0,
    );
    const converted = convert(balance, a.currency, currency, today, rates);
    if (converted) networth = networth.plus(converted);
    else missingHoldings++;
    const last = rows.find((t) => t.accountId === a.id && t.statementBalance !== null);
    return {
      ...a,
      openingBalance: a.openingBalance.toString(),
      balance: balance.toFixed(a.currency === 'JPY' ? 0 : 2),
      converted: converted?.toFixed(2) ?? null,
      lastStatement: last
        ? { date: iso(last.date), balance: last.statementBalance!.toString() }
        : null,
    };
  });
  const categoryData = [...spending]
    .map(([name, value]) => ({ name, value: value.toFixed(2) }))
    .sort((a, b) => Number(b.value) - Number(a.value));
  return {
    workspace: {
      id: workspace.id,
      name: workspace.name,
      demo: workspace.demo,
      currency,
      expiresAt: workspace.expiresAt,
    },
    accounts: accountData,
    summary: {
      ...summarize(current),
      networth: networth.toFixed(2),
      transactions: count,
      missingRates: rows.length - normalized.length + missingHoldings,
      truncated: rows.length > 10000,
    },
    months,
    categories: categoryData,
    budgets: budgets.map((b) => ({
      ...b,
      amount: b.amount.toString(),
      spent: normalized
        .filter(
          (t) =>
            iso(t.date).startsWith(b.month) &&
            t.category === b.category &&
            (t.kind === 'expense' || t.kind === 'refund'),
        )
        .reduce((sum, t) => sum.minus(t.amount), new Decimal(0))
        .toFixed(2),
    })),
    goals: goals.map((g) => ({
      ...g,
      target: g.target.toString(),
      saved: g.saved.toString(),
      dueDate: iso(g.dueDate),
    })),
    imports: imports.map((i) => ({ ...i, createdAt: i.createdAt.toISOString() })),
    audits: audits.map((a) => ({ ...a, createdAt: a.createdAt.toISOString() })),
    rates: rates.map((r) => ({ ...r, date: iso(r.date), rate: r.rate.toString() })),
    recurring: recurring(normalized),
    recent: rows.slice(0, 8).map((t) => ({
      ...t,
      date: iso(t.date),
      amount: t.amount.toString(),
      statementBalance: t.statementBalance?.toString() ?? null,
    })),
    insights: [
      {
        title: 'A clearer monthly picture',
        text: `Recorded income is ${summarize(current).income} ${currency}, with ${summarize(current).spending} ${currency} in spending after refunds. Transfers and reconciliation adjustments are excluded.`,
      },
      {
        title: 'A little room to breathe',
        text: `${budgets.filter((b) => b.month === month && (spending.get(b.category) || new Decimal(0)).gt(b.amount.toString())).length} current-month budgets are over their limits. Review the transactions before changing a budget.`,
      },
      {
        title: 'Patterns, with context',
        text: `${recurring(normalized).length} merchants show at least three similar payments 25–35 days apart. These are detected patterns, not confirmed subscriptions.`,
      },
    ],
  };
}
export type FinanceData = Awaited<ReturnType<typeof getData>>;
export async function transactionPage(workspaceId: string, params: URLSearchParams) {
  const search = (params.get('search') || '').slice(0, 100);
  const accountId = params.get('account') || undefined;
  const category = params.get('category') || undefined;
  const cursor = params.get('cursor');
  const from = params.get('from');
  const to = params.get('to');
  const realDate = (s: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(s) &&
    !isNaN(+new Date(s)) &&
    new Date(s).toISOString().slice(0, 10) === s;
  if ((from && !realDate(from)) || (to && !realDate(to)))
    throw new HttpError(400, 'Invalid date range.');
  const where: Prisma.TransactionWhereInput = {
    workspaceId,
    ...(accountId ? { accountId } : {}),
    ...(category ? { category } : {}),
    ...(search
      ? {
          OR: [
            { description: { contains: search, mode: 'insensitive' } },
            { merchant: { contains: search, mode: 'insensitive' } },
            { notes: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {}),
    ...(from || to
      ? { date: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) } }
      : {}),
  };
  if (cursor) {
    const marker = await db.transaction.findFirst({ where: { id: cursor, workspaceId } });
    if (!marker) throw new HttpError(400, 'Invalid pagination cursor.');
    where.AND = [
      { OR: [{ date: { lt: marker.date } }, { date: marker.date, id: { lt: marker.id } }] },
    ];
  }
  const rows = await db.transaction.findMany({
    where,
    orderBy: [{ date: 'desc' }, { id: 'desc' }],
    take: 41,
    include: { account: { select: { name: true, currency: true } } },
  });
  return {
    rows: rows.slice(0, 40).map((t) => ({
      ...t,
      date: iso(t.date),
      amount: t.amount.toString(),
      statementBalance: t.statementBalance?.toString() ?? null,
    })),
    nextCursor: rows.length > 40 ? rows[39].id : null,
  };
}
export type TransactionPage = Awaited<ReturnType<typeof transactionPage>>;
async function ownedAccount(tx: Prisma.TransactionClient, workspaceId: string, id: string) {
  const account = await tx.account.findFirst({ where: { id, workspaceId, archived: false } });
  if (!account) throw new HttpError(404, 'Account not found or archived.');
  return account;
}
async function audit(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  action: string,
  entityId: string,
  detail: string,
) {
  await tx.auditEvent.create({ data: { workspaceId, action, entityId, detail } });
}
export interface MutationResult {
  message: string;
  id?: string;
  added?: number;
  duplicates?: number;
  warnings?: string[];
}
export async function mutate(workspaceId: string, input: Action): Promise<MutationResult> {
  if (input.action === 'demo.reset') {
    const workspace = await db.workspace.findUniqueOrThrow({ where: { id: workspaceId } });
    if (!workspace.demo) throw new HttpError(403, 'Only demo workspaces can be reset.');
    await seedWorkspace(workspaceId, true);
    return { message: 'Your demo workspace has been restored.' };
  }
  const result = await db.$transaction(
    async (tx) => {
      switch (input.action) {
        case 'account.create': {
          const record = await tx.account.create({
            data: {
              workspaceId,
              name: input.name,
              institution: input.institution,
              currency: input.currency,
              kind: input.kind,
              openingBalance: input.openingBalance,
            },
          });
          await audit(
            tx,
            workspaceId,
            input.action,
            record.id,
            'Account created with an explicit opening balance.',
          );
          return { message: 'Account created.', id: record.id };
        }
        case 'account.archive': {
          await ownedAccount(tx, workspaceId, input.id);
          await tx.account.update({ where: { id: input.id }, data: { archived: true } });
          await audit(
            tx,
            workspaceId,
            input.action,
            input.id,
            'Account archived; ledger records retained.',
          );
          return { message: 'Account archived.' };
        }
        case 'transaction.create': {
          const account = await ownedAccount(tx, workspaceId, input.accountId);
          if (
            (input.kind === 'expense' && new Decimal(input.amount).gte(0)) ||
            (['income', 'refund'].includes(input.kind) && new Decimal(input.amount).lte(0))
          )
            throw new HttpError(
              400,
              'Expense amounts must be negative; income and refunds must be positive.',
            );
          if (account.currency === 'JPY' && !new Decimal(input.amount).isInteger())
            throw new HttpError(400, 'JPY amounts must be whole yen.');
          const t = await tx.transaction.create({
            data: {
              workspaceId,
              accountId: account.id,
              date: new Date(input.date),
              description: input.description,
              merchant: input.merchant,
              amount: input.amount,
              category: input.category,
              kind: input.kind,
              notes: input.notes,
              reviewed: true,
              fingerprint: randomUUID(),
              sourceReference: input.reference,
              statementBalance: input.statementBalance,
            },
          });
          await audit(tx, workspaceId, input.action, t.id, 'Manual ledger entry created.');
          return { message: 'Transaction saved.', id: t.id };
        }
        case 'transaction.update': {
          const existing = await tx.transaction.findFirst({ where: { id: input.id, workspaceId } });
          if (!existing) throw new HttpError(404, 'Transaction not found.');
          if (
            (input.kind === 'expense' && new Decimal(existing.amount.toString()).gte(0)) ||
            (['income', 'refund'].includes(input.kind) &&
              new Decimal(existing.amount.toString()).lte(0))
          )
            throw new HttpError(
              400,
              'Expense amounts must be negative; income and refunds must be positive.',
            );
          await tx.transaction.update({
            where: { id: input.id },
            data: {
              merchant: input.merchant,
              category: input.category,
              kind: input.kind,
              notes: input.notes,
              reviewed: input.reviewed,
            },
          });
          await audit(
            tx,
            workspaceId,
            input.action,
            input.id,
            'Editorial fields changed; original description and amount retained.',
          );
          return { message: 'Transaction updated.' };
        }
        case 'transaction.delete': {
          const result = await tx.transaction.deleteMany({ where: { id: input.id, workspaceId } });
          if (!result.count) throw new HttpError(404, 'Transaction not found.');
          await audit(
            tx,
            workspaceId,
            input.action,
            input.id,
            'Ledger entry deleted after confirmation.',
          );
          return { message: 'Transaction deleted.' };
        }
        case 'import.commit': {
          const account = await ownedAccount(tx, workspaceId, input.accountId);
          const existing = await tx.importBatch.findUnique({
            where: {
              workspaceId_accountId_hash: {
                workspaceId,
                accountId: input.accountId,
                hash: input.hash,
              },
            },
          });
          if (existing)
            return {
              message: 'This statement was already imported. No records added.',
              added: 0,
              duplicates: input.rows.length,
            };
          const warnings: string[] = [];
          let previous: Decimal | null = null;
          const occurrences = new Map<string, number>();
          const batch = await tx.importBatch.create({
            data: {
              workspaceId,
              accountId: input.accountId,
              hash: input.hash,
              format: input.format,
              count: 0,
              duplicates: 0,
              warnings: [],
            },
          });
          const rows = input.rows.map((r, index) => {
            if (account.currency === 'JPY' && !new Decimal(r.amount).isInteger())
              throw new HttpError(400, 'JPY amounts must be whole yen.');
            if (
              previous !== null &&
              r.statementBalance !== undefined &&
              !previous.plus(r.amount).eq(r.statementBalance)
            )
              warnings.push(
                `Row ${index + 1}: running balance differs from the previous stated balance plus amount.`,
              );
            previous = r.statementBalance !== undefined ? new Decimal(r.statementBalance) : null;
            const base = hashToken(
              [
                input.accountId,
                r.date,
                r.description.trim().toLowerCase().replace(/\s+/g, ' '),
                new Decimal(r.amount).toFixed(4),
                r.reference,
              ].join('|'),
            );
            const occurrence = (occurrences.get(base) || 0) + 1;
            occurrences.set(base, occurrence);
            return {
              workspaceId,
              accountId: input.accountId,
              date: new Date(r.date),
              description: r.description,
              merchant: r.merchant,
              amount: r.amount,
              category: r.category,
              kind: r.kind,
              notes: r.notes,
              sourceReference: r.reference,
              statementBalance: r.statementBalance,
              fingerprint: `${base}:${occurrence}`,
              importId: batch.id,
            };
          });
          if (warnings.length && !input.acceptBalanceWarnings)
            throw new HttpError(
              400,
              'Review and explicitly acknowledge the statement balance differences.',
            );
          const created = await tx.transaction.createMany({ data: rows, skipDuplicates: true });
          const duplicates = rows.length - created.count;
          await tx.importBatch.update({
            where: { id: batch.id },
            data: { count: created.count, duplicates, warnings },
          });
          await audit(
            tx,
            workspaceId,
            input.action,
            batch.id,
            `${created.count} rows added, ${duplicates} duplicates skipped, ${warnings.length} balance warnings.`,
          );
          return {
            message: `Imported ${created.count} transactions. ${duplicates} duplicates skipped.`,
            added: created.count,
            duplicates,
            warnings,
          };
        }
        case 'import.undo': {
          const batch = await tx.importBatch.findFirst({ where: { id: input.id, workspaceId } });
          if (!batch) throw new HttpError(404, 'Import not found.');
          await tx.importBatch.delete({ where: { id: batch.id } });
          await audit(
            tx,
            workspaceId,
            input.action,
            input.id,
            'Import and its transactions removed atomically.',
          );
          return { message: 'Import undone. Its transactions were removed.' };
        }
        case 'budget.save': {
          const record = await tx.budget.upsert({
            where: {
              workspaceId_category_month: {
                workspaceId,
                category: input.category,
                month: input.month,
              },
            },
            create: {
              workspaceId,
              category: input.category,
              amount: input.amount,
              month: input.month,
            },
            update: { amount: input.amount },
          });
          await audit(tx, workspaceId, input.action, record.id, 'Monthly category budget saved.');
          return { message: 'Budget saved.' };
        }
        case 'budget.delete': {
          const r = await tx.budget.deleteMany({ where: { workspaceId, id: input.id } });
          if (!r.count) throw new HttpError(404, 'Budget not found.');
          await audit(tx, workspaceId, input.action, input.id, 'Budget removed.');
          return { message: 'Budget removed.' };
        }
        case 'goal.create': {
          if (new Decimal(input.saved).gt(input.target))
            throw new HttpError(400, 'Saved amount cannot exceed the target.');
          const r = await tx.goal.create({
            data: {
              workspaceId,
              name: input.name,
              target: input.target,
              saved: input.saved,
              dueDate: new Date(input.dueDate),
            },
          });
          await audit(
            tx,
            workspaceId,
            input.action,
            r.id,
            'Savings earmark created; account balances unchanged.',
          );
          return { message: 'Goal created.', id: r.id };
        }
        case 'goal.contribute': {
          const r = await tx.goal.findFirst({ where: { workspaceId, id: input.id } });
          if (!r) throw new HttpError(404, 'Goal not found.');
          if (new Decimal(r.saved.toString()).plus(input.amount).gt(r.target.toString()))
            throw new HttpError(400, 'Contribution would exceed the goal target.');
          await tx.goal.update({
            where: { id: r.id },
            data: { saved: { increment: input.amount } },
          });
          await audit(
            tx,
            workspaceId,
            input.action,
            r.id,
            'Earmarked savings updated; no additional wealth recorded.',
          );
          return { message: 'Progress updated.' };
        }
        case 'goal.delete': {
          const r = await tx.goal.deleteMany({ where: { workspaceId, id: input.id } });
          if (!r.count) throw new HttpError(404, 'Goal not found.');
          await audit(
            tx,
            workspaceId,
            input.action,
            input.id,
            'Savings earmark removed; account balances unchanged.',
          );
          return { message: 'Goal removed.' };
        }
        case 'rate.save': {
          if (input.from === input.to) throw new HttpError(400, 'Choose two different currencies.');
          if (input.date > iso(new Date()))
            throw new HttpError(400, 'Exchange rates cannot be future-dated.');
          await tx.exchangeRate.upsert({
            where: {
              workspaceId_from_to_date: {
                workspaceId,
                from: input.from,
                to: input.to,
                date: new Date(input.date),
              },
            },
            create: {
              workspaceId,
              from: input.from,
              to: input.to,
              date: new Date(input.date),
              rate: input.rate,
              source: input.source,
            },
            update: { rate: input.rate, source: input.source },
          });
          await audit(
            tx,
            workspaceId,
            input.action,
            workspaceId,
            `${input.from}/${input.to} dated rate saved.`,
          );
          return { message: 'Dated exchange rate saved.' };
        }
        case 'reconcile': {
          const a = await ownedAccount(tx, workspaceId, input.accountId);
          if (input.date > iso(new Date()))
            throw new HttpError(400, 'Reconciliation date cannot be in the future.');
          const total = await tx.transaction.aggregate({
            where: { workspaceId, accountId: a.id, date: { lte: new Date(input.date) } },
            _sum: { amount: true },
          });
          const balance = new Decimal(a.openingBalance.toString()).plus(
            total._sum.amount?.toString() || 0,
          );
          const difference = new Decimal(input.balance).minus(balance);
          if (difference.eq(0))
            return { message: 'This account already reconciles. No adjustment needed.' };
          const r = await tx.transaction.create({
            data: {
              workspaceId,
              accountId: a.id,
              date: new Date(input.date),
              description: 'Reviewed reconciliation adjustment',
              merchant: 'Reconciliation',
              amount: difference.toString(),
              statementBalance: input.balance,
              kind: 'adjustment',
              category: 'Other',
              reviewed: true,
              fingerprint: randomUUID(),
              notes: `Explicit adjustment from ${balance.toFixed(2)} to ${input.balance}. Excluded from income and spending.`,
            },
          });
          await audit(
            tx,
            workspaceId,
            input.action,
            r.id,
            'Explicit reconciliation adjustment recorded.',
          );
          return {
            message: `Reconciled with an explicit ${difference.toFixed(2)} ${a.currency} adjustment.`,
          };
        }
        case 'workspace.update': {
          const workspace = await tx.workspace.findUniqueOrThrow({ where: { id: workspaceId } });
          if (
            workspace.currency !== input.currency &&
            ((await tx.budget.count({ where: { workspaceId } })) ||
              (await tx.goal.count({ where: { workspaceId } })))
          )
            throw new HttpError(
              400,
              'Remove existing budgets and goals before changing their reporting currency. Amounts are never silently relabeled.',
            );
          await tx.workspace.update({
            where: { id: workspaceId },
            data: { name: input.name, currency: input.currency },
          });
          await audit(tx, workspaceId, input.action, workspaceId, 'Workspace preferences updated.');
          return { message: 'Workspace saved.' };
        }
      }
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15000 },
  );
  return result;
}
export async function execute(workspaceId: string, input: Action) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await mutate(workspaceId, input);
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        (e.code === 'P2034' || e.code === 'P2002') &&
        attempt < 2
      )
        continue;
      throw e;
    }
  }
  throw new HttpError(409, 'Another update happened at the same time. Try again.');
}
