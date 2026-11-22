import { db } from '#lib/server/db/client';
import { keywords } from '#lib/server/db/schema';

export function addKeyword(term: string) {
	db.insert(keywords)
		.values({ term: term.trim().toLowerCase(), source: 'manual', createdAt: new Date().toISOString() })
		.onConflictDoUpdate({ target: keywords.term, set: { enabled: true } })
		.run();
}
