import { eq } from 'drizzle-orm';
import { db } from '#lib/server/db/client';
import { companies } from '#lib/server/db/schema';
import { recalculateBlacklist } from './recalculate-blacklist';

/** Sale de cualquier lista (blanca o bloqueo a mano) y se vuelve a evaluar con la regla automática. */
export function unlistCompany(id: number) {
	db.update(companies)
		.set({ list: null, listSource: null, listReason: null, listedAt: null })
		.where(eq(companies.id, id))
		.run();
	recalculateBlacklist();
}
