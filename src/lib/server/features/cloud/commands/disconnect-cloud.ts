import { revoke } from '../google-drive';
import { clearSettings, loadSettings } from '../settings';

/** Revoca el permiso en Google. El respaldo sigue en tu Drive hasta que borres la app desde ahí. */
export async function disconnectCloud() {
	const settings = loadSettings();
	if (settings) await revoke(settings.refreshToken);
	clearSettings();
}
