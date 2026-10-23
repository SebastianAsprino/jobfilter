import { fail } from '@sveltejs/kit';
import { blockCompany } from '$lib/server/features/companies/commands/block-company';
import { addKeyword } from '$lib/server/features/keywords/commands/add-keyword';
import { disableKeyword } from '$lib/server/features/keywords/commands/disable-keyword';
import { listKeywords } from '$lib/server/features/keywords/queries/list-keywords';
import { discardPosting } from '$lib/server/features/postings/commands/discard-posting';
import { markApplied } from '$lib/server/features/postings/commands/mark-applied';
import { parseFilters } from '$lib/filters';
import { countNewByPlatform } from '$lib/server/features/postings/queries/count-new-by-platform';
import { listNewPostings } from '$lib/server/features/postings/queries/list-new-postings';
import { getSearchProgress } from '$lib/server/features/search/queries/get-search-progress';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ url }) => {
	const filters = parseFilters(url.searchParams);
	return {
		filters,
		platforms: countNewByPlatform(),
		postings: listNewPostings(filters),
		keywords: listKeywords(),
		progress: getSearchProgress()
	};
};

const idFrom = async (request: Request) => Number((await request.formData()).get('id'));

export const actions: Actions = {
	aplique: async ({ request }) => markApplied(await idFrom(request)),
	descarto: async ({ request }) => discardPosting(await idFrom(request)),
	bloquear: async ({ request }) => blockCompany(await idFrom(request)),
	agregarPalabra: async ({ request }) => {
		const term = String((await request.formData()).get('term') ?? '').trim();
		if (!term) return fail(400, { error: 'Escribe una palabra clave' });
		addKeyword(term);
	},
	quitarPalabra: async ({ request }) => disableKeyword(await idFrom(request))
};
