import type { SearchProgress } from '#lib/progress';
import { search } from '../state';

export function getSearchProgress(): SearchProgress {
	return search.progress;
}
