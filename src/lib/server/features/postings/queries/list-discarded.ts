import { desc, eq } from 'drizzle-orm';
import { db } from '#lib/server/db/client';
import { companies, postings } from '#lib/server/db/schema';
import { parseReasons } from '#lib/server/features/companies/reasons';

export type DiscardedPosting = {
	id: number;
	platform: string;
	url: string;
	title: string;
	company: string | null;
	publishedAt: string;
	statusAt: string | null;
	/** Si este descarte mandó a la empresa a la lista negra. */
	blacklisted: boolean;
};

export function listDiscarded(): DiscardedPosting[] {
	return db
		.select({
			id: postings.id,
			platform: postings.platform,
			url: postings.url,
			title: postings.title,
			company: companies.name,
			publishedAt: postings.publishedAt,
			statusAt: postings.statusAt,
			list: companies.list,
			listReason: companies.listReason
		})
		.from(postings)
		.leftJoin(companies, eq(companies.id, postings.companyId))
		.where(eq(postings.status, 'descartada'))
		.orderBy(desc(postings.statusAt))
		.all()
		.map(({ list, listReason, ...p }) => ({
			...p,
			blacklisted: list === 'negra' && parseReasons(listReason).some((r) => r.kind === 'descarte' && r.ids.includes(p.id))
		}));
}
