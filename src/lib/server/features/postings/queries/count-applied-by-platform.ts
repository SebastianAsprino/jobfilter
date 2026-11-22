import { count, eq } from 'drizzle-orm';
import { db } from '$lib/server/db/client';
import { postings } from '$lib/server/db/schema';

/** Cuántas vacantes aplicadas hay en cada plataforma, para armar el filtro de Aplicadas. */
export function countAppliedByPlatform(): { platform: string; total: number }[] {
	return db
		.select({ platform: postings.platform, total: count() })
		.from(postings)
		.where(eq(postings.status, 'aplicada'))
		.groupBy(postings.platform)
		.orderBy(postings.platform)
		.all();
}
