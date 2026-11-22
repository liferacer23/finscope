'use client';
import { useMemo, useRef, useState } from 'react';
import Decimal from 'decimal.js';
import {
  FileUp,
  ArrowRight,
  Check,
  ShieldCheck,
  Download,
  X,
  RotateCcw,
  FileText,
} from 'lucide-react';
import type { FinanceData } from '@/lib/service';
import type { Action } from '@/lib/validation';
import {
  readStatement,
  detectMapping,
  normalizeRow,
  type Mapping,
  type Statement,
} from '@/lib/imports';
import type { Act } from './workspace';
import { Heading, Section, Modal, Empty, money } from './ui';
export function ImportView({
  data,
  act,
  remove,
}: {
  data: FinanceData;
  act: Act;
  remove: (a: Action, t: string, text?: string) => void;
}) {
  const [statement, setStatement] = useState<Statement | null>(null);
  const [mapping, setMapping] = useState<Mapping | null>(null);
  const [accountId, setAccountId] = useState(data.accounts.find((a) => !a.archived)?.id || '');
  const [dateOrder, setDateOrder] = useState<'ISO' | 'DMY' | 'MDY'>('ISO');
  const [descending, setDescending] = useState(false);
  const [excluded, setExcluded] = useState<Set<number>>(new Set());
  const [accepted, setAccepted] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const account = data.accounts.find((a) => a.id === accountId);
  const preview = useMemo(
    () =>
      !statement || !mapping
        ? []
        : statement.rows.map((cells, index) => {
            try {
              return {
                index,
                row: normalizeRow(
                  statement.headers,
                  cells,
                  mapping,
                  account?.currency || 'USD',
                  dateOrder,
                ),
                error: '',
              };
            } catch (e) {
              return { index, row: null, error: e instanceof Error ? e.message : 'Invalid row.' };
            }
          }),
    [statement, mapping, account?.currency, dateOrder],
  );
  const chosen = preview.filter((r) => !excluded.has(r.index));
  const invalid = chosen.filter((r) => !r.row);
  const rows = chosen.flatMap((r) => (r.row ? [r.row] : []));
  if (descending) rows.reverse();
  rows.sort((a, b) => a.date.localeCompare(b.date));
  let mismatches = 0;
  for (let i = 1; i < rows.length; i++) {
    if (
      rows[i - 1].statementBalance !== undefined &&
      rows[i].statementBalance !== undefined &&
      !new Decimal(rows[i - 1].statementBalance!).plus(rows[i].amount).eq(rows[i].statementBalance!)
    )
      mismatches++;
  }
  const ready =
    !!account &&
    !account.archived &&
    rows.length > 0 &&
    !invalid.length &&
    (!mismatches || accepted);
  const reset = () => {
    setStatement(null);
    setMapping(null);
    setExcluded(new Set());
    setAccepted(false);
    setPage(0);
    setConfirm(false);
  };
  return (
    <>
      <Heading
        eyebrow="BRING YOUR FINANCIAL STORY TOGETHER"
        title="A fresh perspective starts here"
        description="Parse locally. Review carefully. Save only the rows you choose."
      >
        <a className="button secondary" download href="/sample-statement.csv">
          <Download size={16} />
          Synthetic CSV template
        </a>
      </Heading>
      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}
      {result && (
        <div className="notice success" role="status">
          <Check size={18} />
          {result}
        </div>
      )}
      {!statement ? (
        <>
          <section
            className="upload-zone"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              void load(e.dataTransfer.files[0]);
            }}
          >
            <span className="upload-icon">
              <FileUp size={30} strokeWidth={1.5} />
            </span>
            <span className="eyebrow">YOUR NEXT CHAPTER STARTS WITH A STATEMENT</span>
            <h2>Bring the details into focus.</h2>
            <p>
              Drop your CSV or text-based PDF here.
              <br />
              Original files stay on your device.
            </p>
            <input
              type="file"
              accept=".csv,.pdf"
              aria-label="Statement file"
              ref={input}
              className="sr-only"
              onChange={(e) => void load(e.target.files?.[0])}
            />
            <button
              className="button primary"
              disabled={busy}
              onClick={() => input.current?.click()}
            >
              {busy ? 'Reading your statement…' : 'Choose a statement'}
              <ArrowRight size={16} />
            </button>
            <small>20 MB maximum · 5,000 rows · 100 PDF pages</small>
            <div className="upload-trust">
              <ShieldCheck size={14} />
              File bytes are never sent to the server.
            </div>
          </section>
          <div className="import-process">
            {[
              {
                n: '01',
                title: 'Choose your source',
                text: 'CSV from any bank, or a supported text-based PDF table.',
              },
              {
                n: '02',
                title: 'Take a closer look',
                text: 'Map columns, check dates and review every row before saving.',
              },
              {
                n: '03',
                title: 'See it all connect',
                text: 'Saved entries feed your accounts, budgets and analytics.',
              },
            ].map((item) => (
              <div key={item.n}>
                <span>{item.n}</span>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </div>
            ))}
          </div>
        </>
      ) : (
        <Section
          title="A moment to make sure"
          description={`${statement.format} · ${statement.rows.length} source rows · ${rows.length} included`}
          action={
            <button className="button secondary small" onClick={reset}>
              <X size={14} />
              Cancel review
            </button>
          }
        >
          <div className="form-grid import-config">
            <label>
              Destination account
              <select
                value={accountId}
                onChange={(e) => {
                  setAccountId(e.target.value);
                  setAccepted(false);
                }}
              >
                <option value="">Choose an account</option>
                {data.accounts
                  .filter((a) => !a.archived)
                  .map((a) => (
                    <option value={a.id} key={a.id}>
                      {a.name} · {a.currency}
                    </option>
                  ))}
              </select>
              <small>No account yet? Create one from Accounts first.</small>
            </label>
            <label>
              Date format
              <select
                value={dateOrder}
                onChange={(e) => {
                  setDateOrder(e.target.value as typeof dateOrder);
                  setAccepted(false);
                }}
              >
                <option value="ISO">Year-month-day (ISO)</option>
                <option value="DMY">Day/month/year</option>
                <option value="MDY">Month/day/year</option>
              </select>
            </label>
            <label>
              Source row order
              <select
                value={descending ? 'descending' : 'ascending'}
                onChange={(e) => {
                  setDescending(e.target.value === 'descending');
                  setAccepted(false);
                }}
              >
                <option value="ascending">Oldest first</option>
                <option value="descending">Newest first</option>
              </select>
            </label>
          </div>
          <div className="mapping-grid">
            {mapping &&
              (Object.entries(mapping) as [keyof Mapping, string][]).map(([key, value]) => (
                <label key={key}>
                  {
                    {
                      date: 'Date',
                      description: 'Description',
                      amount: 'Signed amount',
                      debit: 'Debit',
                      credit: 'Credit',
                      balance: 'Running balance',
                      reference: 'Reference',
                      currency: 'Currency',
                    }[key]
                  }
                  <select
                    value={value}
                    onChange={(e) => {
                      setMapping({ ...mapping, [key]: e.target.value });
                      setAccepted(false);
                    }}
                  >
                    <option value="">Not mapped</option>
                    {statement.headers.map((h, i) => (
                      <option key={`${h}-${i}`} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
          </div>
          <p className="footnote">
            Use a signed amount column OR debit/credit columns. Amounts accept dot decimals,
            optional currency symbols and parentheses for negatives. Thousands separators are
            rejected for explicit review.
          </p>
          {statement.warnings.map((w) => (
            <div className="notice" key={w}>
              <FileText size={17} />
              {w}
            </div>
          ))}
          {invalid.length > 0 && (
            <div className="notice error" role="alert">
              {invalid.length} included rows are invalid. Correct the mappings or explicitly exclude
              those rows. Nothing will be saved until they are resolved.
            </div>
          )}
          {mismatches > 0 && (
            <div className="notice warning">
              <div>
                <strong>{mismatches} running-balance differences need your attention.</strong>
                <p>
                  The next printed balance does not equal the previous printed balance plus the
                  transaction amount. Review order, exclusions and your original statement. No
                  balancing entries will be invented.
                </p>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={accepted}
                    onChange={(e) => setAccepted(e.target.checked)}
                  />
                  I reviewed these differences against the original and accept the stated
                  observations.
                </label>
              </div>
            </div>
          )}
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Include</th>
                  <th>Source row</th>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Amount</th>
                  <th>Balance</th>
                  <th>Review</th>
                </tr>
              </thead>
              <tbody>
                {preview.slice(page * 20, (page + 1) * 20).map((r) => (
                  <tr key={r.index} className={excluded.has(r.index) ? 'excluded' : ''}>
                    <td>
                      <input
                        type="checkbox"
                        aria-label={`Include row ${r.index + 2}`}
                        checked={!excluded.has(r.index)}
                        onChange={(e) => {
                          const next = new Set(excluded);
                          if (e.target.checked) next.delete(r.index);
                          else next.add(r.index);
                          setExcluded(next);
                          setAccepted(false);
                        }}
                      />
                    </td>
                    <td>{r.index + 2}</td>
                    <td>{r.row?.date || '—'}</td>
                    <td className="description-cell">
                      {r.row?.description || statement.rows[r.index].join(' · ').slice(0, 160)}
                    </td>
                    <td>{r.row ? money(r.row.amount, account?.currency) : '—'}</td>
                    <td>
                      {r.row?.statementBalance !== undefined
                        ? money(r.row.statementBalance, account?.currency)
                        : '—'}
                    </td>
                    <td>
                      <span
                        className={`pill ${r.error && !excluded.has(r.index) ? 'review-needed' : ''}`}
                      >
                        {excluded.has(r.index) ? 'Excluded' : r.error || 'Ready for review'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="pagination">
            <span>
              Rows {page * 20 + 1}–{Math.min((page + 1) * 20, preview.length)} of {preview.length}
            </span>
            <div>
              <button
                className="button secondary small"
                disabled={!page}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </button>
              <button
                className="button secondary small"
                disabled={(page + 1) * 20 >= preview.length}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          </div>
          <div className="form-actions">
            <span className="muted">
              Previously imported source records are skipped automatically.
            </span>
            <button
              className="button primary"
              disabled={!ready || busy}
              onClick={() => setConfirm(true)}
            >
              Review & import {rows.length} transactions
              <ArrowRight size={16} />
            </button>
          </div>
        </Section>
      )}
      <Section title="The story so far" description="A clear import trail, with an easy way back.">
        {data.imports.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Statement</th>
                  <th>Account</th>
                  <th>Imported</th>
                  <th>Added</th>
                  <th>Duplicates</th>
                  <th>Balance warnings</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {data.imports.map((i) => (
                  <tr key={i.id}>
                    <td>
                      <strong>{i.format} statement</strong>
                      <small>SHA-256 {i.hash.slice(0, 12)}…</small>
                    </td>
                    <td>{i.account.name}</td>
                    <td>{new Date(i.createdAt).toLocaleDateString()}</td>
                    <td>{i.count}</td>
                    <td>{i.duplicates}</td>
                    <td>{i.warnings.length}</td>
                    <td>
                      <button
                        className="button secondary small"
                        onClick={() =>
                          remove(
                            { action: 'import.undo', id: i.id },
                            'Undo this import?',
                            'This removes the import and all its transactions, including later editorial changes. The account remains.',
                          )
                        }
                      >
                        <RotateCcw size={14} />
                        Undo
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="A new chapter awaits"
            text="Your reviewed statement imports will appear here. You can undo an import at any time."
          />
        )}
      </Section>
      {confirm && (
        <Modal title="Ready to bring it together?" onClose={() => !busy && setConfirm(false)}>
          <p className="modal-intro">
            Import {rows.length} reviewed rows into <strong>{account?.name}</strong>.{' '}
            {excluded.size} rows excluded. {mismatches} acknowledged balance differences. Previously
            imported records will be skipped.
          </p>
          <div className="notice">
            <ShieldCheck size={18} />
            Only reviewed rows and a content hash are saved. Your source file is not uploaded.
          </div>
          <div className="form-actions">
            <button className="button secondary" disabled={busy} onClick={() => setConfirm(false)}>
              Keep reviewing
            </button>
            <button
              className="button primary"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError('');
                try {
                  const result = await act({
                    action: 'import.commit',
                    accountId,
                    hash: statement!.hash,
                    format: statement!.format,
                    acceptBalanceWarnings: accepted,
                    rows,
                  });
                  setResult(result.message);
                  reset();
                } catch (e) {
                  setError(e instanceof Error ? e.message : 'Import could not be saved.');
                  setConfirm(false);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? 'Saving atomically…' : 'Confirm import'}
              <Check size={16} />
            </button>
          </div>
        </Modal>
      )}
    </>
  );
  async function load(file?: File) {
    if (!file) return;
    setBusy(true);
    setError('');
    setResult('');
    reset();
    try {
      const parsed = await readStatement(file);
      setStatement(parsed);
      setMapping(detectMapping(parsed.headers));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'This statement could not be read.');
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  }
}
