import { finishConnection } from '$lib/server/features/cloud/commands/finish-connection';
import type { RequestHandler } from './$types';

/** Canal por el que la pestaña de inicio de sesión le avisa a /nube que ya terminó. */
const CHANNEL = 'jobfilter-nube';

// Google vuelve aquí, en la pestaña que se abrió para iniciar sesión. Avisa a /nube y se cierra.
export const GET: RequestHandler = async ({ url }) => {
	const code = url.searchParams.get('code');
	let error = url.searchParams.get('error');
	if (error === 'access_denied') error = 'Cancelaste el inicio de sesión en Google.';
	if (code) {
		try {
			await finishConnection(code, url.searchParams.get('state'));
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		}
	}
	// < para que un mensaje de error no pueda cerrar el <script>.
	const message = JSON.stringify({ error }).replaceAll('<', '\u003c');
	const text = error
		? 'No se pudo iniciar sesión. Vuelve a JobFilter para ver el error.'
		: 'Sesión iniciada. Ya puedes cerrar esta pestaña y volver a JobFilter.';
	const html = `<!doctype html>
<meta charset="utf-8">
<title>JobFilter</title>
<p style="font-family: system-ui, sans-serif; margin: 40px">${text} <a href="/nube">Ir a JobFilter</a></p>
<script>
	new BroadcastChannel(${JSON.stringify(CHANNEL)}).postMessage(${message});
	window.close();
</script>`;
	return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } });
};
