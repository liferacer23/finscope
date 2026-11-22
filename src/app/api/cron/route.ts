import { timingSafeEqual } from 'node:crypto';
import { db } from '@/lib/db';
import { json } from '@/lib/http';
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const supplied = req.headers.get('authorization') || '';
  const expected = `Bearer ${secret}`;
  if (
    !secret ||
    Buffer.byteLength(supplied) !== Buffer.byteLength(expected) ||
    !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))
  )
    return json({ error: 'Unauthorized' }, 401);
  const now = new Date();
  const result = await db.$transaction([
    db.workspace.deleteMany({ where: { demo: true, expiresAt: { lt: now } } }),
    db.session.deleteMany({ where: { expiresAt: { lt: now } } }),
    db.rateLimit.deleteMany({ where: { expiresAt: { lt: now } } }),
  ]);
  return json({ expiredWorkspaces: result[0].count });
}
