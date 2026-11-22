import { and, eq, sql } from 'drizzle-orm';
import { db } from '#lib/server/db/client';
import { companies, postings, publications } from '#lib/server/db/schema';
import { descriptionHash, normalizeCompany, normalizeTitle } from '#lib/server/shared/normalize';
import type { RawPosting } from '#lib/server/features/search/adapters/types';

function companyId(name: string | null): number | null {
	const normalizedName = name?.trim() ? normalizeCompany(name) : '';
	if (!normalizedName) return null;
	return db
		.insert(companies)
		.values({ name: name!.trim(), normalizedName })
		.onConflictDoUpdate({ target: companies.normalizedName, set: { name: sql`${companies.name}` } })
		.returning({ id: companies.id })
		.get()!.id;
}

/** Guarda o actualiza una vacante que trajo la búsqueda. Devuelve true si es nueva. */
export function savePosting(platform: string, p: RawPosting): boolean {
	const now = new Date().toISOString();
	const publishedAt = p.publishedAt.toISOString();
	const existing = db
		.select({ id: postings.id })
		.from(postings)
		.where(and(eq(postings.platform, platform), eq(postings.externalId, p.externalId)))
		.get();

	if (existing) {
		db.update(postings).set({ lastSeenAt: now, url: p.url, title: p.title }).where(eq(postings.id, existing.id)).run();
		// una fecha aproximada ("Más de 30 días") cambia cada día: no es una republicación
		if (!p.publishedApprox) {
			db.update(postings)
				.set({ publishedAt: sql`max(${postings.publishedAt}, ${publishedAt})`, publishedRaw: p.publishedRaw })
				.where(eq(postings.id, existing.id))
				.run();
			db.insert(publications).values({ postingId: existing.id, publishedAt }).onConflictDoNothing().run();
		}
		return false;
	}

	const { id } = db
		.insert(postings)
		.values({
			platform,
			externalId: p.externalId,
			url: p.url,
			title: p.title,
			normalizedTitle: normalizeTitle(p.title),
			companyId: companyId(p.company),
			recruiter: p.recruiter,
			location: p.location,
			modality: p.modality,
			description: p.description,
			descriptionHash: p.description ? descriptionHash(p.description) : null,
			publishedAt,
			publishedRaw: p.publishedRaw,
			firstSeenAt: now,
			lastSeenAt: now
		})
		.returning({ id: postings.id })
		.get()!;
	db.insert(publications).values({ postingId: id, publishedAt }).run();
	return true;
}
