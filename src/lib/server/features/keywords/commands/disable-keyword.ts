import { eq } from 'drizzle-orm';
import { db } from '#lib/server/db/client';
import { keywords } from '#lib/server/db/schema';

/** Se desactiva en vez de borrarla, para que el seed no la vuelva a agregar. */
export function disableKeyword(id: number) {
	db.update(keywords).set({ enabled: false }).where(eq(keywords.id, id)).run();
}
