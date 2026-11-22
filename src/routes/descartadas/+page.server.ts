import { retakePosting } from '#lib/server/features/postings/commands/retake-posting';
import { listDiscarded } from '#lib/server/features/postings/queries/list-discarded';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = () => ({ discarded: listDiscarded() });

export const actions: Actions = {
	retomar: async ({ request }) => retakePosting(Number((await request.formData()).get('id')))
};
