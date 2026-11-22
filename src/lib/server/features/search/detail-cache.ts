// Caché de detalles de vacantes. Uso interno del slice de búsqueda.
import { and, eq } from 'drizzle-orm';
import { db } from '#lib/server/db/client';
import { detailCache } from '#lib/server/db/schema';
import type { RawPosting } from './adapters/types';

export function cachedDetail(platform: string, externalId: string): Partial<RawPosting> | null {
	const row = db
		.select({ description: detailCache.description })
		.from(detailCache)
		.where(and(eq(detailCache.platform, platform), eq(detailCache.externalId, externalId)))
		.get();
	if (!row) return null;
	return row.description ? { description: row.description } : {};
}

export function cacheDetail(platform: string, externalId: string, detail: Partial<RawPosting>) {
	db.insert(detailCache)
		.values({ platform, externalId, description: detail.description ?? null, fetchedAt: new Date().toISOString() })
		.onConflictDoNothing()
		.run();
}
