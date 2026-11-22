import { eq } from 'drizzle-orm';
import { db } from '#lib/server/db/client';
import { postings } from '#lib/server/db/schema';
import { recalculateBlacklist } from '#lib/server/features/companies/commands/recalculate-blacklist';

/** Sale de la lista; si es la misma que otra de la empresa, suma al conteo de la lista negra. */
export function discardPosting(id: number) {
	db.update(postings).set({ status: 'descartada', statusAt: new Date().toISOString() }).where(eq(postings.id, id)).run();
	recalculateBlacklist();
}
