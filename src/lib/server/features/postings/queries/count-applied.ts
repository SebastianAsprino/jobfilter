import { count, eq } from 'drizzle-orm';
import { db } from '$lib/server/db/client';
import { postings } from '$lib/server/db/schema';

export function countApplied(): number {
	return db.select({ n: count() }).from(postings).where(eq(postings.status, 'aplicada')).get()!.n;
}
