import { and, count, eq, sql } from 'drizzle-orm';
import { db } from '$lib/server/db/client';
import { companies, postings } from '$lib/server/db/schema';

/** Cuántas vacantes por revisar hay en cada plataforma, para armar el filtro por plataforma. */
export function countNewByPlatform(): { platform: string; total: number }[] {
	return db
		.select({ platform: postings.platform, total: count() })
		.from(postings)
		.leftJoin(companies, eq(companies.id, postings.companyId))
		.where(and(eq(postings.status, 'nueva'), sql`${companies.list} IS NOT 'negra'`))
		.groupBy(postings.platform)
		.orderBy(postings.platform)
		.all();
}
