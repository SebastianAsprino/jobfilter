import { eq } from 'drizzle-orm';
import { db } from '#lib/server/db/client';
import { companies } from '#lib/server/db/schema';

/** Lista blanca: nunca cae en la lista negra automática. */
export function whitelistCompany(id: number) {
	db.update(companies)
		.set({ list: 'blanca', listSource: 'manual', listedAt: new Date().toISOString() })
		.where(eq(companies.id, id))
		.run();
}
