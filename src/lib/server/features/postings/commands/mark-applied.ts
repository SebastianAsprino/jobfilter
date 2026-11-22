import { eq } from 'drizzle-orm';
import { db } from '#lib/server/db/client';
import { postings } from '#lib/server/db/schema';

export function markApplied(id: number) {
	db.update(postings).set({ status: 'aplicada', statusAt: new Date().toISOString() }).where(eq(postings.id, id)).run();
}
