import type { PlatformProgress, SearchProgress } from '#lib/progress';
import { recalculateBlacklist } from '#lib/server/features/companies/commands/recalculate-blacklist';
import { listKeywords, type Keyword } from '#lib/server/features/keywords/queries/list-keywords';
import { savePosting } from '#lib/server/features/postings/commands/save-posting';
import { postingExists } from '#lib/server/features/postings/queries/posting-exists';
import { BlockedError, BudgetExhaustedError, createClient, HttpError } from '#lib/server/shared/http';
import { detectLanguage } from '#lib/server/shared/language';
import { mentionsTerm } from '#lib/server/shared/normalize';
import { loadLocation, type Location } from '#lib/server/shared/profile';
import { adapters } from '../adapters';
import type { PlatformAdapter, RawPosting, SearchContext } from '../adapters/types';
import {
	claimRun,
	clearPlatformFailures,
	finishRun,
	keywordCursorsFor,
	lastActivity,
	noteRateLimit,
	pausePlatform,
	pausedUntil,
	platformFailures,
	setKeywordCursor
} from '../run-log';
import { cacheDetail, cachedDetail } from '../detail-cache';
import { search } from '../state';
import { dueKeywords, gapUntil } from '../throttle';

const WINDOW_MS = 90 * 24 * 3_600_000; // 3 meses
const OVERLAP_MS = 2 * 24 * 3_600_000; // margen sobre la última búsqueda
const RATE_LIMIT_PAUSE_MINUTES = 30; // pausa corta cuando el sitio avisa un límite (429)

/** Arranca la búsqueda en segundo plano. Devuelve false si ya hay una corriendo. */
export function startSearch(): boolean {
	if (search.progress.running) return false;
	const keywords = listKeywords();
	const location = loadLocation();
	const progress: SearchProgress = {
		running: true,
		startedAt: new Date().toISOString(),
		finishedAt: null,
		platforms: adapters.map((a) => ({
			id: a.id,
			name: a.name,
			state: 'pendiente',
			term: null,
			done: 0,
			total: keywords.length,
			found: 0,
			created: 0,
			detail: null
		}))
	};
	search.progress = progress;
	Promise.all(adapters.map((a, i) => runPlatform(a, progress.platforms[i], keywords, location)))
		.then(() => recalculateBlacklist())
		.catch((err) => console.error('Error al terminar la búsqueda:', err))
		.finally(() => {
			progress.running = false;
			progress.finishedAt = new Date().toISOString();
		});
	return true;
}

/**
 * Desde cuándo buscar con una palabra: 3 meses la primera vez, y después solo desde la
 * última vez que se buscó completa (con un margen).
 */
function sinceFor(cursor: string | undefined): Date {
	const windowStart = Date.now() - WINDOW_MS;
	if (!cursor) return new Date(windowStart);
	return new Date(Math.max(windowStart, Date.parse(cursor) - OVERLAP_MS));
}

/**
 * Si el detalle de una vacante ya no existe (404 o 410: oferta retirada), se guarda sin
 * descripción y la búsqueda sigue. Cualquier otro error corta la plataforma.
 */
async function fetchDetailOrSkip(
	adapter: PlatformAdapter,
	posting: RawPosting,
	ctx: SearchContext
): Promise<Partial<RawPosting>> {
	try {
		return await adapter.fetchDetail!(posting, ctx);
	} catch (err) {
		if (err instanceof HttpError && (err.status === 404 || err.status === 410)) return {};
		throw err;
	}
}

const later = (a: string | null, b: string | null) => (a && b ? (a > b ? a : b) : (a ?? b));

async function runPlatform(adapter: PlatformAdapter, p: PlatformProgress, keywords: Keyword[], location: Location) {
	// freno: apretar Buscar seguido no vuelve a tocar la plataforma (se mide desde el final de la anterior)
	const gap = gapUntil(lastActivity(adapter.id), adapter.minGapMinutes);
	const paused = pausedUntil(adapter.id);
	if (paused || gap) {
		p.state = 'pausada';
		p.detail = later(paused, gap);
		return;
	}
	const cursors = keywordCursorsFor(adapter.id);
	const { due, nextAt } = dueKeywords(keywords, cursors, adapter.refreshEveryHours);
	if (!due.length) {
		p.state = 'ok';
		p.total = 0;
		p.detail = nextAt
			? `palabras ya buscadas; vuelve ${new Date(nextAt).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })}`
			: 'sin palabras clave';
		return;
	}
	// registrar la corrida es atómico: si otro proceso empezó recién, esta no corre
	const runId = claimRun(adapter.id, adapter.minGapMinutes);
	if (runId === null) {
		p.state = 'pausada';
		p.detail = gapUntil(lastActivity(adapter.id), adapter.minGapMinutes);
		return;
	}

	p.state = 'buscando';
	p.total = due.length;
	const client = createClient(adapter.delay, {
		cookies: adapter.cookies,
		// después de un bloqueo reciente no se reintenta: al primer 429, a la escalera
		blockRetryMs: platformFailures(adapter.id) ? undefined : adapter.blockRetryMs,
		onRateLimit: () => noteRateLimit(adapter.id, RATE_LIMIT_PAUSE_MINUTES),
		maxRequests: adapter.maxRequestsPerRun,
		blockRedirects: adapter.blockRedirects
	});
	const seen = new Set<string>();
	// primero las que nunca se buscaron y después las que llevan más tiempo sin buscarse. El orden
	// es estable (a igual cursor, por id): una palabra que quedó a medias por el cupo se retoma
	// primero en la próxima búsqueda y aprovecha los detalles que ya quedaron en caché
	const ordered = [...due].sort(
		(a, b) => (cursors.get(a.term) ?? '').localeCompare(cursors.get(b.term) ?? '') || a.id - b.id
	);

	try {
		let left = 0;
		for (const [i, keyword] of ordered.entries()) {
			const startedAt = new Date().toISOString();
			p.term = keyword.term;
			const ctx = { client, location, since: sinceFor(cursors.get(keyword.term)) };
			const complete = await searchKeyword(adapter, keyword, keywords, ctx, p, seen);
			if (complete) {
				setKeywordCursor(adapter.id, keyword.term, startedAt);
				p.done++;
			}
			if (!complete || client.rateLimited()) {
				// cupo agotado o el sitio avisó un límite: lo que falta sigue la próxima vez
				left = ordered.length - i - (complete ? 1 : 0);
				break;
			}
		}
		p.state = 'ok';
		p.term = null;
		if (client.rateLimited()) {
			// el 429 queda como pausa corta (noteRateLimit); no se limpia
			p.detail = `${adapter.name} avisó un límite: pausa corta; ${left} pendientes`;
		} else {
			clearPlatformFailures(adapter.id);
			if (left) p.detail = `${left} ${left === 1 ? 'palabra queda' : 'palabras quedan'} para la próxima búsqueda`;
		}
		finishRun(runId, p.found, p.created);
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		if (err instanceof BlockedError || adapter.pauseOnErrors) {
			p.state = 'pausada';
			p.detail = pausePlatform(adapter.id, adapter.pauseMinutes);
		} else {
			p.state = 'error';
			p.detail = message;
		}
		finishRun(runId, p.found, p.created, message);
	}
}

/** Busca una palabra y guarda lo que sirva. Devuelve false si se cortó por el cupo o un aviso de límite. */
async function searchKeyword(
	adapter: PlatformAdapter,
	keyword: Keyword,
	allKeywords: Keyword[],
	ctx: SearchContext,
	p: PlatformProgress,
	seen: Set<string>
): Promise<boolean> {
	try {
		for await (const posting of adapter.search(keyword.term, ctx)) {
			if (seen.has(posting.externalId)) continue;
			// el detalle cuesta una petición más: solo para las que no están en la base, y una sola
			// vez por vacante (queda en caché aunque después se descarte)
			let detail: Partial<RawPosting> = {};
			if (adapter.fetchDetail && !postingExists(adapter.id, posting.externalId)) {
				const cached = cachedDetail(adapter.id, posting.externalId);
				if (cached) {
					detail = cached;
				} else if (adapter.prefilterByTitle && !allKeywords.some((k) => mentionsTerm(posting.title, k.term))) {
					// el título no menciona ninguna palabra clave: no vale la petición del detalle
					continue;
				} else {
					detail = await fetchDetailOrSkip(adapter, posting, ctx);
					cacheDetail(adapter.id, posting.externalId, detail);
				}
			}
			const full = { ...posting, ...detail };
			if (adapter.looseSearch && !mentionsTerm(`${full.title}\n${full.description ?? ''}`, keyword.term)) continue;
			// idioma: muchas plataformas no lo filtran; se detecta por la descripción
			const language = full.description ? detectLanguage(full.description) : null;
			if (language && !ctx.location.languages.includes(language)) continue;

			seen.add(posting.externalId);
			p.found++;
			if (savePosting(adapter.id, full)) p.created++;
		}
		return true;
	} catch (err) {
		if (err instanceof BudgetExhaustedError) return false;
		throw err;
	}
}
