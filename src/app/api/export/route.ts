import { requireSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { safeCsvCell } from '@/lib/finance';
import { failure } from '@/lib/http';
export async function GET() {
  try {
    const session = await requireSession();
    const rows = await db.transaction.findMany({
      where: { workspaceId: session.workspaceId },
      include: { account: true },
      orderBy: [{ date: 'asc' }, { id: 'asc' }],
      take: 50001,
    });
    if (rows.length > 50000)
      return Response.json(
        { error: 'Export limited to 50,000 rows. Contact the owner for a database export.' },
        { status: 413 },
      );
    const csv = [
      [
        'Date',
        'Account',
        'Description',
        'Merchant',
        'Amount',
        'Currency',
        'Category',
        'Kind',
        'Notes',
      ]
        .map(safeCsvCell)
        .join(','),
      ...rows.map((t) =>
        [
          t.date.toISOString().slice(0, 10),
          t.account.name,
          t.description,
          t.merchant,
          t.amount.toString(),
          t.account.currency,
          t.category,
          t.kind,
          t.notes,
        ]
          .map(safeCsvCell)
          .join(','),
      ),
    ].join('\r\n');
    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="finscope-transactions.csv"',
        'Cache-Control': 'no-store',
      },
    });
  } catch (e) {
    return failure(e);
  }
}
