import { existsSync } from 'node:fs';
import { STAGED_RESTORE_PATH } from '$lib/server/db/client';
import { fileVersion, putFile } from '../google-drive';
import { requireSettings, saveSettings } from '../settings';
import { createSnapshot, DB_FILE, PROFILE_FILE } from '../snapshot';

/** El respaldo de la nube cambió desde la última vez que este computador sincronizó. */
export class CloudChangedElsewhere extends Error {}

/**
 * Sube todo lo de este computador y reemplaza el respaldo. Si otro computador subió algo
 * desde la última sincronización (o este nunca sincronizó), no lo pisa sin preguntar.
 */
export async function syncCloud(force: boolean) {
	if (existsSync(STAGED_RESTORE_PATH)) {
		// Subiría la base que se está por reemplazar, no la restaurada.
		throw new Error('Reinicia la app antes de sincronizar: hay una restauración pendiente.');
	}
	const settings = requireSettings();
	if (!force) {
		const remote = await fileVersion(settings.refreshToken, DB_FILE);
		if (remote && remote !== settings.remoteVersion) {
			throw new CloudChangedElsewhere(
				settings.remoteVersion
					? 'El respaldo de Drive cambió desde otro computador después de tu última sincronización.'
					: 'Ya hay un respaldo en esta cuenta, de otro computador o de antes.'
			);
		}
	}
	const snapshot = createSnapshot();
	const remoteVersion = await putFile(settings.refreshToken, DB_FILE, snapshot.db);
	await putFile(settings.refreshToken, PROFILE_FILE, snapshot.profile);
	saveSettings({ ...settings, lastSyncAt: new Date().toISOString(), remoteVersion });
}
