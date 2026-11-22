import { eq } from 'drizzle-orm';
import { db } from '#lib/server/db/client';
import { companies } from '#lib/server/db/schema';
import type { Reason } from '../reasons';

/** Lista negra a mano: la regla automática ya no la toca. */
export function blockCompany(id: number) {
	const reasons: Reason[] = [{ kind: 'manual', text: 'La bloqueaste a mano', ids: [] }];
	db.update(companies)
		.set({ list: 'negra', listSource: 'manual', listReason: JSON.stringify(reasons), listedAt: new Date().toISOString() })
		.where(eq(companies.id, id))
		.run();
}
