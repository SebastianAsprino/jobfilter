import { eq } from 'drizzle-orm';
import { db } from '#lib/server/db/client';
import { keywords } from '#lib/server/db/schema';

export type Keyword = { id: number; term: string; source: 'claude' | 'manual'; createdAt: string };

export function listKeywords(): Keyword[] {
	return db
		.select({ id: keywords.id, term: keywords.term, source: keywords.source, createdAt: keywords.createdAt })
		.from(keywords)
		.where(eq(keywords.enabled, true))
		.orderBy(keywords.id)
		.all();
}
