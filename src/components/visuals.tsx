'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  ArrowUpRight,
  ArrowDownRight,
  ArrowRight,
  Plus,
  Wallet,
  Sparkles,
  TrendingUp,
  Info,
  RefreshCcw,
} from 'lucide-react';
import type { FinanceData } from '@/lib/service';
import { forecast } from '@/lib/finance';
import type { DialogAction } from './forms';
import { request } from './auth';
import { Heading, Section, Empty, Progress, money } from './ui';
const colors = ['#8c7ad8', '#b4a2ef', '#639e8f', '#d7ad76', '#a2b8ce', '#d89594', '#a9aa96'];
export function Overview({ data, open }: { data: FinanceData; open: (d: DialogAction) => void }) {
  const currency = data.workspace.currency;
  const [chart, setChart] = useState<'cashflow' | 'net'>('cashflow');
  const c = data.summary;
  const latest = data.months.at(-1);
  const previous = data.months.at(-2);
  const change = previous && latest ? Number(latest.net) - Number(previous.net) : 0;
  const chartData = data.months.map((m) => ({
    ...m,
    income: Number(m.income),
    spending: Number(m.spending),
    net: Number(m.net),
  }));
  return (
    <>
      <Heading
        eyebrow="A LITTLE PERSPECTIVE GOES A LONG WAY"
        title="Your bigger picture"
        description="A clear view of today. A little more confidence for tomorrow."
      >
        <a className="button secondary" href="/api/export">
          Export report
          <ArrowUpRight size={15} />
        </a>
        <Link prefetch={false} className="button primary" href="/app/imports">
          <Plus size={16} />
          Import a statement
        </Link>
      </Heading>
      {(c.missingRates > 0 || c.truncated) && (
        <div className="notice">
          <Info size={18} />
          <span>
            {c.missingRates > 0
              ? `${c.missingRates} entries or holdings have missing exchange rates. Converted totals are partial. `
              : ''}
            {c.truncated
              ? 'Trend analysis uses the latest 10,000 entries. Account balances include the full ledger.'
              : ''}
          </span>
        </div>
      )}
      <div className="metric-grid">
        <article className="metric-card featured">
          <div className="metric-title">
            Total net worth
            <Wallet size={16} />
          </div>
          <div className="metric-value">{money(c.networth, currency)}</div>
          <div className="metric-note">
            <span className="status-dot" />
            Across {data.accounts.length} accounts · recorded balances
          </div>
        </article>
        <article className="metric-card">
          <div className="metric-title">
            Money in
            <ArrowDownRight size={17} />
          </div>
          <div className="metric-value">{money(c.income, currency)}</div>
          <div className="metric-note">
            <span className="dot teal" />
            Income · {new Date().toLocaleDateString('en', { month: 'long' })}
          </div>
        </article>
        <article className="metric-card">
          <div className="metric-title">
            Money out
            <ArrowUpRight size={17} />
          </div>
          <div className="metric-value">{money(c.spending, currency)}</div>
          <div className="metric-note">
            <span className="dot coral" />
            Spending after refunds · this month
          </div>
        </article>
        <article className="metric-card">
          <div className="metric-title">
            Savings rate
            <TrendingUp size={17} />
          </div>
          <div className="metric-value">{c.savingsRate === null ? '—' : `${c.savingsRate}%`}</div>
          <div className="metric-note">
            {c.savingsRate === null
              ? 'No recorded monthly income'
              : 'Net cash flow / recorded income'}
          </div>
        </article>
      </div>
      <div className="overview-main">
        <Section
          title="The flow of your finances"
          description="Monthly income and spending. Transfers stay out of the picture."
          action={
            <div className="segmented">
              <button aria-pressed={chart === 'cashflow'} onClick={() => setChart('cashflow')}>
                Cash flow
              </button>
              <button aria-pressed={chart === 'net'} onClick={() => setChart('net')}>
                Net
              </button>
            </div>
          }
        >
          <div className="chart-summary">
            <strong>{money(chart === 'cashflow' ? c.income : c.net, currency)}</strong>
            <span className={change >= 0 ? 'positive' : 'negative'}>
              {change >= 0 ? '↗' : '↘'} {money(Math.abs(change), currency)} net change from last
              month
            </span>
          </div>
          <div
            className="chart chart-lg"
            role="img"
            aria-label="Six months of recorded income, spending and net cash flow"
          >
            <ResponsiveContainer width="100%" height="100%">
              {chart === 'cashflow' ? (
                <AreaChart data={chartData} margin={{ left: -10, right: 10, top: 10 }}>
                  <defs>
                    <linearGradient id="incomeFill" x1="0" y1="0" x2="0" y2="1">
                      <stop stopColor="#9b87e6" stopOpacity={0.25} />
                      <stop offset="1" stopColor="#9b87e6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 4" />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11, fill: 'var(--muted)' }}
                    dy={10}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 10, fill: 'var(--muted)' }}
                    tickFormatter={(v) => `${Number(v) / 1000}k`}
                  />
                  <Tooltip
                    formatter={(value) => money(Number(value), currency)}
                    contentStyle={{
                      background: 'var(--panel)',
                      border: '1px solid var(--border)',
                      borderRadius: 12,
                    }}
                  />
                  <Area
                    isAnimationActive={false}
                    name="Income"
                    dataKey="income"
                    type="monotone"
                    stroke="#9983e4"
                    strokeWidth={2.5}
                    fill="url(#incomeFill)"
                  />
                  <Area
                    isAnimationActive={false}
                    name="Spending"
                    dataKey="spending"
                    type="monotone"
                    stroke="#d49a7b"
                    strokeWidth={2}
                    fill="transparent"
                    strokeDasharray="5 4"
                  />
                  <Legend
                    iconType="circle"
                    iconSize={7}
                    wrapperStyle={{ fontSize: 11, paddingTop: 20 }}
                  />
                </AreaChart>
              ) : (
                <BarChart data={chartData} margin={{ left: -10, right: 10, top: 10 }}>
                  <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 4" />
                  <XAxis
                    dataKey="label"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'var(--muted)', fontSize: 11 }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `${Number(v) / 1000}k`}
                    tick={{ fill: 'var(--muted)', fontSize: 10 }}
                  />
                  <Tooltip formatter={(v) => money(Number(v), currency)} />
                  <Bar
                    isAnimationActive={false}
                    name="Net cash flow"
                    dataKey="net"
                    fill="#a897df"
                    radius={[5, 5, 0, 0]}
                    maxBarSize={35}
                  />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
          <details className="chart-table">
            <summary>View chart data</summary>
            <table>
              <thead>
                <tr>
                  <th>Month</th>
                  <th>Income</th>
                  <th>Spending</th>
                  <th>Net</th>
                </tr>
              </thead>
              <tbody>
                {data.months.map((m) => (
                  <tr key={m.month}>
                    <td>{m.month}</td>
                    <td>{money(m.income, currency)}</td>
                    <td>{money(m.spending, currency)}</td>
                    <td>{money(m.net, currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </Section>
        <Section
          title="Where it goes"
          description="This month’s spending, after refunds."
          action={
            <Link prefetch={false} className="text-button" href="/app/budgets">
              Budgets
              <ArrowUpRight size={14} />
            </Link>
          }
        >
          {data.categories.length ? (
            <>
              <div
                className="donut-chart"
                role="img"
                aria-label="Current-month spending by category"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      isAnimationActive={false}
                      data={data.categories
                        .filter((c) => Number(c.value) > 0)
                        .map((c) => ({ ...c, value: Number(c.value) }))}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={66}
                      outerRadius={88}
                      paddingAngle={4}
                      stroke="none"
                    >
                      {data.categories.map((c, i) => (
                        <Cell key={c.name} fill={colors[i % colors.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => money(Number(v), currency)} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="donut-center">
                  <small>TOTAL SPENT</small>
                  <strong>{money(c.spending, currency)}</strong>
                </div>
              </div>
              <div className="category-legend">
                {data.categories.slice(0, 5).map((cat, i) => (
                  <Link
                    prefetch={false}
                    href={`/app/transactions?category=${encodeURIComponent(cat.name)}`}
                    key={cat.name}
                  >
                    <span>
                      <i style={{ background: colors[i % colors.length] }} />
                      {cat.name}
                    </span>
                    <strong>{money(cat.value, currency)}</strong>
                  </Link>
                ))}
              </div>
            </>
          ) : (
            <Empty
              title="A blank canvas"
              text="Spending categories will appear as you add transactions."
            />
          )}
        </Section>
      </div>
      <div className="overview-bottom">
        <Section
          title="Your accounts, at a glance"
          description="Recorded balances in their original currencies."
          action={
            <Link prefetch={false} className="text-button" href="/app/accounts">
              View all
              <ArrowUpRight size={14} />
            </Link>
          }
        >
          <div className="account-list">
            {data.accounts
              .filter((a) => !a.archived)
              .slice(0, 4)
              .map((a, i) => (
                <div key={a.id}>
                  <span className={`bank-badge bank-${i % 3}`}>{a.institution[0]}</span>
                  <div>
                    <strong>{a.name}</strong>
                    <small>
                      {a.institution} · {a.currency}
                    </small>
                  </div>
                  <strong>{money(a.balance, a.currency)}</strong>
                </div>
              ))}
            {!data.accounts.length && (
              <Empty
                title="Bring your first account"
                text="Add an account to start building your picture."
              />
            )}
            <button className="add-account-link" onClick={() => open({ type: 'account' })}>
              <Plus size={15} />
              Add an account
            </button>
          </div>
        </Section>
        <Section
          title="A little closer to your goals"
          description="The things your savings are making possible."
          action={
            <Link prefetch={false} className="text-button" href="/app/goals">
              All goals
              <ArrowUpRight size={14} />
            </Link>
          }
        >
          <div className="goal-list">
            {data.goals.map((g, i) => (
              <div key={g.id}>
                <span className={`goal-emoji goal-emoji-${i % 2}`}>{i % 2 === 0 ? '↗' : '✳'}</span>
                <div>
                  <div>
                    <strong>{g.name}</strong>
                    <small>{Math.round((Number(g.saved) / Number(g.target)) * 100)}%</small>
                  </div>
                  <Progress
                    value={(Number(g.saved) / Number(g.target)) * 100}
                    label={`${g.name} progress`}
                  />
                  <p>
                    {money(g.saved, currency)}
                    <span> of {money(g.target, currency)}</span>
                  </p>
                </div>
              </div>
            ))}
            {!data.goals.length && (
              <Empty
                title="Something worth saving for"
                text="Give your savings a purpose with your first goal."
              />
            )}
          </div>
          <div className="insight-strip">
            <Sparkles size={17} />
            <p>A small step today. More freedom tomorrow.</p>
            <Link prefetch={false} href="/app/goals" aria-label="View savings goals">
              <ArrowRight size={17} />
            </Link>
          </div>
        </Section>
      </div>
      <section className="clarity-note">
        <span>✦</span>
        <div>
          <strong>Good decisions start with a clearer view.</strong>
          <p>
            {data.recurring.length} recurring payment patterns detected. Take a moment to see what
            still serves you.
          </p>
        </div>
        <Link prefetch={false} href="/app/insights" className="button secondary small">
          Explore insights
          <ArrowUpRight size={14} />
        </Link>
      </section>
    </>
  );
}
export function Forecast({ data }: { data: FinanceData }) {
  const [start, setStart] = useState(data.summary.networth);
  const [income, setIncome] = useState(data.summary.income);
  const [spending, setSpending] = useState(data.summary.spending);
  const [rate, setRate] = useState('0');
  const [months, setMonths] = useState(12);
  const [error, setError] = useState('');
  const currency = data.workspace.currency;
  const scenarios = useMemo(() => {
    try {
      if (![start, income, spending, rate].every((s) => /^-?\d+(\.\d{1,4})?$/.test(s))) return null;
      if (Number(income) < 0 || Number(spending) < 0 || Number(rate) < 0 || Number(rate) > 30)
        return null;
      return forecast(start, income, spending, months, rate);
    } catch {
      return null;
    }
  }, [start, income, spending, rate, months]);
  const points = scenarios?.[0].points.map((p, i) => ({
    month: p.month,
    Conservative: Number(p.balance),
    Expected: Number(scenarios[1].points[i].balance),
    Optimistic: Number(scenarios[2].points[i].balance),
  }));
  return (
    <>
      <Heading
        eyebrow="A LITTLE FORESIGHT"
        title="Tomorrow, with perspective"
        description="Explore assumptions, not promises. Your ledger stays unchanged."
      />
      <div className="forecast-layout">
        <Section
          title="The assumptions"
          description={`All amounts in ${currency}. Inputs stay on this page.`}
        >
          <div className="forecast-inputs">
            {[
              { label: 'Starting net worth', value: start, set: setStart },
              { label: 'Monthly income', value: income, set: setIncome },
              { label: 'Monthly spending', value: spending, set: setSpending },
              { label: 'Blended annual interest (%)', value: rate, set: setRate },
            ].map((f) => (
              <label key={f.label}>
                {f.label}
                <input
                  inputMode="decimal"
                  value={f.value}
                  onChange={(e) => f.set(e.target.value)}
                />
              </label>
            ))}
            <label>
              Forecast horizon
              <select value={months} onChange={(e) => setMonths(Number(e.target.value))}>
                {[6, 12, 24, 36, 60].map((m) => (
                  <option value={m} key={m}>
                    {m} months
                  </option>
                ))}
              </select>
            </label>
            <button
              className="button secondary small"
              onClick={() => {
                setStart(data.summary.networth);
                setIncome(data.summary.income);
                setSpending(data.summary.spending);
                setRate('0');
                setMonths(12);
                setError('');
              }}
            >
              <RefreshCcw size={15} />
              Reset assumptions
            </button>
          </div>
        </Section>
        <Section
          title="The possibilities ahead"
          description="Conservative: 90% income, 110% spending. Optimistic: 110% income, 90% spending."
        >
          {scenarios ? (
            <>
              <div className="forecast-totals">
                {scenarios.map((s, i) => (
                  <div key={s.label}>
                    <small>{s.label}</small>
                    <strong style={{ color: colors[i] }}>
                      {money(s.points.at(-1)!.balance, currency)}
                    </strong>
                  </div>
                ))}
              </div>
              <div
                className="chart chart-xl"
                role="img"
                aria-label="Projected net worth under three editable scenarios"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={points}>
                    <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 4" />
                    <XAxis
                      dataKey="month"
                      tickLine={false}
                      axisLine={false}
                      label={{ value: 'Months from now', position: 'insideBottom', offset: -5 }}
                    />
                    <YAxis
                      width={65}
                      tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      formatter={(v) => money(Number(v), currency)}
                      labelFormatter={(v) => `Month ${v}`}
                    />
                    {['Conservative', 'Expected', 'Optimistic'].map((key, i) => (
                      <Line
                        isAnimationActive={false}
                        key={key}
                        name={key}
                        dataKey={key}
                        stroke={colors[i]}
                        strokeWidth={key === 'Expected' ? 3 : 2}
                        strokeDasharray={key === 'Expected' ? undefined : '5 4'}
                        dot={false}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </>
          ) : (
            <div className="notice error" role="alert">
              Enter valid decimal assumptions. Income and spending must be nonnegative; annual
              interest must be 0–30%.
            </div>
          )}
          {error && <p role="alert">{error}</p>}
          <p className="footnote">
            Interest defaults to 0% and compounds monthly after net cash flow. Projections exclude
            tax, inflation, exchange-rate movements, borrowing costs and account restrictions. They
            are arithmetic scenarios, not financial advice.
          </p>
        </Section>
      </div>
    </>
  );
}
export function Insights({ data }: { data: FinanceData }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [ai, setAi] = useState<{ text: string; source: string } | null>(null);
  return (
    <>
      <Heading
        eyebrow="FIND THE SIGNAL IN YOUR STORY"
        title="A different point of view"
        description="Transparent patterns from your recorded activity. A starting point for your own review."
      />
      <div className="insight-grid">
        {data.insights.map((insight, i) => (
          <article className="panel insight-card" key={insight.title}>
            <span className="insight-number">0{i + 1} /</span>
            <Sparkles size={22} />
            <h2>{insight.title}</h2>
            <p>{insight.text}</p>
            <span className="pill">Rule-based insight</span>
          </article>
        ))}
      </div>
      <Section
        title="The familiar little payments"
        description="At least three similar payments, 25–35 days apart. Estimates can be overdue when records are incomplete."
      >
        {data.recurring.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Merchant</th>
                  <th>Estimated amount</th>
                  <th>Estimated next date</th>
                  <th>Detection</th>
                </tr>
              </thead>
              <tbody>
                {data.recurring.map((r) => (
                  <tr key={r.merchant}>
                    <td>
                      <strong>{r.merchant}</strong>
                    </td>
                    <td>{money(r.amount, data.workspace.currency)}</td>
                    <td>{r.next}</td>
                    <td>
                      <span className="pill">Unconfirmed pattern</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="Patterns take a little time"
            text="At least three similar monthly payments are needed before a pattern appears."
          />
        )}
      </Section>
      <Section
        title="An optional second perspective"
        description="AI summaries require a configured provider. Only aggregate totals are shared when you explicitly request one."
        action={
          <button
            className="button secondary small"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError('');
              try {
                setAi(await request('/api/insights', { method: 'POST', body: '{}' }));
              } catch (e) {
                setError(e instanceof Error ? e.message : 'Unable to generate insight.');
              } finally {
                setBusy(false);
              }
            }}
          >
            <Sparkles size={15} />
            {busy ? 'Considering the numbers…' : 'Generate AI summary'}
          </button>
        }
      >
        {error && (
          <div className="notice" role="status">
            {error}
          </div>
        )}
        {ai ? (
          <div className="ai-summary">
            <p>{ai.text}</p>
            <small>{ai.source} · May contain errors. Verify against your records.</small>
          </div>
        ) : (
          <p className="muted">
            Your rule-based insights remain available with no external credentials.
          </p>
        )}
      </Section>
    </>
  );
}
