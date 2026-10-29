import { and, eq } from 'drizzle-orm';
import { db } from '$lib/server/db/client';
import { postings } from '$lib/server/db/schema';

/** Vuelve a la lista. No toca la lista negra: aplicar nunca cuenta para ella. */
export function unmarkApplied(id: number) {
	db.update(postings)
		.set({ status: 'nueva', statusAt: null })
		.where(and(eq(postings.id, id), eq(postings.status, 'aplicada')))
		.run();
}
