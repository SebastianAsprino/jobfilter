import type { HttpClient } from '$lib/server/shared/http';
import { decodeEntities, htmlToText, mentionsTerm, normalizeText, samePlace } from '$lib/server/shared/normalize';
import type { Location } from '$lib/server/shared/profile';
import { parsePublishedDate } from '$lib/server/shared/relative-date';
import type { Modality, PlatformAdapter, RawPosting } from './types';

// Hireline tiene pocas vacantes activas por país (decenas): igual que PeakU, se trae el
// listado completo una vez por búsqueda (HTML renderizado en el servidor, sin login) y se
// filtra acá. El detalle sale del JSON-LD `JobPosting` de cada vacante nueva.
const ORIGIN = 'https://hireline.io';
const COUNTRY_PATH: Record<string, string> = { colombia: 'co', mexico: 'mx' };
const PER_PAGE = 12;
const MAX_PAGES = 5;
// "Remoto: LATAM", "Remoto: México, Colombia"…: regiones que incluyen a cualquier país de la zona
const OPEN_REGIONS = ['latam', 'latinoamerica', 'america latina', 'global', 'mundo', 'cualquier lugar'];

export type Card = RawPosting & { summary: string };

const clean = (html: string) => decodeEntities(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();

export function parseListing(html: string, now = new Date()): Card[] {
	const cards: Card[] = [];
	const re = /<a href="(https:\/\/hireline\.io\/(?:[a-z]{2}|remoto)\/empleos\/[^"]+\/(\d+))" class="hl-vacancy-card[^"]*">([\s\S]*?)<\/a>/g;
	for (const [, url, id, body] of html.matchAll(re)) {
		const field = (cls: string) => clean(body.match(new RegExp(`class="${cls}[^"]*">([\\s\\S]*?)</p>`))?.[1] ?? '');
		// "Desarrollador Full-Stack Senior en Poderjudicialvirtual.com": la empresa va al final
		const fullTitle = field('vacancy-title');
		const at = fullTitle.lastIndexOf(' en ');
		const location = field('vacancy-location');
		const dateText = field('updated-text').replace(/\.$/, '');
		const published = parsePublishedDate(dateText, now);
		const norm = normalizeText(location);
		const modality: Modality = norm.includes('remoto') ? 'remoto' : norm.includes('hibrido') ? 'hibrido' : 'presencial';

		cards.push({
			externalId: id,
			url,
			title: at > 0 ? fullTitle.slice(0, at) : fullTitle,
			company: at > 0 ? fullTitle.slice(at + 4) : null,
			location,
			modality,
			summary: field('vacancy-summary'),
			publishedAt: published?.date ?? now,
			publishedRaw: dateText,
			publishedApprox: !published || published.approximate || undefined
		});
	}
	return cards;
}

/** Remoto abierto a tu país o a una región que lo incluye; presencial/híbrido en tu ciudad. */
function wanted(card: Card, where: Location): boolean {
	const place = card.location ?? '';
	if (card.modality !== 'remoto') return samePlace(place, where.city);
	const zones = normalizeText(place.replace(/^\s*remoto\s*:?/i, ''));
	return !zones || zones.includes(normalizeText(where.country)) || OPEN_REGIONS.some((r) => zones.includes(r));
}

/** Título y empresa por separado, fecha exacta y descripción completa desde el JSON-LD. */
export function parseDetail(html: string): Partial<RawPosting> {
	for (const m of html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) {
		try {
			const data = JSON.parse(m[1]);
			if (data?.['@type'] !== 'JobPosting') continue;
			const detail: Partial<RawPosting> = {};
			if (data.description) detail.description = htmlToText(decodeEntities(data.description));
			if (data.title) detail.title = decodeEntities(data.title).trim();
			if (data.hiringOrganization?.name) detail.company = decodeEntities(data.hiringOrganization.name).trim();
			if (/^\d{4}-\d{2}-\d{2}/.test(data.datePosted ?? '')) {
				detail.publishedAt = new Date(`${data.datePosted.slice(0, 10)}T12:00:00Z`);
				detail.publishedRaw = data.datePosted.slice(0, 10);
				detail.publishedApprox = false;
			}
			return detail;
		} catch {
			// otro JSON-LD mal formado: se ignora
		}
	}
	return {};
}

// el listado completo, una vez por búsqueda (cada búsqueda crea su propio cliente)
const listings = new WeakMap<HttpClient, Promise<Card[]>>();
function allCards(client: HttpClient, country: string): Promise<Card[]> {
	if (!listings.has(client)) {
		listings.set(
			client,
			(async () => {
				const cards = new Map<string, Card>();
				for (let page = 1; page <= MAX_PAGES; page++) {
					const url = `${ORIGIN}/${country}/empleos?k=&l=&jk=&sal=&jd=${page > 1 ? `&page=${page}` : ''}`;
					const batch = parseListing(await client.text(url));
					const fresh = batch.filter((c) => !cards.has(c.externalId));
					for (const c of fresh) cards.set(c.externalId, c);
					// página corta, o una que repite lo ya visto (si el sitio ignorara `page`): fin
					if (batch.length < PER_PAGE || !fresh.length) break;
				}
				return [...cards.values()];
			})()
		);
	}
	return listings.get(client)!;
}

export const hireline: PlatformAdapter = {
	id: 'hireline',
	name: 'Hireline',
	delay: { min: 3_000, max: 7_000 },
	// el filtro por palabra clave lo hace el adapter con el título y el resumen; con la
	// descripción completa, la búsqueda lo vuelve a comprobar
	looseSearch: true,

	async *search(term, { client, since, location }) {
		const country = COUNTRY_PATH[normalizeText(location.country)];
		if (!country) return; // Hireline tiene sitio para Colombia y México
		for (const card of await allCards(client, country)) {
			if (card.publishedAt < since || !wanted(card, location)) continue;
			if (!mentionsTerm(`${card.title}\n${card.summary}`, term)) continue;
			const { summary, ...posting } = card;
			yield { ...posting, description: summary || undefined };
		}
	},

	async fetchDetail(posting, { client }) {
		return parseDetail(await client.text(posting.url));
	}
};
