import type { HttpClient } from '#lib/server/shared/http';
import { decodeEntities, htmlToText, mentionsTerm, normalizeText, samePlace } from '#lib/server/shared/normalize';
import type { Location } from '#lib/server/shared/profile';
import type { Modality, PlatformAdapter, RawPosting } from './types';

// PeakU tiene pocas vacantes activas (decenas): en vez de una búsqueda por palabra clave se
// trae el listado completo una vez por búsqueda y se filtra acá. El listado viene de la API
// pública que usa su sitio (sin login); la descripción, del JSON-LD de cada vacante.
const API = 'https://api.peaku.co/api-v2/get-active-jobs';
const JOB_PAGE = 'https://peaku.co/es/empleos';
const STEP = 100;
const MAX_PAGES = 5;

export type Job = {
	url: string;
	title: string;
	created_at: string;
	last_activated_at: string | null;
	company: { name: string; confidential: boolean };
	city: { name: string } | null;
	all_countries: { name: string }[];
	location_type: { code: string; generic_code: string };
	main_skills: { name: string }[];
};

// generic_code: R = remoto (RA en cualquier lugar, RC en el país), H = híbrido, OS = presencial
const MODALITY: Record<string, Modality> = { R: 'remoto', H: 'hibrido', OS: 'presencial' };

export function toPosting(job: Job): RawPosting {
	const published = job.last_activated_at ?? job.created_at;
	return {
		externalId: job.url.split('-')[0],
		url: `${JOB_PAGE}/${job.url}`,
		title: decodeEntities(job.title).trim(),
		company: job.company.confidential ? null : job.company.name.trim(),
		location: job.city?.name === 'Remote' ? 'Remoto' : job.city?.name,
		modality: MODALITY[job.location_type.generic_code],
		// "fecha de activación": si la empresa reactiva la vacante, cuenta como republicación
		publishedAt: new Date(`${published.slice(0, 10)}T12:00:00Z`),
		publishedRaw: published.slice(0, 10)
	};
}

/** Remoto en cualquier lugar o en tu país; presencial/híbrido en tu ciudad. */
function wanted(job: Job, where: Location): boolean {
	const code = job.location_type.code;
	if (code === 'RA') return true;
	// remoto en el país: si no lista países no se sabe cuál, se deja pasar
	if (code === 'RC') {
		const countries = job.all_countries.map((c) => normalizeText(c.name));
		return !countries.length || countries.includes(normalizeText(where.country));
	}
	return samePlace(job.city?.name ?? '', where.city);
}

/** Descripción completa desde el JSON-LD `JobPosting` de la página de la vacante. */
export function parseDetail(html: string): Partial<RawPosting> {
	for (const m of html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) {
		try {
			const data = JSON.parse(m[1]);
			if (data?.['@type'] === 'JobPosting' && data.description) {
				// el HTML viene escapado como entidades (&lt;h2&gt;): primero se decodifica
				return { description: htmlToText(decodeEntities(data.description)) };
			}
		} catch {
			// otro JSON-LD mal formado: se ignora
		}
	}
	return {};
}

// el listado completo, una vez por búsqueda (cada búsqueda crea su propio cliente)
const listings = new WeakMap<HttpClient, Promise<Job[]>>();
function allJobs(client: HttpClient): Promise<Job[]> {
	if (!listings.has(client)) {
		listings.set(
			client,
			(async () => {
				const jobs: Job[] = [];
				for (let page = 0; page < MAX_PAGES; page++) {
					const batch = await client.json<Job[]>(`${API}?start=${page * STEP}&step=${STEP}`, {
						headers: { Accept: 'application/json', Referer: `${JOB_PAGE}` }
					});
					jobs.push(...batch);
					if (batch.length < STEP) break;
				}
				return jobs;
			})()
		);
	}
	return listings.get(client)!;
}

export const peaku: PlatformAdapter = {
	id: 'peaku',
	name: 'PeakU',
	delay: { min: 3_000, max: 7_000 },
	// el filtro por palabra clave lo hace el adapter con el título y las habilidades; con la
	// descripción, la búsqueda lo vuelve a comprobar
	looseSearch: true,

	async *search(term, { client, since, location }) {
		for (const job of await allJobs(client)) {
			const posting = toPosting(job);
			if (posting.publishedAt < since || !wanted(job, location)) continue;
			const skills = job.main_skills.map((s) => s.name).join(', ');
			if (mentionsTerm(`${posting.title}\n${skills}`, term)) yield posting;
		}
	},

	async fetchDetail(posting, { client }) {
		return parseDetail(await client.text(posting.url));
	}
};
