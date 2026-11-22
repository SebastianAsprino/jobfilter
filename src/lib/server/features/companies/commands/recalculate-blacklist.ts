import { eq, sql } from 'drizzle-orm';
import { db } from '#lib/server/db/client';
import { companies, postings as postingsTable, publications } from '#lib/server/db/schema';
import type { Reason } from '../reasons';
import { sameVacancies, type Posting, type Vacancy } from '../same-vacancy';

const DAY = 86_400_000;
const WINDOW = 90 * DAY; // ventana de 3 meses
// Una republicación puede ser real (el contratado no funcionó); 3 en 3 meses ya es un patrón
// de recolectar CVs (como publicar la misma vacante cada mes).
const BLACKLIST_AT = 3;
// Nombre normalizado de los publicadores confidenciales; normalizeCompany nunca genera ':'.
const CONFIDENTIAL = 'confidencial:';

const day = (t: number) => new Date(t).toISOString().slice(0, 10);
const parseDates = (dates: string) =>
	dates
		.split(',')
		.map(Date.parse)
		.sort((a, b) => a - b);

/**
 * Recalcula todo:
 * - agrupa las vacantes confidenciales que son la misma bajo un publicador confidencial;
 * - marca cada vacante con cuántas veces se publicó (el aviso "⟲ 2ª publicación" de la lista);
 * - manda a lista negra las empresas con una vacante publicada 3+ veces en 3 meses;
 * - saca de la lista negra automática las que ya no tienen motivo (por ejemplo, al retomar).
 * No toca la lista blanca ni los bloqueos a mano. Devuelve cuántas empresas quedan en la
 * lista negra automática.
 */
export function recalculateBlacklist(): number {
	groupConfidential();
	const rows = db
		.select({
			id: postingsTable.id,
			companyId: postingsTable.companyId,
			title: postingsTable.title,
			normalizedTitle: postingsTable.normalizedTitle,
			description: postingsTable.description,
			status: postingsTable.status,
			dates: sql<string>`group_concat(${publications.publishedAt})`,
			list: companies.list,
			listSource: companies.listSource
		})
		.from(postingsTable)
		.innerJoin(publications, eq(publications.postingId, postingsTable.id))
		.innerJoin(companies, eq(companies.id, postingsTable.companyId))
		.groupBy(postingsTable.id)
		.all();

	const autoListed = new Set(rows.filter((r) => r.list === 'negra' && r.listSource === 'auto').map((r) => r.companyId));
	// las que decidiste tú (lista blanca o bloqueo a mano) no las toca la regla automática
	const manual = new Set(rows.filter((r) => r.list && r.listSource === 'manual').map((r) => r.companyId));
	const byCompany = Map.groupBy(
		rows.map((r) => ({
			...r,
			companyId: r.companyId!,
			dates: parseDates(r.dates)
		})),
		(p) => p.companyId
	);

	let count = 0;
	db.transaction((tx) => {
		tx.update(postingsTable).set({ repeatTimes: 1, repeatFirst: null }).run();
		for (const [companyId, postings] of byCompany) {
			const vacancies = sameVacancies(postings);
			for (const v of vacancies) {
				if (v.dates.length < 2) continue;
				for (const p of v.postings) {
					tx.update(postingsTable)
						.set({ repeatTimes: v.dates.length, repeatFirst: new Date(v.dates[0]).toISOString() })
						.where(eq(postingsTable.id, p.id))
						.run();
				}
			}

			if (manual.has(companyId)) continue;
			const reasons = vacancies.flatMap(reason);
			const company = eq(companies.id, companyId);
			if (reasons.length) {
				const listReason = JSON.stringify(reasons);
				if (autoListed.has(companyId)) {
					tx.update(companies).set({ listReason }).where(company).run();
				} else {
					tx.update(companies)
						.set({ list: 'negra', listSource: 'auto', listReason, listedAt: new Date().toISOString() })
						.where(company)
						.run();
				}
				count++;
			} else if (autoListed.has(companyId)) {
				tx.update(companies)
					.set({ list: null, listSource: null, listReason: null, listedAt: null })
					.where(company)
					.run();
			}
		}
	});
	return count;
}

/** Motivo de lista negra si hay 3+ publicaciones dentro de alguna ventana de 3 meses. */
function reason(v: Vacancy): Reason[] {
	let start = -1;
	let end = -1;
	for (let i = 0, j = 0; i < v.dates.length; i++) {
		while (j < v.dates.length && v.dates[j] - v.dates[i] <= WINDOW) j++;
		if (j - i >= BLACKLIST_AT && j - i > end - start) [start, end] = [i, j];
	}
	if (start < 0) return [];

	const inWindow = v.dates.slice(start, end);
	const titles = [...new Set(v.postings.map((p) => p.title))].map((t) => `"${t}"`);
	const what = titles.length === 1 ? titles[0] : `la misma vacante (${titles.join(', ')})`;
	const discards = v.discards.map((p) => `"${p.title}"`).join(', ');
	return [
		{
			kind: v.discards.length ? 'descarte' : 'repetida',
			text:
				`Publicó ${what} ${inWindow.length} veces entre ${day(inWindow[0])} y ${day(inWindow.at(-1)!)}` +
				(discards ? `, contando tu descarte de ${discards}` : ''),
			ids: v.postings.map((p) => p.id)
		}
	];
}

/**
 * Las vacantes confidenciales no tienen empresa, así que la regla no las veía. Las que son la
 * misma vacante y se publicaron más de una vez quedan bajo un "publicador confidencial": una
 * empresa con nombre `Empresa confidencial: "<título>"`, que desde ahí sigue la regla de
 * siempre (aviso ⟲, lista negra, bloqueo y lista blanca). Una sola publicación queda sin
 * empresa. Entre corridas se reutiliza el publicador que ya tenía el grupo.
 */
function groupConfidential(): void {
	const rows = db
		.select({
			id: postingsTable.id,
			companyId: postingsTable.companyId,
			title: postingsTable.title,
			normalizedTitle: postingsTable.normalizedTitle,
			description: postingsTable.description,
			status: postingsTable.status,
			dates: sql<string>`group_concat(${publications.publishedAt})`
		})
		.from(postingsTable)
		.innerJoin(publications, eq(publications.postingId, postingsTable.id))
		.leftJoin(companies, eq(companies.id, postingsTable.companyId))
		.where(sql`${postingsTable.companyId} IS NULL OR ${companies.normalizedName} LIKE ${CONFIDENTIAL + '%'}`)
		.groupBy(postingsTable.id)
		.all();
	const postings: Posting[] = rows.map((r) => ({ ...r, dates: parseDates(r.dates) }));

	db.transaction((tx) => {
		const used = new Set<number>();
		for (const v of sameVacancies(postings, { confidential: true })) {
			let companyId: number | null = null;
			if (v.dates.length > 1) {
				// el publicador que ya tenía el grupo; si el grupo se partió, la otra parte crea uno nuevo
				const own = v.postings.map((p) => p.companyId).filter((id) => id !== null && !used.has(id));
				companyId = own.length ? Math.min(...(own as number[])) : createPublisher(v);
				used.add(companyId);
			}
			for (const p of v.postings) {
				if (p.companyId !== companyId) {
					tx.update(postingsTable).set({ companyId }).where(eq(postingsTable.id, p.id)).run();
				}
			}
		}
		// los publicadores que se quedaron sin vacantes (dos grupos que eran la misma vacante)
		tx.delete(companies)
			.where(
				sql`${companies.normalizedName} LIKE ${CONFIDENTIAL + '%'} AND NOT EXISTS (SELECT 1 FROM ${postingsTable} WHERE ${postingsTable.companyId} = ${companies.id})`
			)
			.run();
	});
}

function createPublisher(v: Vacancy): number {
	const first = v.postings.reduce((a, b) => (b.id < a.id ? b : a));
	return db
		.insert(companies)
		.values({ name: `Empresa confidencial: "${first.title}"`, normalizedName: `${CONFIDENTIAL}${first.id}` })
		.onConflictDoUpdate({ target: companies.normalizedName, set: { name: sql`${companies.name}` } })
		.returning({ id: companies.id })
		.get()!.id;
}
