import { desc, eq } from 'drizzle-orm';
import { db } from '$lib/server/db/client';
import { companies, postings } from '$lib/server/db/schema';
import { isWithinDays, type AppliedFilters } from '$lib/filters';
import { matchPosting, type Match } from '$lib/server/features/match/queries/match-posting';
import { normalizeText } from '$lib/server/shared/normalize';

export type AppliedPosting = {
	id: number;
	platform: string;
	url: string;
	title: string;
	company: string | null;
	location: string | null;
	modality: string | null;
	publishedAt: string;
	statusAt: string | null;
	match: Match;
};

/**
 * Vacantes a las que aplicaste, de la más reciente a la más vieja. El texto se busca en el
 * título, la empresa, la ubicación y la descripción, sin tildes y con todas las palabras.
 */
export function listApplied(
	filters: AppliedFilters = { platform: null, maxAgeDays: null, text: null }
): AppliedPosting[] {
	const words = filters.text ? normalizeText(filters.text).split(/\s+/).filter(Boolean) : [];

	return db
		.select({
			id: postings.id,
			platform: postings.platform,
			url: postings.url,
			title: postings.title,
			company: companies.name,
			location: postings.location,
			modality: postings.modality,
			publishedAt: postings.publishedAt,
			statusAt: postings.statusAt,
			description: postings.description
		})
		.from(postings)
		.leftJoin(companies, eq(companies.id, postings.companyId))
		.where(eq(postings.status, 'aplicada'))
		.orderBy(desc(postings.statusAt))
		.all()
		.filter((p) => filters.platform === null || p.platform === filters.platform)
		.filter((p) => filters.maxAgeDays === null || (p.statusAt !== null && isWithinDays(p.statusAt, filters.maxAgeDays)))
		.filter((p) => {
			if (!words.length) return true;
			const haystack = normalizeText([p.title, p.company, p.location, p.description].join(' '));
			return words.every((w) => haystack.includes(w));
		})
		.map(({ description, ...p }) => ({ ...p, match: matchPosting(p.title, description) }));
}
