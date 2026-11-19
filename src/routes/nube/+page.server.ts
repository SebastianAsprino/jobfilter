import { fail } from '@sveltejs/kit';
import { disconnectCloud } from '$lib/server/features/cloud/commands/disconnect-cloud';
import { restoreBackup } from '$lib/server/features/cloud/commands/restore-backup';
import { CloudChangedElsewhere, syncCloud } from '$lib/server/features/cloud/commands/sync-cloud';
import { getCloudStatus } from '$lib/server/features/cloud/queries/get-cloud-status';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = () => ({ cloud: getCloudStatus() });

/** Los errores de Google se muestran en la página en vez de tumbarla. */
async function attempt(fn: () => Promise<void>) {
	try {
		await fn();
	} catch (e) {
		return fail(400, {
			error: e instanceof Error ? e.message : String(e),
			conflict: e instanceof CloudChangedElsewhere
		});
	}
}

export const actions: Actions = {
	sincronizar: async ({ request }) => {
		const force = (await request.formData()).has('force');
		return attempt(() => syncCloud(force));
	},
	restaurar: () => attempt(restoreBackup),
	desconectar: () => attempt(disconnectCloud)
};
