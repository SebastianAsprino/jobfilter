import { existsSync } from 'node:fs';
import { STAGED_RESTORE_PATH } from '$lib/server/db/client';
import { isConfigured } from '../google-drive';
import { loadSettings } from '../settings';

export function getCloudStatus() {
	const settings = loadSettings();
	return {
		configured: isConfigured(),
		connected: settings !== null,
		email: settings?.email ?? null,
		lastSyncAt: settings?.lastSyncAt ?? null,
		restorePending: existsSync(STAGED_RESTORE_PATH)
	};
}
