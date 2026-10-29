import { countBlacklisted } from '$lib/server/features/companies/queries/count-blacklisted';
import { countApplied } from '$lib/server/features/postings/queries/count-applied';
import { countDiscarded } from '$lib/server/features/postings/queries/count-discarded';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = () => ({
	blacklistCount: countBlacklisted(),
	appliedCount: countApplied(),
	discardedCount: countDiscarded()
});
