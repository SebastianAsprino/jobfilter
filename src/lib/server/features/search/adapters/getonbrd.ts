import { htmlToText, normalizeText, samePlace } from '#lib/server/shared/normalize';
import type { Location } from '#lib/server/shared/profile';
import type { Modality, PlatformAdapter, RawPosting } from './types';

// API pública: https://www.getonbrd.com/api/v0/search/jobs (sin login).
// Devuelve las vacantes de la más nueva a la más vieja.
const API = 'https://www.getonbrd.com/api/v0/search/jobs';
const EXPAND = encodeURIComponent(JSON.stringify(['company', 'location_cities', 'location_tenants']));
const PER_PAGE = 100;
const MAX_PAGES = 10;

type Named = { data: { attributes?: { name: string } }[] };

type Job = {
	id: string;
	attributes: {
		title: string;
		description: string | null;
		projects: string | null;
		functions: string | null;
		remote_modality: string;
		lang: string;
		published_at: number;
		countries: string[];
		location_cities: Named;
		location_tenants: Named;
		company: { data: { attributes?: { name: string } } };
	};
	links: { public_url: string };
};

type Response = { data: Job[]; meta: { page: number; total_pages: number } };

const names = (list: Named) => list.data.map((d) => d.attributes?.name).filter((n): n is string => !!n);

function modalityOf(remoteModality: string): Modality {
	if (remoteModality.includes('remote') && remoteModality !== 'no_remote') return 'remoto';
	return remoteModality === 'hybrid' ? 'hibrido' : 'presencial';
}

/** Idiomas aceptados; remoto que acepte tu país, o presencial/híbrido en tu ciudad. */
function toPosting(job: Job, where: Location): RawPosting | null {
	const a = job.attributes;
	// lang: 'es' | 'en' | 'lang_not_specified'
	if (/^[a-z]{2}$/.test(a.lang) && !where.languages.includes(a.lang)) return null;

	const modality = modalityOf(a.remote_modality);
	let location: string;
	if (modality === 'remoto') {
		// remote_local = remoto solo para ciertos países; sin países listados no sabemos, se deja pasar
		const countries = names(a.location_tenants);
		if (
			a.remote_modality === 'remote_local' &&
			countries.length &&
			!countries.some((c) => normalizeText(c) === normalizeText(where.country))
		) {
			return null;
		}
		location = countries.length ? `Remoto (${countries.join(', ')})` : 'Remoto';
	} else {
		const cities = names(a.location_cities);
		if (!cities.some((c) => samePlace(c, where.city))) return null;
		location = cities.join(', ');
	}

	const publishedAt = new Date(a.published_at * 1000);
	return {
		externalId: job.id,
		url: job.links.public_url,
		title: a.title,
		company: a.company.data.attributes?.name ?? null,
		location,
		modality,
		description: [a.projects, a.functions, a.description]
			.filter((s): s is string => !!s)
			.map(htmlToText)
			.join('\n\n'),
		publishedAt,
		publishedRaw: String(a.published_at)
	};
}

export const getonbrd: PlatformAdapter = {
	id: 'getonbrd',
	name: 'GetOnBoard',
	delay: { min: 1_500, max: 3_500 },

	async *search(term, { client, since, location }) {
		for (let page = 1; page <= MAX_PAGES; page++) {
			const url = `${API}?query=${encodeURIComponent(term)}&per_page=${PER_PAGE}&page=${page}&expand=${EXPAND}`;
			const res = await client.json<Response>(url);

			let reachedOld = false;
			for (const job of res.data) {
				if (job.attributes.published_at * 1000 < since.getTime()) {
					reachedOld = true;
					continue;
				}
				const posting = toPosting(job, location);
				if (posting) yield posting;
			}
			if (reachedOld || page >= res.meta.total_pages) return;
		}
	}
};
