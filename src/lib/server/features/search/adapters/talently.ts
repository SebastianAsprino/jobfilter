import type { HttpClient } from '#lib/server/shared/http';
import { decodeEntities, mentionsTerm, normalizeText, samePlace } from '#lib/server/shared/normalize';
import type { Location } from '#lib/server/shared/profile';
import type { Modality, PlatformAdapter, RawPosting } from './types';

// Talently tiene pocas vacantes activas (decenas): en vez de una búsqueda por palabra clave se
// trae el listado completo una vez por búsqueda (una sola petición) y se filtra acá. El
// listado viene de la API pública que usa su página /trabajos (sin login) y ya trae cada
// vacante completa, así que no se pide el detalle.
const API = 'https://admin.talently.tech/api/v4/web/work-offers/search';
const JOB_PAGE = 'https://talently.tech/oferta';
const PER_PAGE = 100;
const MAX_PAGES = 5;

export type Offer = {
	id: number;
	name: string;
	public_url: string;
	published_at: string;
	work_modality: { id: number; label: string };
	country: { name: string | null } | null;
	city: { name: string | null } | null;
	business: { name: string | null } | null;
	is_confidential: boolean;
	developer_type: { label: string } | null;
	stacks: { name: string }[];
	highlighted_description: string | null;
	responsibility: string | null;
	requirement: string | null;
};

type SearchResponse = { result: { data: Offer[]; pagination: { current_page: number; total_pages: number } } };

// work_modality.id
const REMOTE_GLOBAL = 1;
const REMOTE_LOCAL = 4; // remoto, pero solo para el país de la vacante
const MODALITY: Record<number, Modality> = { 1: 'remoto', 2: 'hibrido', 3: 'presencial', 4: 'remoto' };

/** Texto markdown de la API: entidades HTML y negritas (`**`) fuera. */
function plain(text: string | null): string {
	return decodeEntities(text ?? '')
		.replace(/\*\*/g, '')
		.trim();
}

export function toPosting(offer: Offer): RawPosting {
	const city = offer.city?.name;
	const country = offer.country?.name;
	return {
		externalId: String(offer.id),
		url: `${JOB_PAGE}/${offer.public_url}`,
		title: decodeEntities(offer.name).trim(),
		company: offer.is_confidential || !offer.business?.name ? null : offer.business.name.trim(),
		location: [city, country].filter(Boolean).join(', ') || undefined,
		modality: MODALITY[offer.work_modality.id],
		// `description` viene vacío o "<p>null</p>": lo útil está en responsabilidades y requisitos
		description: [offer.responsibility, offer.requirement].map(plain).filter(Boolean).join('\n\n') || undefined,
		publishedAt: new Date(offer.published_at),
		publishedRaw: offer.published_at
	};
}

/** Remoto global; remoto local en tu país; presencial o híbrido en tu ciudad. */
function wanted(offer: Offer, where: Location): boolean {
	if (offer.work_modality.id === REMOTE_GLOBAL) return true;
	if (offer.work_modality.id === REMOTE_LOCAL) return normalizeText(offer.country?.name ?? '') === normalizeText(where.country);
	return samePlace(offer.city?.name ?? '', where.city);
}

// el listado completo, una vez por búsqueda (cada búsqueda crea su propio cliente)
const listings = new WeakMap<HttpClient, Promise<Offer[]>>();
function allOffers(client: HttpClient): Promise<Offer[]> {
	if (!listings.has(client)) {
		listings.set(
			client,
			(async () => {
				const offers: Offer[] = [];
				for (let page = 1; page <= MAX_PAGES; page++) {
					const { result } = await client.json<SearchResponse>(`${API}?page=${page}&per_page=${PER_PAGE}`, {
						headers: { Accept: 'application/json', Referer: 'https://talently.tech/trabajos' }
					});
					offers.push(...result.data);
					if (result.pagination.current_page >= result.pagination.total_pages) break;
				}
				return offers;
			})()
		);
	}
	return listings.get(client)!;
}

export const talently: PlatformAdapter = {
	id: 'talently',
	name: 'Talently',
	delay: { min: 3_000, max: 7_000 },
	// el filtro por palabra clave lo hace el adapter con el título, el rol y las tecnologías; con
	// la descripción, la búsqueda lo vuelve a comprobar
	looseSearch: true,

	async *search(term, { client, since, location }) {
		for (const offer of await allOffers(client)) {
			const posting = toPosting(offer);
			if (posting.publishedAt < since || !wanted(offer, location)) continue;
			const tags = [offer.developer_type?.label, ...offer.stacks.map((s) => s.name)].filter(Boolean).join(', ');
			if (mentionsTerm(`${posting.title}\n${tags}`, term)) yield posting;
		}
	}
};
