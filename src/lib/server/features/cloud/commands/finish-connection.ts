import { exchangeCode } from '../google-drive';
import { pending } from '../pending';
import { saveSettings } from '../settings';

export async function finishConnection(code: string, state: string | null) {
	const { verifier, redirectUri } = pending.take(state);
	const { refreshToken, email } = await exchangeCode(code, verifier, redirectUri);
	saveSettings({ provider: 'google-drive', refreshToken, email, lastSyncAt: null, remoteVersion: null });
}
