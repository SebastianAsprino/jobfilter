import { and, eq } from 'drizzle-orm';
import { db } from '#lib/server/db/client';
import { postings } from '#lib/server/db/schema';

export function postingExists(platform: string, externalId: string): boolean {
	return !!db
		.select({ id: postings.id })
		.from(postings)
		.where(and(eq(postings.platform, platform), eq(postings.externalId, externalId)))
		.get();
}
