import { parseAppliedFilters } from '$lib/filters';
import { unmarkApplied } from '$lib/server/features/postings/commands/unmark-applied';
import { countAppliedByPlatform } from '$lib/server/features/postings/queries/count-applied-by-platform';
import { listApplied } from '$lib/server/features/postings/queries/list-applied';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ url }) => {
	const filters = parseAppliedFilters(url.searchParams);
	return { filters, platforms: countAppliedByPlatform(), applied: listApplied(filters) };
};

export const actions: Actions = {
	deshacer: async ({ request }) => unmarkApplied(Number((await request.formData()).get('id')))
};
