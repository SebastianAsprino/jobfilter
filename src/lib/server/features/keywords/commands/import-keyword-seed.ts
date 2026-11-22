import { db } from '#lib/server/db/client';
import { keywords } from '#lib/server/db/schema';
import { loadKeywordSeed } from '#lib/server/shared/profile';

/** Agrega las palabras de profile/keywords.json que no existan. Las que quitaste no se reactivan. */
export function importKeywordSeed() {
	const createdAt = new Date().toISOString();
	const values = loadKeywordSeed().map((term) => ({ term: term.trim().toLowerCase(), source: 'claude' as const, createdAt }));
	if (values.length) db.insert(keywords).values(values).onConflictDoNothing().run();
}
