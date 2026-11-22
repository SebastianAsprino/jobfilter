import { json } from '@sveltejs/kit';
import { startSearch } from '#lib/server/features/search/commands/start-search';
import { getSearchProgress } from '#lib/server/features/search/queries/get-search-progress';

export function GET() {
	return json(getSearchProgress());
}

export function POST() {
	startSearch();
	return json(getSearchProgress());
}
