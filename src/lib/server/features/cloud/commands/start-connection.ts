import { createHash, randomBytes } from 'node:crypto';
import { authUrl } from '../google-drive';
import { pending } from '../pending';

/** Arma el enlace a la pantalla de permisos de Google (OAuth con PKCE). */
export function startConnection(redirectUri: string): string {
	const verifier = randomBytes(32).toString('base64url');
	const state = randomBytes(16).toString('base64url');
	pending.set({ state, verifier, redirectUri });
	return authUrl(redirectUri, state, createHash('sha256').update(verifier).digest('base64url'));
}
