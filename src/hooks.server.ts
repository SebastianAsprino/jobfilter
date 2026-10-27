import { importKeywordSeed } from '$lib/server/features/keywords/commands/import-keyword-seed';
import { checkProfile } from '$lib/server/shared/profile';
import type { ServerInit } from '@sveltejs/kit';

// Al arrancar: revisa el perfil y agrega las palabras clave nuevas de profile/keywords.json.
export const init: ServerInit = () => {
	checkProfile();
	importKeywordSeed();
};
