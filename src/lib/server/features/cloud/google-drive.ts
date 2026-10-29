import { env } from '$env/dynamic/private';
import { GOOGLE_CLIENT } from './oauth-client';

// Solo la carpeta oculta de la app (appDataFolder): JobFilter no ve ni toca el resto de tu Drive.
const SCOPES = 'https://www.googleapis.com/auth/drive.appdata openid email';
const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
const FILES_URL = 'https://www.googleapis.com/drive/v3/files';
const UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files';

/** El de .env si lo hay; si no, el que trae la app (oauth-client.ts). */
function client() {
	return env.GOOGLE_CLIENT_ID
		? { client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET ?? '' }
		: { client_id: GOOGLE_CLIENT.id, client_secret: GOOGLE_CLIENT.secret };
}

export const isConfigured = () => Boolean(client().client_id);

function credentials() {
	if (!isConfigured()) throw new Error('Esta copia de JobFilter no trae cliente de Google. Ver docs/nube.md.');
	return client();
}

async function check(res: Response, action: string): Promise<Response> {
	if (!res.ok) throw new Error(`Google respondió ${res.status} al ${action}: ${await res.text()}`);
	return res;
}

export function authUrl(redirectUri: string, state: string, challenge: string): string {
	const params = new URLSearchParams({
		client_id: credentials().client_id,
		redirect_uri: redirectUri,
		response_type: 'code',
		scope: SCOPES,
		// offline + consent: Google solo entrega el refresh token así
		access_type: 'offline',
		prompt: 'consent',
		state,
		code_challenge: challenge,
		code_challenge_method: 'S256'
	});
	return `${AUTH_URL}?${params}`;
}

export async function exchangeCode(code: string, verifier: string, redirectUri: string) {
	const res = await fetch(TOKEN_URL, {
		method: 'POST',
		body: new URLSearchParams({
			...credentials(),
			code,
			code_verifier: verifier,
			redirect_uri: redirectUri,
			grant_type: 'authorization_code'
		})
	});
	const body = await (await check(res, 'conectar la cuenta')).json();
	if (!body.refresh_token) throw new Error('Google no entregó un refresh token. Vuelve a conectar.');
	// El id_token llega directo de Google por HTTPS; solo se lee el correo para mostrarlo.
	const claims = body.id_token
		? JSON.parse(Buffer.from(body.id_token.split('.')[1], 'base64url').toString('utf8'))
		: {};
	return { refreshToken: body.refresh_token as string, email: (claims.email as string) ?? null };
}

async function accessToken(refreshToken: string): Promise<string> {
	const res = await fetch(TOKEN_URL, {
		method: 'POST',
		body: new URLSearchParams({
			...credentials(),
			refresh_token: refreshToken,
			grant_type: 'refresh_token'
		})
	});
	return (await (await check(res, 'renovar el acceso')).json()).access_token;
}

/** modifiedTime cambia cada vez que alguien sube el archivo: sirve de versión del respaldo. */
type RemoteFile = { id: string; modifiedTime: string };

async function findFile(token: string, name: string): Promise<RemoteFile | undefined> {
	const params = new URLSearchParams({
		spaces: 'appDataFolder',
		q: `name = '${name}' and trashed = false`,
		fields: 'files(id,modifiedTime)'
	});
	const res = await fetch(`${FILES_URL}?${params}`, {
		headers: { Authorization: `Bearer ${token}` }
	});
	return (await (await check(res, `buscar ${name}`)).json()).files[0];
}

/** Crea el archivo en la carpeta de la app o lo reemplaza si ya existe. Devuelve su modifiedTime. */
export async function putFile(
	refreshToken: string,
	name: string,
	data: Uint8Array<ArrayBuffer>
): Promise<string> {
	const token = await accessToken(refreshToken);
	const headers = { Authorization: `Bearer ${token}` };
	const existing = await findFile(token, name);

	if (existing) {
		const res = await fetch(`${UPLOAD_URL}/${existing.id}?uploadType=media&fields=modifiedTime`, {
			method: 'PATCH',
			headers,
			body: data
		});
		return (await (await check(res, `subir ${name}`)).json()).modifiedTime;
	}

	const form = new FormData();
	form.append(
		'metadata',
		new Blob([JSON.stringify({ name, parents: ['appDataFolder'] })], { type: 'application/json' })
	);
	form.append('file', new Blob([data]));
	const res = await fetch(`${UPLOAD_URL}?uploadType=multipart&fields=modifiedTime`, {
		method: 'POST',
		headers,
		body: form
	});
	return (await (await check(res, `subir ${name}`)).json()).modifiedTime;
}

/** modifiedTime del archivo en la nube, o null si no existe. */
export async function fileVersion(refreshToken: string, name: string): Promise<string | null> {
	return (await findFile(await accessToken(refreshToken), name))?.modifiedTime ?? null;
}

export async function getFile(
	refreshToken: string,
	name: string
): Promise<{ data: Uint8Array<ArrayBuffer>; modifiedTime: string } | null> {
	const token = await accessToken(refreshToken);
	const file = await findFile(token, name);
	if (!file) return null;
	const res = await fetch(`${FILES_URL}/${file.id}?alt=media`, {
		headers: { Authorization: `Bearer ${token}` }
	});
	const data = new Uint8Array(await (await check(res, `descargar ${name}`)).arrayBuffer());
	return { data, modifiedTime: file.modifiedTime };
}

export async function revoke(refreshToken: string) {
	// Si el token ya no sirve, igual se desconecta en local.
	await fetch(REVOKE_URL, { method: 'POST', body: new URLSearchParams({ token: refreshToken }) });
}
