import { and, eq } from 'drizzle-orm';
import { db } from '#lib/server/db/client';
import { postings } from '#lib/server/db/schema';
import { recalculateBlacklist } from '#lib/server/features/companies/commands/recalculate-blacklist';

/** Vuelve a la lista; si ese descarte había mandado a la empresa a la lista negra, sale de ahí. */
export function retakePosting(id: number) {
	db.update(postings)
		.set({ status: 'nueva', statusAt: null })
		.where(and(eq(postings.id, id), eq(postings.status, 'descartada')))
		.run();
	recalculateBlacklist();
}
