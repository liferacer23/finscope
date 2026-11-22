import { Prisma } from '@prisma/client';
import { db } from './db';
export const currentMonth = () => new Date().toISOString().slice(0, 7);
export async function seedWorkspace(workspaceId: string, reset = false) {
  await db.$transaction(
    async (tx) => {
      if (reset) {
        await tx.transaction.deleteMany({ where: { workspaceId } });
        await tx.importBatch.deleteMany({ where: { workspaceId } });
        await tx.account.deleteMany({ where: { workspaceId } });
        await tx.budget.deleteMany({ where: { workspaceId } });
        await tx.goal.deleteMany({ where: { workspaceId } });
        await tx.exchangeRate.deleteMany({ where: { workspaceId } });
        await tx.auditEvent.deleteMany({ where: { workspaceId } });
      }
      const usd = await tx.account.create({
        data: {
          workspaceId,
          name: 'Everyday checking',
          institution: 'Meridian Bank',
          currency: 'USD',
          kind: 'checking',
          openingBalance: '8400',
        },
      });
      const eur = await tx.account.create({
        data: {
          workspaceId,
          name: 'European reserve',
          institution: 'Atlas',
          currency: 'EUR',
          kind: 'savings',
          openingBalance: '9200',
        },
      });
      const savings = await tx.account.create({
        data: {
          workspaceId,
          name: 'Long-term savings',
          institution: 'Meridian Bank',
          currency: 'USD',
          kind: 'savings',
          openingBalance: '18500',
        },
      });
      await tx.exchangeRate.create({
        data: {
          workspaceId,
          from: 'EUR',
          to: 'USD',
          date: new Date(Date.UTC(new Date().getUTCFullYear() - 1, 0, 1)),
          rate: '1.08',
          source: 'Synthetic demo assumption · not a live rate',
        },
      });
      const records: Prisma.TransactionCreateManyInput[] = [];
      const now = new Date();
      for (let ago = 5; ago >= 0; ago--) {
        const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - ago, 1));
        const m = start.toISOString().slice(0, 7);
        const add = (
          day: number,
          description: string,
          amount: string,
          category: string,
          kind: string = 'expense',
        ) => {
          const date = new Date(`${m}-${String(day).padStart(2, '0')}T00:00:00Z`);
          if (date > now) return;
          records.push({
            workspaceId,
            accountId: usd.id,
            date,
            description,
            merchant: description,
            amount,
            category,
            kind,
            reviewed: true,
            fingerprint: `seed-${ago}-${records.length}`,
          });
        };
        add(1, 'Northstar Design Co.', '7800', 'Income', 'income');
        add(2, 'City House', '-1680', 'Housing');
        add(3, 'Figma Professional', '-15', 'Subscriptions');
        add(4, 'Spotify', '-11.99', 'Subscriptions');
        add(5, 'Fiber Internet', '-65', 'Utilities');
        add(6, 'Acme Insurance', '-145', 'Health');
        for (let day = 7; day <= 27; day += 3) {
          add(day, 'Whole Basket', String(-(64 + ((day * 7 + ago * 13) % 90))), 'Groceries');
          add(day, 'Daybreak Coffee', String(-(9 + ((day + ago) % 17))), 'Food & dining');
          add(day, 'Metro Transit', String(-(5 + ((day * 3) % 12))), 'Transport');
        }
        add(12, 'Paper & Object', String(-85 - ago * 12), 'Shopping');
        add(16, 'Independent project', '650', 'Income', 'income');
        add(18, 'Monthly savings transfer', '-600', 'Transfers', 'transfer');
        records.push({
          workspaceId,
          accountId: savings.id,
          date: new Date(`${m}-18T00:00:00Z`),
          description: 'Monthly savings transfer',
          merchant: 'Own savings',
          amount: '600',
          category: 'Transfers',
          kind: 'transfer',
          reviewed: true,
          fingerprint: `savings-${ago}`,
        });
        if (ago === 1) add(20, 'Weekend in Lisbon', '-640', 'Travel');
      }
      await tx.transaction.createMany({
        data: records.filter((t) => new Date(t.date as Date) <= now),
      });
      await tx.budget.createMany({
        data: [
          { workspaceId, category: 'Groceries', amount: '550', month: currentMonth() },
          { workspaceId, category: 'Food & dining', amount: '220', month: currentMonth() },
          { workspaceId, category: 'Shopping', amount: '180', month: currentMonth() },
          { workspaceId, category: 'Travel', amount: '400', month: currentMonth() },
        ],
      });
      await tx.goal.createMany({
        data: [
          {
            workspaceId,
            name: 'The six-month cushion',
            target: '30000',
            saved: '18500',
            dueDate: new Date(Date.UTC(now.getUTCFullYear() + 1, 5, 1)),
          },
          {
            workspaceId,
            name: 'Japan, at a slower pace',
            target: '6000',
            saved: '2400',
            dueDate: new Date(Date.UTC(now.getUTCFullYear() + 1, 9, 1)),
          },
        ],
      });
      await tx.auditEvent.create({
        data: {
          workspaceId,
          action: reset ? 'demo.reset' : 'demo.created',
          entityId: workspaceId,
          detail: 'Synthetic demo data; no bank connection or personal records.',
        },
      });
      return eur.id;
    },
    { timeout: 15000 },
  );
}
