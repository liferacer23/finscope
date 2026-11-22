'use client';
import { useState } from 'react';
import { ArrowRight, Download } from 'lucide-react';
import type { FinanceData, TransactionPage } from '@/lib/service';
import { actionInput, categories, currencies } from '@/lib/validation';
import { Modal } from './ui';
import type { Act } from './workspace';
import { request } from './auth';
export interface DialogAction {
  type:
    | 'account'
    | 'transaction'
    | 'budget'
    | 'goal'
    | 'contribute'
    | 'rate'
    | 'reconcile'
    | 'workspace';
  id?: string;
  transaction?: Pick<
    TransactionPage['rows'][number],
    'id' | 'merchant' | 'category' | 'kind' | 'notes' | 'reviewed'
  >;
}
interface Field {
  name: string;
  label: string;
  value?: string;
  type?: string;
  options?: { value: string; label: string }[];
  required?: boolean;
  maxLength?: number;
  min?: string;
  max?: string;
  step?: string;
  hint?: string;
}
export function ActionForm({
  config,
  data,
  act,
  onClose,
}: {
  config: DialogAction;
  data: FinanceData;
  act: Act;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const activeAccounts = data.accounts.filter((a) => !a.archived);
  const options = (values: readonly string[]) => values.map((v) => ({ label: v, value: v }));
  const today = new Date().toISOString().slice(0, 10);
  const month = today.slice(0, 7);
  const budget = data.budgets.find((b) => b.id === config.id);
  let title = '',
    action = '',
    description = '';
  let fields: Field[] = [];
  switch (config.type) {
    case 'account':
      title = 'A home for your money';
      action = 'account.create';
      description =
        'Opening balance is the amount immediately before your first recorded transaction. Credit balances should be negative.';
      fields = [
        { name: 'name', label: 'Account name', maxLength: 80 },
        { name: 'institution', label: 'Institution', maxLength: 60 },
        { name: 'currency', label: 'Currency', value: 'USD', options: options(currencies) },
        {
          name: 'kind',
          label: 'Account type',
          value: 'checking',
          options: options(['checking', 'savings', 'investment', 'credit']),
        },
        {
          name: 'openingBalance',
          label: 'Opening balance',
          value: '0',
          hint: 'Original account currency; use a minus sign for a liability.',
        },
      ];
      break;
    case 'transaction': {
      const t = config.transaction;
      title = t ? 'Review transaction' : 'Record a transaction';
      action = t ? 'transaction.update' : 'transaction.create';
      description = t
        ? 'Original descriptions, amounts and source fingerprints remain unchanged.'
        : 'Enter the signed source amount. Negative is money out; positive is money in.';
      fields = [
        ...(!t
          ? [
              {
                name: 'accountId',
                label: 'Account',
                value: activeAccounts[0]?.id,
                options: activeAccounts.map((a) => ({
                  value: a.id,
                  label: `${a.name} · ${a.currency}`,
                })),
              },
              { name: 'date', label: 'Date', type: 'date', value: today },
              { name: 'description', label: 'Original description', maxLength: 500 },
              { name: 'amount', label: 'Signed amount', hint: 'For example, -42.50' },
            ]
          : []),
        { name: 'merchant', label: 'Merchant', value: t?.merchant, maxLength: 100 },
        {
          name: 'category',
          label: 'Category',
          value: t?.category || 'Other',
          options: options(categories),
        },
        {
          name: 'kind',
          label: 'Transaction type',
          value: t?.kind || 'expense',
          options: options(['expense', 'income', 'refund', 'transfer', 'adjustment']),
        },
        {
          name: 'notes',
          label: 'Notes',
          value: t?.notes || '',
          type: 'textarea',
          required: false,
          maxLength: 1000,
        },
      ];
      break;
    }
    case 'budget':
      title = budget ? 'Adjust your budget' : 'Make a little room';
      action = 'budget.save';
      description = `Set a monthly category limit in ${data.workspace.currency}. Existing limits for the same category and month are updated.`;
      fields = [
        {
          name: 'category',
          label: 'Category',
          value: budget?.category || 'Groceries',
          options: options(categories.filter((c) => !['Income', 'Transfers'].includes(c))),
        },
        { name: 'amount', label: 'Monthly limit', value: budget?.amount },
        { name: 'month', label: 'Budget month', type: 'month', value: budget?.month || month },
      ];
      break;
    case 'goal':
      title = 'Something to look forward to';
      action = 'goal.create';
      description = `Goals earmark money you already hold, in ${data.workspace.currency}. They do not change account balances.`;
      fields = [
        { name: 'name', label: 'Goal name', maxLength: 80 },
        { name: 'target', label: 'Target amount' },
        { name: 'saved', label: 'Already set aside', value: '0' },
        {
          name: 'dueDate',
          label: 'Target date',
          type: 'date',
          value: `${new Date().getUTCFullYear() + 1}-06-01`,
        },
      ];
      break;
    case 'contribute':
      title = 'A little closer';
      action = 'goal.contribute';
      description =
        'Earmark an additional amount of existing savings. This records progress without creating a ledger transaction.';
      fields = [{ name: 'amount', label: 'Additional amount to earmark' }];
      break;
    case 'rate':
      title = 'A rate you can trace';
      action = 'rate.save';
      description =
        'Fetch a historical Frankfurter reference rate, or enter a rate and its verifiable source. Weekend requests may return the previous working day.';
      fields = [
        { name: 'from', label: 'From currency', value: 'EUR', options: options(currencies) },
        {
          name: 'to',
          label: 'To currency',
          value: data.workspace.currency,
          options: options(currencies),
        },
        { name: 'date', label: 'Effective date', type: 'date', value: today, max: today },
        {
          name: 'rate',
          label: 'Exchange rate',
          required: false,
          hint: '1 unit of the source currency equals this many target units.',
        },
        { name: 'source', label: 'Rate source', maxLength: 120, required: false },
      ];
      break;
    case 'reconcile':
      title = 'Bring the balance into focus';
      action = 'reconcile';
      description =
        'Compare the recorded balance at this date with your verified statement. Confirming creates a visible adjustment for the difference; it is excluded from income and spending.';
      fields = [
        {
          name: 'accountId',
          label: 'Account',
          value: config.id || activeAccounts[0]?.id,
          options: activeAccounts.map((a) => ({ value: a.id, label: `${a.name} · ${a.currency}` })),
        },
        { name: 'date', label: 'Statement date', type: 'date', value: today, max: today },
        { name: 'balance', label: 'Verified statement balance' },
      ];
      break;
    case 'workspace':
      title = 'Make yourself at home';
      action = 'workspace.update';
      description =
        'Changing currency requires removing existing budgets and savings goals first. Their nominal amounts cannot safely be relabeled.';
      fields = [
        { name: 'name', label: 'Workspace name', value: data.workspace.name, maxLength: 80 },
        {
          name: 'currency',
          label: 'Reporting currency',
          value: data.workspace.currency,
          options: options(currencies),
        },
      ];
      break;
  }
  return (
    <Modal title={title} onClose={() => !busy && onClose()}>
      <p className="modal-intro">{description}</p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError('');
          try {
            const values = Object.fromEntries(new FormData(e.currentTarget));
            const payload = {
              ...values,
              action,
              ...(config.id ? { id: config.id } : {}),
              ...(config.transaction ? { id: config.transaction.id, reviewed: true } : {}),
            };
            if (config.type === 'transaction' && !config.transaction && !activeAccounts.length)
              throw new Error('Create an account before recording a transaction.');
            const parsed = actionInput.safeParse(payload);
            if (!parsed.success)
              throw new Error(parsed.error.issues[0]?.message || 'Review your entries.');
            await act(parsed.data);
            onClose();
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Could not save your changes.');
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="form-grid">
          {fields.map((f) => (
            <label key={f.name} className={f.type === 'textarea' ? 'full-width' : ''}>
              {f.label}
              {f.options ? (
                <select
                  aria-label={f.label}
                  name={f.name}
                  defaultValue={f.value}
                  required={f.required !== false}
                >
                  {!f.options.length && <option value="">No accounts yet</option>}
                  {f.options.map((o) => (
                    <option value={o.value} key={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : f.type === 'textarea' ? (
                <textarea
                  name={f.name}
                  defaultValue={f.value}
                  required={f.required !== false}
                  maxLength={f.maxLength}
                  rows={3}
                />
              ) : (
                <input
                  name={f.name}
                  aria-label={f.label}
                  aria-describedby={f.hint ? `field-${f.name}-hint` : undefined}
                  type={f.type || 'text'}
                  defaultValue={f.value}
                  required={f.required !== false}
                  maxLength={f.maxLength || 100}
                  min={f.min}
                  max={f.max}
                  step={f.step}
                  autoComplete="off"
                />
              )}
              {f.hint && <small id={`field-${f.name}-hint`}>{f.hint}</small>}
            </label>
          ))}
        </div>
        {config.type === 'rate' && (
          <button
            className="button secondary rate-fetch"
            type="button"
            disabled={busy}
            onClick={async (e) => {
              const form = e.currentTarget.form;
              if (!form) return;
              setBusy(true);
              setError('');
              try {
                const values = Object.fromEntries(new FormData(form));
                const result = await request<{ message: string; date: string; rate: number }>(
                  '/api/rates',
                  {
                    method: 'POST',
                    body: JSON.stringify({ from: values.from, to: values.to, date: values.date }),
                  },
                );
                setNotice(result.message);
                await act({
                  action: 'rate.save',
                  from: values.from as 'EUR',
                  to: values.to as 'USD',
                  date: result.date,
                  rate: result.rate.toFixed(12),
                  source: 'Frankfurter · ECB reference rate',
                });
                onClose();
              } catch (e) {
                setError(e instanceof Error ? e.message : 'Provider unavailable.');
              } finally {
                setBusy(false);
              }
            }}
          >
            <Download size={15} />
            Fetch and save reference rate
          </button>
        )}
        {notice && <div className="notice">{notice}</div>}
        {error && (
          <div className="notice error" role="alert">
            {error}
          </div>
        )}
        <div className="form-actions">
          <button className="button secondary" type="button" disabled={busy} onClick={onClose}>
            Cancel
          </button>
          <button className="button primary" disabled={busy}>
            {busy ? 'Saving…' : 'Save changes'}
            <ArrowRight size={15} />
          </button>
        </div>
      </form>
    </Modal>
  );
}
