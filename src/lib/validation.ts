import { z } from 'zod';
export const currencies = ['USD', 'EUR', 'GBP', 'JPY'] as const;
export const categories = [
  'Income',
  'Housing',
  'Food & dining',
  'Groceries',
  'Transport',
  'Shopping',
  'Subscriptions',
  'Travel',
  'Health',
  'Utilities',
  'Fees',
  'Transfers',
  'Other',
] as const;
export const dateInput = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a valid date.')
  .refine((s) => {
    const d = new Date(`${s}T00:00:00Z`);
    return !isNaN(+d) && d.toISOString().slice(0, 10) === s;
  }, 'Use a real calendar date.');
export const moneyInput = z
  .string()
  .trim()
  .regex(/^-?\d{1,14}(\.\d{1,4})?$/, 'Enter a decimal amount, without separators.')
  .refine((s) => Number.isFinite(Number(s)), 'Invalid amount.');
export const positiveMoney = moneyInput.refine((s) => Number(s) > 0, 'Amount must be positive.');
export const currencyInput = z.enum(currencies);
export const idInput = z.string().min(1).max(100);
export const txInput = z.object({
  accountId: idInput,
  date: dateInput,
  description: z.string().trim().min(1).max(500),
  merchant: z.string().trim().min(1).max(100),
  amount: moneyInput.refine((s) => Number(s) !== 0, 'Amount cannot be zero.'),
  category: z.enum(categories),
  kind: z.enum(['income', 'expense', 'refund', 'transfer', 'adjustment']),
  notes: z.string().trim().max(1000).default(''),
  reference: z.string().max(100).default(''),
  statementBalance: moneyInput.optional(),
});
export const actionInput = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('account.create'),
    name: z.string().trim().min(1).max(80),
    institution: z.string().trim().min(1).max(60),
    currency: currencyInput,
    kind: z.enum(['checking', 'savings', 'investment', 'credit']),
    openingBalance: moneyInput,
  }),
  z.object({ action: z.literal('account.archive'), id: idInput }),
  txInput.extend({ action: z.literal('transaction.create') }),
  z.object({
    action: z.literal('transaction.update'),
    id: idInput,
    merchant: z.string().trim().min(1).max(100),
    category: z.enum(categories),
    kind: z.enum(['income', 'expense', 'refund', 'transfer', 'adjustment']),
    notes: z.string().trim().max(1000),
    reviewed: z.boolean(),
  }),
  z.object({ action: z.literal('transaction.delete'), id: idInput }),
  z.object({
    action: z.literal('import.commit'),
    accountId: idInput,
    hash: z.string().regex(/^[a-f0-9]{64}$/),
    format: z.enum(['CSV', 'PDF']),
    acceptBalanceWarnings: z.boolean().default(false),
    rows: z
      .array(txInput.omit({ accountId: true }))
      .min(1)
      .max(5000),
  }),
  z.object({ action: z.literal('import.undo'), id: idInput }),
  z.object({
    action: z.literal('budget.save'),
    category: z.enum(categories),
    amount: positiveMoney,
    month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  }),
  z.object({ action: z.literal('budget.delete'), id: idInput }),
  z.object({
    action: z.literal('goal.create'),
    name: z.string().trim().min(1).max(80),
    target: positiveMoney,
    saved: moneyInput.refine((s) => Number(s) >= 0, 'Saved amount cannot be negative.'),
    dueDate: dateInput,
  }),
  z.object({ action: z.literal('goal.contribute'), id: idInput, amount: positiveMoney }),
  z.object({ action: z.literal('goal.delete'), id: idInput }),
  z.object({
    action: z.literal('rate.save'),
    from: currencyInput,
    to: currencyInput,
    date: dateInput,
    rate: z
      .string()
      .regex(/^\d{1,8}(\.\d{1,12})?$/)
      .refine((s) => Number(s) > 0, 'Rate must be positive.'),
    source: z.string().trim().min(1).max(120),
  }),
  z.object({
    action: z.literal('reconcile'),
    accountId: idInput,
    date: dateInput,
    balance: moneyInput,
  }),
  z.object({
    action: z.literal('workspace.update'),
    name: z.string().trim().min(1).max(80),
    currency: currencyInput,
  }),
  z.object({ action: z.literal('demo.reset') }),
]);
export type Action = z.infer<typeof actionInput>;
