import type { HttpClient } from '#lib/server/shared/http';
import { htmlToText, normalizeText } from '#lib/server/shared/normalize';
import type { Modality, PlatformAdapter, RawPosting } from './types';

// Magneto365 (Colombia). Las páginas de búsqueda se renderizan en el servidor y suelen dar 504,
// pero el sitio llama a una API pública (sin login) que trae cada vacante completa, con la
// descripción, así que no hace falta pedir el detalle.
const ORIGIN = 'https://www.magneto365.com/co';
const API = 'https://api.magneto365.com/jobs/v1/public';
const PAGE_SIZE = 30; // el único tamaño que acepta además de 20
const MAX_PAGES = 5;
const COLOMBIA = 47;

export type Job = {
	id: number;
	title: string;
	jobSlug: string;
	cities: string[];
	description: string | null;
	companyName: string | null;
	confidential: boolean;
	publishDate: string;
	/** true para remoto y para híbrido */
	isRemote: boolean;
};

type SearchResponse = { totalRows: number; rows: Job[] };
type Place = { id: string; label: string; type: string };

/** Id de la ciudad ("CT17028") según el autocompletado de ubicaciones del sitio. */
export function cityId(places: Place[], city: string): string | null {
	const wanted = normalizeText(city);
	const found = places.find((p) => p.type === 'CITY' && normalizeText(p.label.split(',')[0]) === wanted);
	return found?.id ?? null;
}

/**
 * La búsqueda por modalidad decide si es remota; en la de la ciudad `isRemote` distingue
 * híbrido de presencial.
 */
export function toPosting(job: Job, remote: boolean): RawPosting {
	const modality: Modality = remote ? 'remoto' : job.isRemote ? 'hibrido' : 'presencial';
	return {
		externalId: String(job.id),
		url: `${ORIGIN}/empleos/${job.jobSlug}`,
		// algunas agencias le agregan su código interno al título: "Desarrollador/a PHP 1626256994-158"
		title: job.title.replace(/\s+\d{6,}-\d+$/, '').trim(),
		company: job.confidential || !job.companyName ? null : job.companyName.trim(),
		location: job.cities.join(', ') || undefined,
		modality,
		description: job.description ? htmlToText(job.description) : undefined,
		publishedAt: new Date(job.publishDate),
		publishedRaw: job.publishDate
	};
}

function searchUrl(term: string, page: number, filters: Record<string, string[]>): string {
	const params = new URLSearchParams({
		device: 'desktop',
		'paginator[page]': String(page),
		'paginator[pageSize]': String(PAGE_SIZE),
		'order[field]': 'publish_date',
		'order[order]': 'DESC',
		'queries[0][field]': 'all',
		'queries[0][term]': term
	});
	for (const [name, values] of Object.entries(filters)) {
		values.forEach((v, i) => params.set(`filters[${name}][${i}]`, v));
	}
	return `${API}/jobs/search?${params}`;
}

// la ciudad se busca una vez por búsqueda (cada búsqueda crea su propio cliente)
const cities = new WeakMap<HttpClient, Promise<string | null>>();
function city(client: HttpClient, name: string): Promise<string | null> {
	if (!cities.has(client)) {
		const url = `${API}/locations?${new URLSearchParams({ term: name, country_id: String(COLOMBIA) })}`;
		cities.set(client, client.json<Place[]>(url).then((places) => cityId(places, name)));
	}
	return cities.get(client)!;
}

export const magneto: PlatformAdapter = {
	id: 'magneto',
	name: 'Magneto365',
	delay: { min: 3_000, max: 7_000 },
	// busca también en la descripción: "desarrollador" trae "desarrollo de negocios"
	looseSearch: true,

	async *search(term, { client, since, location }) {
		if (normalizeText(location.country) !== 'colombia') return; // el sitio es solo de Colombia

		const searches = [{ remote: true, filters: { locations: [`C${COLOMBIA}`], work_modality: ['remote'] } }];
		const cityLocation = await city(client, location.city);
		if (cityLocation) {
			searches.push({ remote: false, filters: { locations: [cityLocation], work_modality: ['hybrid', 'onSite'] } });
		}

		for (const { remote, filters } of searches) {
			for (let page = 1; page <= MAX_PAGES; page++) {
				const res = await client.json<SearchResponse>(searchUrl(term, page, filters));

				// vienen de la más nueva a la más vieja: se corta al pasar `since`
				let reachedOld = false;
				for (const job of res.rows) {
					const posting = toPosting(job, remote);
					if (posting.publishedAt < since) {
						reachedOld = true;
						break;
					}
					yield posting;
				}
				if (reachedOld || page * PAGE_SIZE >= res.totalRows) break;
			}
		}
	}
};
