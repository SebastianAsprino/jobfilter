import type { HttpClient } from '#lib/server/shared/http';
import { decodeEntities, htmlToText, normalizeText, samePlace } from '#lib/server/shared/normalize';
import type { Location } from '#lib/server/shared/profile';
import type { Modality, PlatformAdapter, RawPosting } from './types';

// elempleo.com (solo Colombia). La página de ofertas trae un token antifalsificación y la
// lista de ciudades con su id; con eso se llama a la API JSON que usa el mismo sitio para
// paginar. Sin login: el token y la cookie son de la sesión anónima.
const ORIGIN = 'https://www.elempleo.com';
const LANDING = `${ORIGIN}/co/ofertas-empleo/`;
const SEARCH = `${ORIGIN}/co/api/joboffers/findbyfilter`;
const PAGE_SIZE = 100;
const MAX_PAGES = 5;
const DAY = 86_400_000;
const REMOTE = 101; // workModality
// publishDate: 1 = hoy y ayer, 2 = una semana, 3 = dos semanas, 4 = un mes
const PUBLISH_DATE_STEPS: [days: number, id: number][] = [
	[2, 1],
	[7, 2],
	[14, 3],
	[30, 4]
];

type Session = { token: string; cityIds: Map<string, number> };

export type Offer = {
	id: number;
	title: string;
	companyName: string | null;
	notConfidential: boolean;
	city: string | null;
	idworkmodalitytxt: string | null;
	description: string | null;
	publishDate: string;
	publishDateInfo: string | null;
	jobOfferUrl: string;
	jobOfferDetail?: { jobOfferData?: { title?: string } };
};

type SearchResponse = { results: Offer[]; paginationInfo: { totalPages: number } };

/** Token y ciudades desde la página de ofertas. */
export function parseLanding(html: string): Session {
	const tokenBlock = html.slice(html.indexOf('js-search-api-token'));
	const token = tokenBlock.match(/name="__RequestVerificationToken"[^>]*value="([^"]+)"/)?.[1];
	if (!token) throw new Error('elempleo: no se encontró el token de búsqueda');

	const raw = html.match(/data-cities-val="([^"]+)"/)?.[1];
	const cities: { id: string; name: string }[] = raw ? JSON.parse(decodeEntities(raw)) : [];
	return { token, cityIds: new Map(cities.map((c) => [normalizeText(c.name), Number(c.id)])) };
}

const MODALITY: Record<string, Modality> = { remoto: 'remoto', hibrido: 'hibrido', presencial: 'presencial' };

export function toPosting(offer: Offer): RawPosting {
	const url = new URL(offer.jobOfferUrl, ORIGIN);
	url.search = '';
	const day = offer.publishDate.slice(0, 10);
	return {
		externalId: String(offer.id),
		url: url.href,
		// `title` viene en minúsculas; el original está en el detalle
		title: decodeEntities(offer.jobOfferDetail?.jobOfferData?.title ?? offer.title).trim(),
		company: offer.notConfidential && offer.companyName ? offer.companyName.trim() : null,
		recruiter: offer.notConfidential ? undefined : (offer.companyName ?? undefined),
		location: offer.city ?? undefined,
		modality: MODALITY[normalizeText(offer.idworkmodalitytxt ?? '')],
		description: offer.description ? htmlToText(offer.description) : undefined,
		publishedAt: new Date(`${day}T12:00:00Z`),
		publishedRaw: offer.publishDateInfo ?? day
	};
}

function wanted(p: RawPosting, where: Location): boolean {
	return p.modality === 'remoto' || samePlace(p.location ?? '', where.city);
}

/** El filtro de fecha más chico que cubra desde `since`; sin filtro si son más de 30 días. */
function publishDateFilter(since: Date): number {
	const days = Math.ceil((Date.now() - since.getTime()) / DAY);
	return PUBLISH_DATE_STEPS.find(([max]) => days <= max)?.[1] ?? 0;
}

// una sesión por búsqueda (cada búsqueda crea su propio cliente)
const sessions = new WeakMap<HttpClient, Promise<Session>>();
function session(client: HttpClient): Promise<Session> {
	if (!sessions.has(client)) sessions.set(client, client.text(LANDING).then(parseLanding));
	return sessions.get(client)!;
}

export const elempleo: PlatformAdapter = {
	id: 'elempleo',
	name: 'elempleo',
	delay: { min: 3_000, max: 7_000 },
	// busca por palabras sueltas: "desarrollador fullstack" trae también "desarrollador" a secas
	looseSearch: true,

	async *search(term, { client, since, location }) {
		if (normalizeText(location.country) !== 'colombia') return; // el sitio es solo de Colombia

		const { token, cityIds } = await session(client);
		const cityId = cityIds.get(normalizeText(location.city));
		const filters = [{ workModality: REMOTE, cities: [] as number[] }];
		if (cityId) filters.push({ workModality: 0, cities: [cityId] });

		for (const filter of filters) {
			for (let page = 1; page <= MAX_PAGES; page++) {
				const res = await client.json<SearchResponse>(SEARCH, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json; charset=utf-8',
						__RequestVerificationToken: token,
						Referer: LANDING
					},
					body: JSON.stringify({
						...filter,
						query: term,
						publishDate: publishDateFilter(since),
						pageIndex: page,
						pageSize: PAGE_SIZE,
						sortExpression: 'PublishDate_Desc',
						jobOfferId: 0,
						salaryInfo: [],
						contractType: 0,
						sector: 0,
						industry: 0,
						positionLevel: 0,
						area: 0,
						countryId: 0,
						departmentId: 0,
						companyId: 0,
						requiredexperience: 0
					})
				});

				// vienen de la más nueva a la más vieja: se corta al pasar `since`
				let reachedOld = false;
				for (const offer of res.results) {
					const posting = toPosting(offer);
					if (posting.publishedAt < since) {
						reachedOld = true;
						continue;
					}
					if (wanted(posting, location)) yield posting;
				}
				if (reachedOld || page >= res.paginationInfo.totalPages) break;
			}
		}
	}
};
