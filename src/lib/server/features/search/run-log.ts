// Bitácora de corridas y pausas por plataforma. Uso interno del slice de búsqueda.
import { eq, max, sql } from 'drizzle-orm';
import { db } from '#lib/server/db/client';
import { keywordCursors, platforms, runs } from '#lib/server/db/schema';
import { DEFAULT_PAUSE_MINUTES, pauseMinutesFor } from './pause';

const now = () => new Date().toISOString();

/** Última actividad de la plataforma: el inicio o el final más reciente de sus corridas. */
export function lastActivity(platform: string): string | null {
	const row = db
		.select({ started: max(runs.startedAt), finished: max(runs.finishedAt) })
		.from(runs)
		.where(eq(runs.platform, platform))
		.get();
	const times = [row?.started, row?.finished].filter((t): t is string => !!t);
	return times.length ? times.sort().at(-1)! : null;
}

/**
 * Registra el inicio de una corrida. Con `minGapMinutes`, solo si ninguna corrida de esa
 * plataforma empezó ni terminó en ese intervalo, en una sola sentencia: dos procesos a la vez
 * (la app y la terminal) no pueden pasar los dos. Devuelve null si no corresponde correr.
 */
export function claimRun(platform: string, minGapMinutes?: number): number | null {
	const started = now();
	if (!minGapMinutes) return db.insert(runs).values({ platform, startedAt: started }).returning({ id: runs.id }).get()!.id;
	const cut = new Date(Date.now() - minGapMinutes * 60_000).toISOString();
	// `values` devuelve filas como arreglos con los dos drivers (bun:sqlite y better-sqlite3)
	const rows = db.values<[number]>(sql`
		INSERT INTO runs (platform, started_at)
		SELECT ${platform}, ${started}
		WHERE NOT EXISTS (
			SELECT 1 FROM runs
			WHERE platform = ${platform} AND (started_at > ${cut} OR finished_at > ${cut})
		)
		RETURNING id`);
	return rows[0]?.[0] ?? null;
}

export function finishRun(id: number, found: number, created: number, error?: string) {
	db.update(runs)
		.set({ finishedAt: now(), found, new: created, error: error ?? null })
		.where(eq(runs.id, id))
		.run();
}

export function pausedUntil(platform: string): string | null {
	const row = db.select({ pausedUntil: platforms.pausedUntil }).from(platforms).where(eq(platforms.id, platform)).get();
	return row?.pausedUntil && row.pausedUntil > now() ? row.pausedUntil : null;
}

/** Pausa según la escalera: el primer bloqueo usa el primer escalón, los siguientes suben. */
export function pausePlatform(platform: string, ladderMinutes = DEFAULT_PAUSE_MINUTES): string {
	const { failures } = db
		.insert(platforms)
		.values({ id: platform, failures: 1 })
		// no crece más allá del último escalón: así, después de un bloqueo largo, baja antes
		.onConflictDoUpdate({
			target: platforms.id,
			set: { failures: sql`min(${platforms.failures} + 1, ${ladderMinutes.length})` }
		})
		.returning({ failures: platforms.failures })
		.get()!;
	const minutes = pauseMinutesFor(failures, ladderMinutes);
	const until = new Date(Date.now() + minutes * 60_000).toISOString();
	db.update(platforms).set({ pausedUntil: until }).where(eq(platforms.id, platform)).run();
	return until;
}

/** Bloqueos seguidos que lleva la plataforma (0 si la última corrida terminó bien). */
export function platformFailures(platform: string): number {
	return db.select({ failures: platforms.failures }).from(platforms).where(eq(platforms.id, platform)).get()?.failures ?? 0;
}

/**
 * El sitio avisó un límite (429): pausa corta sin subir la escalera. Se escribe antes de
 * esperar el reintento, así queda registrada aunque el proceso se corte en la espera.
 */
export function noteRateLimit(platform: string, minutes: number) {
	const until = new Date(Date.now() + minutes * 60_000).toISOString();
	db.insert(platforms)
		.values({ id: platform, failures: 0, pausedUntil: until })
		.onConflictDoUpdate({
			target: platforms.id,
			set: { pausedUntil: sql`max(coalesce(${platforms.pausedUntil}, ''), ${until})` }
		})
		.run();
}

const DAY = 86_400_000;

/**
 * Corrida buena. La escalera baja un escalón solo si el último bloqueo terminó hace más de un
 * día: así un bloqueo y un éxito alternados no la dejan siempre en el primer escalón.
 * `paused_until` se conserva (ya vencido) como fecha del último bloqueo.
 */
export function clearPlatformFailures(platform: string) {
	const dayAgo = new Date(Date.now() - DAY).toISOString();
	db.insert(platforms)
		.values({ id: platform, failures: 0 })
		.onConflictDoUpdate({
			target: platforms.id,
			set: {
				failures: sql`CASE WHEN ${platforms.pausedUntil} IS NULL OR ${platforms.pausedUntil} < ${dayAgo}
					THEN max(${platforms.failures} - 1, 0) ELSE ${platforms.failures} END`,
				pausedUntil: sql`CASE WHEN ${platforms.pausedUntil} > ${now()} THEN ${now()} ELSE ${platforms.pausedUntil} END`
			}
		})
		.run();
}

/** Hasta cuándo se buscó completa cada palabra en esta plataforma. */
export function keywordCursorsFor(platform: string): Map<string, string> {
	const rows = db
		.select({ term: keywordCursors.term, searchedAt: keywordCursors.searchedAt })
		.from(keywordCursors)
		.where(eq(keywordCursors.platform, platform))
		.all();
	return new Map(rows.map((r) => [r.term, r.searchedAt]));
}

export function setKeywordCursor(platform: string, term: string, searchedAt: string) {
	db.insert(keywordCursors)
		.values({ platform, term, searchedAt })
		.onConflictDoUpdate({ target: [keywordCursors.platform, keywordCursors.term], set: { searchedAt } })
		.run();
}
