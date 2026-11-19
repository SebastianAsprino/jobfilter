import { getFile } from '../google-drive';
import { requireSettings, saveSettings } from '../settings';
import { DB_FILE, PROFILE_FILE, stageRestore } from '../snapshot';

/** Baja el respaldo de la nube. La base se aplica en el próximo arranque (ver snapshot.ts). */
export async function restoreBackup() {
	const settings = requireSettings();
	const db = await getFile(settings.refreshToken, DB_FILE);
	if (!db) throw new Error('No hay ningún respaldo en esta cuenta.');
	stageRestore(db.data, (await getFile(settings.refreshToken, PROFILE_FILE))?.data ?? null);
	saveSettings({
		...settings,
		lastSyncAt: new Date().toISOString(),
		remoteVersion: db.modifiedTime
	});
}
