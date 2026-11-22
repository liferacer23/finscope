import { PrismaClient } from '@prisma/client';
const globalDB = globalThis as unknown as { finscopeDB?: PrismaClient };
export const db = globalDB.finscopeDB ?? new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalDB.finscopeDB = db;
