'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  LayoutDashboard,
  ArrowLeftRight,
  WalletCards,
  FileUp,
  ChartNoAxesCombined,
  Target,
  SlidersHorizontal,
  Settings2,
  Search,
  ArrowUpRight,
  Sun,
  Moon,
  Menu,
  X,
  LogOut,
  Command,
  ShieldCheck,
  Sparkles,
  Plus,
} from 'lucide-react';
import type { FinanceData } from '@/lib/service';
import type { Action } from '@/lib/validation';
import { request } from './auth';
import { Modal, Heading, money, Section, Progress, Empty } from './ui';
import { Overview, Forecast, Insights } from './visuals';
import { Transactions } from './transactions';
import { ImportView } from './imports';
import { ActionForm, type DialogAction } from './forms';
const nav = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'transactions', label: 'Transactions', icon: ArrowLeftRight },
  { id: 'accounts', label: 'Accounts', icon: WalletCards },
  { id: 'imports', label: 'Statement imports', icon: FileUp },
  { id: 'budgets', label: 'Budgets', icon: SlidersHorizontal },
  { id: 'goals', label: 'Savings goals', icon: Target },
  { id: 'insights', label: 'Insights', icon: ChartNoAxesCombined },
  { id: 'forecast', label: 'Forecast', icon: Sparkles },
];
export type Act = (input: Action) => Promise<{ message: string; id?: string }>;
export function Workspace({ view }: { view: string }) {
  const router = useRouter();
  const [data, setData] = useState<FinanceData | null>(null);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [menu, setMenu] = useState(false);
  const [command, setCommand] = useState(false);
  const [query, setQuery] = useState('');
  const [dark, setDark] = useState(false);
  const [dialog, setDialog] = useState<DialogAction | null>(null);
  const [confirm, setConfirm] = useState<{ title: string; text: string; action: Action } | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const refresh = useCallback(async () => {
    try {
      const next = await request<FinanceData>('/api/data');
      setData(next);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load your workspace.');
    }
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  useEffect(() => {
    const saved = localStorage.getItem('finscope-theme') === 'dark';
    setDark(saved);
    document.documentElement.dataset.theme = saved ? 'dark' : 'light';
    return () => {
      delete document.documentElement.dataset.theme;
    };
  }, []);
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommand((v) => !v);
      }
    };
    document.addEventListener('keydown', listener);
    return () => document.removeEventListener('keydown', listener);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 5000);
    return () => clearTimeout(t);
  }, [toast]);
  const act: Act = async (input) => {
    const result = await request<{ message: string; id?: string }>('/api/actions', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    await refresh();
    setToast(result.message);
    return result;
  };
  const open = (action: DialogAction) => setDialog(action);
  const remove = (
    action: Action,
    title: string,
    text = 'This change cannot be undone. Other workspace records are kept.',
  ) => setConfirm({ action, title, text });
  const label = nav.find((n) => n.id === view)?.label || 'Settings';
  let content: ReactNode = null;
  if (data) {
    const currency = data.workspace.currency;
    switch (view) {
      case 'overview':
        content = <Overview data={data} open={open} />;
        break;
      case 'transactions':
        content = <Transactions data={data} act={act} open={open} remove={remove} />;
        break;
      case 'imports':
        content = <ImportView data={data} act={act} remove={remove} />;
        break;
      case 'forecast':
        content = <Forecast data={data} />;
        break;
      case 'insights':
        content = <Insights data={data} />;
        break;
      case 'accounts':
        content = (
          <>
            <Heading
              eyebrow="EVERY ACCOUNT HAS A PURPOSE"
              title="Your money, in perspective"
              description="One ledger per account. Original currencies stay intact."
            >
              <button className="button primary" onClick={() => open({ type: 'account' })}>
                <Plus size={16} />
                Add account
              </button>
            </Heading>
            <div className="account-grid">
              {data.accounts
                .filter((a) => !a.archived)
                .map((a, i) => (
                  <article className={`account-card account-color-${i % 3}`} key={a.id}>
                    <div className="account-card-top">
                      <span className="bank-icon">{a.institution[0]}</span>
                      <span>
                        {a.kind} · {a.currency}
                      </span>
                    </div>
                    <p>{a.institution}</p>
                    <h2>{a.name}</h2>
                    <div className="account-balance">{money(a.balance, a.currency)}</div>
                    <small>
                      {a.converted
                        ? `${money(a.converted, currency)} in your reporting currency`
                        : 'Conversion rate needed'}
                    </small>
                    <div className="account-card-actions">
                      <button onClick={() => open({ type: 'reconcile', id: a.id })}>
                        Reconcile <ArrowUpRight size={14} />
                      </button>
                      <button
                        onClick={() =>
                          remove(
                            { action: 'account.archive', id: a.id },
                            'Archive this account?',
                            'Its full transaction history remains in your ledger. Archived accounts cannot receive new entries.',
                          )
                        }
                      >
                        Archive
                      </button>
                    </div>
                  </article>
                ))}
            </div>
            {!data.accounts.filter((a) => !a.archived).length && (
              <Empty
                title="A place for your first account"
                text="Add a checking or savings account with an explicit opening balance."
              />
            )}
            <Section
              title="A ledger you can follow"
              description="Opening balances plus all recorded entries. Missing transactions can make balances incomplete."
            >
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Account</th>
                      <th>Opening balance</th>
                      <th>Recorded balance</th>
                      <th>Latest statement observation</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.accounts.map((a) => (
                      <tr key={a.id}>
                        <td>
                          <strong>{a.name}</strong>
                          <small>{a.institution}</small>
                        </td>
                        <td>{money(a.openingBalance, a.currency)}</td>
                        <td>{money(a.balance, a.currency)}</td>
                        <td>
                          {a.lastStatement
                            ? `${money(a.lastStatement.balance, a.currency)} · ${a.lastStatement.date}`
                            : 'Not provided'}
                        </td>
                        <td>
                          <span className="pill">{a.archived ? 'Archived' : 'Active'}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          </>
        );
        break;
      case 'budgets':
        content = (
          <>
            <Heading
              eyebrow="SPEND WITH A LITTLE MORE INTENTION"
              title="Room for what matters"
              description={`Monthly category budgets in ${currency}. Refunds reduce recorded spending.`}
            >
              <button className="button primary" onClick={() => open({ type: 'budget' })}>
                <Plus size={16} />
                Set a budget
              </button>
            </Heading>
            <div className="budget-grid">
              {data.budgets.map((b) => {
                const ratio = (Number(b.spent) / Number(b.amount)) * 100;
                return (
                  <article className={`panel budget-card ${ratio > 100 ? 'over' : ''}`} key={b.id}>
                    <div className="section-heading">
                      <h2>{b.category}</h2>
                      <span className="pill">{b.month}</span>
                    </div>
                    <div className="budget-amount">
                      {money(b.spent, currency)}
                      <span> / {money(b.amount, currency)}</span>
                    </div>
                    <Progress value={ratio} label={`${b.category} budget used`} />
                    <p className={ratio > 100 ? 'negative' : 'muted'}>
                      {ratio > 100
                        ? `${money(Number(b.spent) - Number(b.amount), currency)} over budget`
                        : `${money(Number(b.amount) - Number(b.spent), currency)} left to spend`}
                    </p>
                    <div className="card-actions">
                      <button
                        className="text-button"
                        onClick={() => open({ type: 'budget', id: b.id })}
                      >
                        Edit budget
                      </button>
                      <button
                        className="text-button"
                        onClick={() =>
                          remove({ action: 'budget.delete', id: b.id }, 'Remove this budget?')
                        }
                      >
                        Remove
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
            {!data.budgets.length && (
              <Empty
                title="Give your money a little direction"
                text="Set your first monthly category budget to see progress and over-budget alerts."
              />
            )}
            <p className="footnote">
              Each budget uses its own month’s recorded spending in the workspace reporting
              currency. Missing currency coverage makes progress incomplete.
            </p>
          </>
        );
        break;
      case 'goals':
        content = (
          <>
            <Heading
              eyebrow="SOMETHING WORTH LOOKING FORWARD TO"
              title="A little closer, every day"
              description="Earmark existing savings for your goals. Progress never adds money to net worth."
            >
              <button className="button primary" onClick={() => open({ type: 'goal' })}>
                <Plus size={16} />
                Create a goal
              </button>
            </Heading>
            <div className="goals-grid">
              {data.goals.map((g, i) => (
                <article className="panel goal-card" key={g.id}>
                  <div className={`goal-art goal-art-${i % 3}`}>
                    <Target size={54} strokeWidth={1} />
                    <span>{String(i + 1).padStart(2, '0')}</span>
                  </div>
                  <span className="eyebrow">YOUR NEXT CHAPTER</span>
                  <h2>{g.name}</h2>
                  <p className="goal-amount">
                    {money(g.saved, currency)}
                    <span>of {money(g.target, currency)}</span>
                  </p>
                  <Progress
                    value={(Number(g.saved) / Number(g.target)) * 100}
                    label={`${g.name} progress`}
                  />
                  <div className="goal-detail">
                    <span>
                      {Math.round((Number(g.saved) / Number(g.target)) * 100)}% of the way there
                    </span>
                    <span>By {g.dueDate}</span>
                  </div>
                  <div className="card-actions">
                    <button
                      className="button secondary small"
                      onClick={() => open({ type: 'contribute', id: g.id })}
                    >
                      Update progress <ArrowUpRight size={14} />
                    </button>
                    <button
                      className="text-button"
                      onClick={() =>
                        remove(
                          { action: 'goal.delete', id: g.id },
                          'Remove this savings goal?',
                          'This removes the earmark. Account balances are not changed.',
                        )
                      }
                    >
                      Remove
                    </button>
                  </div>
                </article>
              ))}
            </div>
            {!data.goals.length && (
              <Empty
                title="What are you looking forward to?"
                text="Create a goal and give your savings a purpose."
              />
            )}
          </>
        );
        break;
      case 'settings':
        content = (
          <>
            <Heading
              eyebrow="YOUR WORKSPACE. YOUR WAY."
              title="The little details"
              description="Preferences, dated exchange rates and a clear record of changes."
            />
            <Section
              title="Workspace preferences"
              description="Reporting currency affects analytical totals. Existing goals and budgets must be cleared before changing currency."
              action={
                <button
                  className="button secondary small"
                  onClick={() => open({ type: 'workspace' })}
                >
                  Edit preferences
                </button>
              }
            >
              <div className="settings-summary">
                <div>
                  <small>Workspace name</small>
                  <strong>{data.workspace.name}</strong>
                </div>
                <div>
                  <small>Reporting currency</small>
                  <strong>{currency}</strong>
                </div>
                <div>
                  <small>Access</small>
                  <strong>
                    {data.workspace.demo ? 'Isolated demo · 7 days' : 'Private account'}
                  </strong>
                </div>
              </div>
            </Section>
            <Section
              title="Currency, with a source"
              description="Only direct or inverse rates effective on or before an entry date are used. No invented rates or automatic triangulation."
              action={
                <button className="button secondary small" onClick={() => open({ type: 'rate' })}>
                  <Plus size={14} />
                  Add a rate
                </button>
              }
            >
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Pair</th>
                      <th>Reference rate</th>
                      <th>Effective date</th>
                      <th>Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.rates.map((r) => (
                      <tr key={r.id}>
                        <td>
                          {r.from} → {r.to}
                        </td>
                        <td>{Number(r.rate).toPrecision(8)}</td>
                        <td>{r.date}</td>
                        <td>{r.source}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!data.rates.length && (
                <Empty
                  title="Original currencies, for now"
                  text="Add a verified dated rate or fetch a reference rate from Frankfurter."
                />
              )}
            </Section>
            <Section
              title="A clear trail"
              description="Workspace-scoped records of financial changes."
            >
              <div className="audit-list">
                {data.audits.map((a) => (
                  <div key={a.id}>
                    <span className="audit-dot" />
                    <div>
                      <strong>{a.action.replaceAll('.', ' / ')}</strong>
                      <p>{a.detail}</p>
                    </div>
                    <time>{new Date(a.createdAt).toLocaleString()}</time>
                  </div>
                ))}
              </div>
            </Section>
            {data.workspace.demo && (
              <section className="panel reset-panel">
                <div>
                  <h2>A fresh start for your demo</h2>
                  <p>
                    Restore synthetic records in this workspace. Other visitors and private accounts
                    stay separate.
                  </p>
                </div>
                <button
                  className="button secondary"
                  onClick={() =>
                    remove(
                      { action: 'demo.reset' },
                      'Reset your demo?',
                      'Replace your demo changes with the original synthetic dataset. This only affects your current workspace.',
                    )
                  }
                >
                  Reset demo
                </button>
              </section>
            )}
            <section className="notice">
              <ShieldCheck size={20} />
              <span>
                Statements are parsed in your browser; reviewed transactions are saved to this
                workspace’s server database. Raw statements are not uploaded. AI summaries, when
                configured and explicitly requested, receive aggregate figures only.
              </span>
            </section>
          </>
        );
        break;
    }
  }
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <aside className={`sidebar ${menu ? 'open' : ''}`}>
        <Link prefetch={false} href="/" className="wordmark">
          <span className="brand-icon">◈</span>finscope<span className="wordmark-dot">.</span>
        </Link>
        <button
          className="mobile-close icon-button"
          aria-label="Close navigation"
          onClick={() => setMenu(false)}
        >
          <X />
        </button>
        <button className="command-launch" onClick={() => setCommand(true)}>
          <Search size={15} />
          Quick navigation<kbd>⌘ K</kbd>
        </button>
        <span className="nav-label">YOUR FINANCIAL WORKSPACE</span>
        <nav aria-label="Workspace navigation">
          {nav.map((n) => (
            <Link
              prefetch={false}
              href={`/app/${n.id}`}
              className={`nav-item ${view === n.id ? 'active' : ''}`}
              aria-current={view === n.id ? 'page' : undefined}
              key={n.id}
              onClick={() => setMenu(false)}
            >
              <n.icon size={18} />
              {n.label}
              {view === n.id && <span className="nav-dot" />}
            </Link>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="sidebar-note">
            <span>✦</span>
            <strong>Clarity is a good feeling.</strong>
            <p>
              A little perspective.
              <br />A lot more possibility.
            </p>
            <Link prefetch={false} href="/app/insights">
              Find your next insight <ArrowUpRight size={14} />
            </Link>
          </div>
          <Link
            prefetch={false}
            href="/app/settings"
            className={`nav-item ${view === 'settings' ? 'active' : ''}`}
          >
            <Settings2 size={18} />
            Workspace settings
          </Link>
          <button
            className="profile"
            onClick={async () => {
              try {
                await request('/api/auth/logout', { method: 'POST', body: '{}' });
                router.push('/');
              } catch (e) {
                setError(e instanceof Error ? e.message : 'Could not sign out.');
              }
            }}
          >
            <span className="avatar">{data?.workspace.name[0] || 'F'}</span>
            <span>
              <strong>{data?.workspace.demo ? 'Demo explorer' : 'Your workspace'}</strong>
              <small>Sign out</small>
            </span>
            <LogOut size={16} />
          </button>
        </div>
      </aside>
      {menu && (
        <button
          className="sidebar-backdrop"
          aria-label="Close navigation"
          onClick={() => setMenu(false)}
        />
      )}
      <div className="main-wrap">
        <header className="topbar">
          <div>
            <button
              className="mobile-menu icon-button"
              aria-label="Open navigation"
              onClick={() => setMenu(true)}
            >
              <Menu />
            </button>
            <span className="breadcrumb">
              Workspace <span>/</span> <strong>{label}</strong>
            </span>
          </div>
          <div>
            <span className="topbar-date">
              {new Date().toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
            <button
              className="icon-button"
              aria-label={dark ? 'Use light theme' : 'Use dark theme'}
              onClick={() => {
                setDark(!dark);
                document.documentElement.dataset.theme = !dark ? 'dark' : 'light';
                localStorage.setItem('finscope-theme', !dark ? 'dark' : 'light');
              }}
            >
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <span className="avatar small">{data?.workspace.name[0] || 'F'}</span>
          </div>
        </header>
        {data?.workspace.demo && (
          <div className="demo-banner">
            <span>
              <Sparkles size={14} />
              <strong>Your own demo workspace.</strong>
              <span className="banner-detail">
                Synthetic data. Explore freely. Other visitors stay separate.
              </span>
            </span>
            <Link prefetch={false} href="/register">
              Make it yours <ArrowUpRight size={14} />
            </Link>
          </div>
        )}
        <main id="main">
          {error && (
            <div className="notice error" role="alert">
              <span>{error}</span>
              <button className="text-button" onClick={() => void refresh()}>
                Retry
              </button>
              <Link prefetch={false} href="/sign-in">
                Sign in
              </Link>
            </div>
          )}
          {!data && !error ? (
            <div className="dashboard-loading" role="status">
              <div className="skeleton short" />
              <div className="metric-grid">
                {[0, 1, 2, 3].map((i) => (
                  <div className="skeleton" key={i} />
                ))}
              </div>
              <div className="skeleton tall" />
              <span>Bringing your picture into focus…</span>
            </div>
          ) : (
            content
          )}
        </main>
        <footer className="app-footer">
          <span>
            <ShieldCheck size={13} /> Original amounts. Transparent calculations.
          </span>
          <span>A little more clarity, every day.</span>
        </footer>
      </div>
      {dialog && data && (
        <ActionForm config={dialog} data={data} act={act} onClose={() => setDialog(null)} />
      )}{' '}
      {confirm && (
        <Modal title={confirm.title} onClose={() => !busy && setConfirm(null)}>
          <p className="modal-intro">{confirm.text}</p>
          <div className="form-actions">
            <button className="button secondary" disabled={busy} onClick={() => setConfirm(null)}>
              Keep it
            </button>
            <button
              className="button danger"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await act(confirm.action);
                  setConfirm(null);
                } catch (e) {
                  setError(e instanceof Error ? e.message : 'Unable to complete the change.');
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? 'Saving…' : 'Confirm change'}
            </button>
          </div>
        </Modal>
      )}
      {command && (
        <Modal title="Where would you like to go?" onClose={() => setCommand(false)}>
          <div className="command-input">
            <Command size={18} />
            <input
              autoFocus
              aria-label="Search pages"
              placeholder="Search your workspace…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="command-results">
            {[...nav, { id: 'settings', label: 'Settings', icon: Settings2 }]
              .filter((n) => n.label.toLowerCase().includes(query.toLowerCase()))
              .map((n) => (
                <Link
                  prefetch={false}
                  key={n.id}
                  href={`/app/${n.id}`}
                  onClick={() => {
                    setCommand(false);
                    setQuery('');
                  }}
                >
                  <n.icon size={18} />
                  {n.label}
                  <ArrowUpRight size={14} />
                </Link>
              ))}
          </div>
        </Modal>
      )}
      {toast && (
        <div className="toast" role="status">
          <span className="status-dot" />
          {toast}
          <button
            className="icon-button"
            aria-label="Dismiss notification"
            onClick={() => setToast('')}
          >
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  );
}
