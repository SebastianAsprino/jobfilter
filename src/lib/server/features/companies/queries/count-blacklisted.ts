import { count, eq } from 'drizzle-orm';
import { db } from '#lib/server/db/client';
import { companies } from '#lib/server/db/schema';

export function countBlacklisted(): number {
	return db.select({ n: count() }).from(companies).where(eq(companies.list, 'negra')).get()!.n;
}
