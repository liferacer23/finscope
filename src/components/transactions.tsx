'use client';
import { useCallback, useEffect, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Download,
  Plus,
  Search,
  ChevronRight,
  Trash2,
} from 'lucide-react';
import type { FinanceData, TransactionPage } from '@/lib/service';
import type { Action } from '@/lib/validation';
import { categories } from '@/lib/validation';
import { request } from './auth';
import type { Act } from './workspace';
import type { DialogAction } from './forms';
import { Heading, Empty, money } from './ui';
export function Transactions({
  data,
  act: _act,
  open,
  remove,
}: {
  data: FinanceData;
  act: Act;
  open: (c: DialogAction) => void;
  remove: (a: Action, t: string, text?: string) => void;
}) {
  const [search, setSearch] = useState('');
  const [account, setAccount] = useState('');
  const [category, setCategory] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState<TransactionPage | null>(null);
  const [cursor, setCursor] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const p = new URLSearchParams({
        search,
        account,
        category,
        from,
        to,
        ...(cursor ? { cursor } : {}),
      });
      setPage(await request<TransactionPage>(`/api/transactions?${p}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load transactions.');
    } finally {
      setLoading(false);
    }
  }, [search, account, category, from, to, cursor]);
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('category')) setCategory(params.get('category')!);
  }, []);
  useEffect(() => {
    const t = setTimeout(() => void load(), 150);
    return () => clearTimeout(t);
  }, [load, data]);
  const filter = (setter: (s: string) => void) => (value: string) => {
    setter(value);
    setCursor('');
  };
  return (
    <>
      <Heading
        eyebrow="THE DETAILS MAKE THE DIFFERENCE"
        title="Every move, in one place"
        description="Search your ledger. Follow the original amounts. Make the details yours."
      >
        <a className="button secondary" href="/api/export">
          <Download size={16} />
          Export CSV
        </a>
        <button className="button primary" onClick={() => open({ type: 'transaction' })}>
          <Plus size={16} />
          Add transaction
        </button>
      </Heading>
      <section className="panel transaction-panel">
        <div className="transaction-toolbar">
          <label className="search-field">
            <Search size={17} />
            <input
              aria-label="Search transactions"
              enterKeyHint="search"
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur();
              }}
              placeholder="Search merchant, description or notes…"
              value={search}
              onChange={(e) => filter(setSearch)(e.target.value)}
            />
          </label>
          <span className="pill">{data.summary.transactions} recorded entries</span>
        </div>
        <div className="filter-bar">
          <label>
            Account
            <select value={account} onChange={(e) => filter(setAccount)(e.target.value)}>
              <option value="">All accounts</option>
              {data.accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} · {a.currency}
                </option>
              ))}
            </select>
          </label>
          <label>
            Category
            <select value={category} onChange={(e) => filter(setCategory)(e.target.value)}>
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label>
            From
            <input type="date" value={from} onChange={(e) => filter(setFrom)(e.target.value)} />
          </label>
          <label>
            To
            <input type="date" value={to} onChange={(e) => filter(setTo)(e.target.value)} />
          </label>
          <button
            className="text-button"
            onClick={() => {
              setSearch('');
              setAccount('');
              setCategory('');
              setFrom('');
              setTo('');
              setCursor('');
            }}
          >
            Clear filters
          </button>
        </div>
        {error && (
          <div className="notice error" role="alert">
            {error}
          </div>
        )}
        {loading ? (
          <div className="skeleton tall" role="status" aria-label="Loading transactions" />
        ) : page?.rows.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Transaction</th>
                  <th>Category</th>
                  <th>Account</th>
                  <th>Date</th>
                  <th>Amount</th>
                  <th>Review</th>
                  <th>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {page.rows.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <button
                        className="transaction-link"
                        onClick={() => open({ type: 'transaction', transaction: t })}
                      >
                        <span className={`transaction-icon ${Number(t.amount) > 0 ? 'in' : 'out'}`}>
                          {Number(t.amount) > 0 ? (
                            <ArrowDownLeft size={17} />
                          ) : (
                            <ArrowUpRight size={17} />
                          )}
                        </span>
                        <span>
                          <strong>{t.merchant}</strong>
                          <small>
                            {t.description !== t.merchant
                              ? t.description
                              : t.kind === 'transfer'
                                ? 'Internal movement'
                                : t.kind === 'adjustment'
                                  ? 'Reconciliation adjustment'
                                  : t.kind === 'income'
                                    ? 'Recorded income'
                                    : 'Recorded purchase'}
                          </small>
                        </span>
                      </button>
                    </td>
                    <td>
                      <span
                        className={`category-chip category-${t.category.replaceAll(' ', '').replaceAll('&', '')}`}
                      >
                        {t.category}
                      </span>
                    </td>
                    <td>
                      {t.account.name}
                      <small>{t.account.currency}</small>
                    </td>
                    <td className="nowrap">
                      {new Date(`${t.date}T00:00:00Z`).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        timeZone: 'UTC',
                      })}
                    </td>
                    <td className={`amount ${Number(t.amount) > 0 ? 'positive' : ''}`}>
                      {Number(t.amount) > 0 ? '+' : ''}
                      {money(t.amount, t.account.currency)}
                    </td>
                    <td>
                      <button
                        className={`pill ${t.reviewed ? 'reviewed' : 'review-needed'}`}
                        onClick={() => open({ type: 'transaction', transaction: t })}
                      >
                        {t.reviewed ? 'Reviewed' : 'Needs review'}
                      </button>
                    </td>
                    <td>
                      <button
                        className="icon-button"
                        aria-label={`Delete ${t.merchant} transaction`}
                        onClick={() =>
                          remove(
                            { action: 'transaction.delete', id: t.id },
                            'Delete this transaction?',
                            'The ledger balance and analytics will change. Importing the source again may restore this entry.',
                          )
                        }
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="A little quiet here"
            text="No transactions match these filters. Try widening the date range, or add your first entry."
          />
        )}
        <div className="pagination">
          <span>{page?.rows.length || 0} entries on this page · newest first</span>
          <div>
            {cursor && (
              <button className="button secondary small" onClick={() => setCursor('')}>
                First page
              </button>
            )}
            <button
              className="button secondary small"
              disabled={!page?.nextCursor || loading}
              onClick={() => setCursor(page?.nextCursor || '')}
            >
              Next page
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      </section>
      <p className="footnote">
        Amounts are shown in each account’s original currency. Internal transfers and explicit
        adjustments are excluded from cash flow.
      </p>
    </>
  );
}
