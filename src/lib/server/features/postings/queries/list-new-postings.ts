import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '$lib/server/db/client';
import { companies, postings } from '$lib/server/db/schema';
import { isWithinDays, type ListFilters } from '$lib/filters';
import { matchPosting, type Match } from '$lib/server/features/match/queries/match-posting';

export type NewPosting = {
	id: number;
	platform: string;
	url: string;
	title: string;
	company: string | null;
	companyId: number | null;
	location: string | null;
	modality: string | null;
	publishedAt: string;
	repeatTimes: number;
	repeatFirst: string | null;
	match: Match;
	/** Si la empresa tiene varias vacantes en la lista: cuántas y si esta es la que mejor encaja. */
	sameCompany: { total: number; isBest: boolean } | null;
};

const percent = (m: Match) => (m.score === null ? -1 : Math.round(m.score * 100));

/**
 * La lista principal: vacantes sin marcar de empresas que no están en lista negra. Los filtros
 * se aplican al final para que "la mejor de la empresa" se calcule con todas sus vacantes.
 */
export function listNewPostings(filters: ListFilters = { platform: null, maxAgeDays: null }): NewPosting[] {
	const rows = db
		.select({
			id: postings.id,
			platform: postings.platform,
			url: postings.url,
			title: postings.title,
			company: companies.name,
			companyId: postings.companyId,
			location: postings.location,
			modality: postings.modality,
			publishedAt: postings.publishedAt,
			repeatTimes: postings.repeatTimes,
			repeatFirst: postings.repeatFirst,
			description: postings.description
		})
		.from(postings)
		.leftJoin(companies, eq(companies.id, postings.companyId))
		.where(and(eq(postings.status, 'nueva'), sql`${companies.list} IS NOT 'negra'`))
		.orderBy(desc(postings.publishedAt))
		.all()
		.map(({ description, ...p }) => ({ ...p, match: matchPosting(p.title, description) }))
		// primero las más compatibles (el % que se ve en pantalla), y a igual % la más nueva,
		// sin importar la plataforma; las que no mencionan tecnologías van al final
		.sort((a, b) => percent(b.match) - percent(a.match));

	// Varias vacantes de una misma empresa: se marca la que mejor encaja contigo, salvo que
	// la mejor sea roja (si todas son rojas, ninguna vale la pena).
	const best = new Map<number, { bestId: number; total: number }>();
	for (const [companyId, list] of Map.groupBy(rows, (p) => p.companyId)) {
		if (companyId === null || list.length < 2) continue;
		const top = list.reduce((a, b) => ((b.match.score ?? -1) > (a.match.score ?? -1) ? b : a));
		const worthIt = top.match.level === 'verde' || top.match.level === 'naranja';
		best.set(companyId, { bestId: worthIt ? top.id : -1, total: list.length });
	}

	return rows
		.filter((p) => filters.platform === null || p.platform === filters.platform)
		.filter((p) => filters.maxAgeDays === null || isWithinDays(p.publishedAt, filters.maxAgeDays))
		.map((p) => {
			const b = p.companyId === null ? undefined : best.get(p.companyId);
			return { ...p, sameCompany: b ? { total: b.total, isBest: b.bestId === p.id } : null };
		});
}
