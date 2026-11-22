import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { db } from '../src/lib/db';
import { execute, getData, transactionPage } from '../src/lib/service';
import { actionInput } from '../src/lib/validation';
import { seedWorkspace } from '../src/lib/seed';
import { hashToken, sessionFromToken } from '../src/lib/auth';
const url = new URL(process.env.DATABASE_URL || 'postgresql://invalid/invalid');
if (!url.pathname.endsWith('_test'))
  throw new Error('Integration tests require a dedicated database with an _test suffix.');
test('real PostgreSQL workflows are atomic, idempotent, tenant-scoped and persistent', async () => {
  const a = await db.workspace.create({
    data: { name: 'Synthetic integration workspace', demo: true },
  });
  const b = await db.workspace.create({
    data: { name: 'Independent synthetic workspace', demo: true },
  });
  const run = (workspaceId: string, input: unknown) =>
    execute(workspaceId, actionInput.parse(input));
  try {
    const account = await run(a.id, {
      action: 'account.create',
      name: 'Synthetic checking',
      institution: 'Test Bank',
      currency: 'USD',
      kind: 'checking',
      openingBalance: '100',
    });
    assert.ok(account?.id);
    const accountId = account!.id!;
    const base = {
      date: '2026-01-01',
      description: 'Synthetic purchase',
      merchant: 'Synthetic merchant',
      amount: '-10.25',
      category: 'Other',
      kind: 'expense',
      notes: '',
      reference: 'unique',
    };
    await assert.rejects(() => run(b.id, { action: 'transaction.create', accountId, ...base }));
    const imported = await run(a.id, {
      action: 'import.commit',
      accountId,
      hash: 'a'.repeat(64),
      format: 'CSV',
      rows: [base, { ...base, reference: 'second', amount: '-2.25' }],
    });
    assert.equal(imported?.added, 2);
    const duplicate = await run(a.id, {
      action: 'import.commit',
      accountId,
      hash: 'a'.repeat(64),
      format: 'CSV',
      rows: [base],
    });
    assert.equal(duplicate?.added, 0);
    const overlapping = await run(a.id, {
      action: 'import.commit',
      accountId,
      hash: 'b'.repeat(64),
      format: 'CSV',
      rows: [base, { ...base, reference: 'third', amount: '-1' }],
    });
    assert.equal(overlapping?.added, 1);
    assert.equal(overlapping?.duplicates, 1);
    assert.equal((await getData(a.id)).accounts[0].balance, '86.50');
    assert.equal((await getData(b.id)).summary.transactions, 0);
    const all = await transactionPage(a.id, new URLSearchParams());
    const transaction = all.rows[0];
    await assert.rejects(() =>
      run(b.id, {
        action: 'transaction.update',
        id: transaction.id,
        merchant: 'Intruder',
        category: 'Other',
        kind: 'expense',
        notes: '',
        reviewed: true,
      }),
    );
    await assert.rejects(() => run(b.id, { action: 'transaction.delete', id: transaction.id }));
    const before = await db.transaction.count({ where: { workspaceId: a.id } });
    await assert.rejects(
      () =>
        run(a.id, {
          action: 'import.commit',
          accountId,
          hash: 'c'.repeat(64),
          format: 'CSV',
          rows: [
            { ...base, statementBalance: '50' },
            { ...base, reference: 'bad balance', statementBalance: '1' },
          ],
        }),
      /acknowledge/,
    );
    assert.equal(await db.transaction.count({ where: { workspaceId: a.id } }), before);
    assert.equal(
      await db.importBatch.count({ where: { workspaceId: a.id, hash: 'c'.repeat(64) } }),
      0,
    );
    const budget = await run(a.id, {
      action: 'budget.save',
      category: 'Groceries',
      amount: '100',
      month: '2026-01',
    });
    assert.ok(budget);
    const goal = await run(a.id, {
      action: 'goal.create',
      name: 'Synthetic goal',
      target: '500',
      saved: '100',
      dueDate: '2027-01-01',
    });
    await run(a.id, { action: 'goal.contribute', id: goal!.id!, amount: '50' });
    assert.equal((await getData(a.id)).goals[0].saved, '150');
    await assert.rejects(() =>
      run(a.id, { action: 'goal.contribute', id: goal!.id!, amount: '900' }),
    );
    await run(a.id, { action: 'reconcile', accountId, date: '2026-01-05', balance: '95.50' });
    assert.equal((await getData(a.id)).accounts[0].balance, '95.50');
    assert.equal(
      (
        await db.transaction.findFirst({ where: { workspaceId: a.id, kind: 'adjustment' } })
      )?.amount.toString(),
      '9',
    );
    const batch = await db.importBatch.findFirstOrThrow({
      where: { workspaceId: a.id, hash: 'a'.repeat(64) },
    });
    await run(a.id, { action: 'import.undo', id: batch.id });
    assert.equal(await db.transaction.count({ where: { importId: batch.id } }), 0);
    assert.ok((await db.auditEvent.count({ where: { workspaceId: a.id } })) > 5);
    const race = await Promise.all(
      Array.from({ length: 3 }, () =>
        run(a.id, {
          action: 'import.commit',
          accountId,
          hash: 'd'.repeat(64),
          format: 'CSV',
          rows: [{ ...base, reference: 'concurrent', amount: '-0.10' }],
        }),
      ),
    );
    assert.equal(
      race.reduce((sum, r) => sum + (r?.added || 0), 0),
      1,
    );
    assert.equal(
      await db.importBatch.count({ where: { workspaceId: a.id, hash: 'd'.repeat(64) } }),
      1,
    );
    const contributions = await Promise.allSettled([
      run(a.id, { action: 'goal.contribute', id: goal!.id!, amount: '300' }),
      run(a.id, { action: 'goal.contribute', id: goal!.id!, amount: '300' }),
    ]);
    assert.equal(contributions.filter((r) => r.status === 'fulfilled').length, 1);
    assert.equal((await getData(a.id)).goals[0].saved, '450');
    const token = randomUUID();
    await db.session.create({
      data: {
        workspaceId: a.id,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() - 1000),
      },
    });
    await assert.rejects(() => sessionFromToken(token));
    await seedWorkspace(b.id);
    await seedWorkspace(b.id, true);
    assert.equal((await getData(b.id)).accounts.length, 3);
    assert.equal((await getData(a.id)).accounts.length, 1);
  } finally {
    await db.workspace.deleteMany({ where: { id: { in: [a.id, b.id] } } });
    await db.$disconnect();
  }
});
