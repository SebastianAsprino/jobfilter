import { desc, eq, max, sql } from 'drizzle-orm';
import { db } from '#lib/server/db/client';
import { companies, postings, publications } from '#lib/server/db/schema';
import { parseReasons, type Reason } from '../reasons';

export type ListedCompany = {
	id: number;
	name: string;
	reasons: Reason[];
	listSource: 'auto' | 'manual' | null;
	listedAt: string | null;
	postings: {
		id: number;
		platform: string;
		url: string;
		title: string;
		status: string;
		/** Fechas de publicación separadas por coma. */
		published: string;
	}[];
};

export function listCompanies(list: 'negra' | 'blanca'): ListedCompany[] {
	const rows = db
		.select({
			id: companies.id,
			name: companies.name,
			listReason: companies.listReason,
			listSource: companies.listSource,
			listedAt: companies.listedAt
		})
		.from(companies)
		.where(eq(companies.list, list))
		.orderBy(desc(companies.listedAt))
		.all();

	return rows.map(({ listReason, ...c }) => ({
		...c,
		reasons: parseReasons(listReason),
		postings: db
			.select({
				id: postings.id,
				platform: postings.platform,
				url: postings.url,
				title: postings.title,
				status: postings.status,
				published: sql<string>`group_concat(substr(${publications.publishedAt}, 1, 10), ', ')`
			})
			.from(postings)
			.innerJoin(publications, eq(publications.postingId, postings.id))
			.where(eq(postings.companyId, c.id))
			.groupBy(postings.id)
			.orderBy(desc(max(publications.publishedAt)))
			.all()
	}));
}
