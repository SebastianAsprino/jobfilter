import { count, eq } from 'drizzle-orm';
import { db } from '#lib/server/db/client';
import { postings } from '#lib/server/db/schema';

export function countDiscarded(): number {
	return db.select({ n: count() }).from(postings).where(eq(postings.status, 'descartada')).get()!.n;
}
