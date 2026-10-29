import { redirect } from '@sveltejs/kit';
import { startConnection } from '$lib/server/features/cloud/commands/start-connection';
import type { RequestHandler } from './$types';

// La pestaña que abre "Iniciar sesión" arranca aquí y sigue a la pantalla de permisos de Google.
export const GET: RequestHandler = ({ url }) => {
	redirect(303, startConnection(`${url.origin}/nube/callback`));
};
