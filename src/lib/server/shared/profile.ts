import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

// Todo lo personal vive en profile/ (fuera de git). profile.example/ trae un ejemplo y
// README.md explica cómo generar el tuyo a partir de tu CV. Se resuelve en cada lectura, no
// al importar, para que los tests puedan apuntar a un perfil de prueba.
const dir = () => resolve('profile');

export type Location = {
	/** Remoto: se aceptan las vacantes remotas abiertas a este país. */
	country: string;
	/** Presencial o híbrido: solo en esta ciudad. */
	city: string;
	/** Idiomas aceptados (ISO 639-1). Sin 'en', se descartan las vacantes en inglés. */
	languages: string[];
};

export function profilePath(file: 'keywords.json' | 'skills.json' | 'location.json'): string {
	const path = join(dir(), file);
	if (!existsSync(path)) {
		throw new Error(
			`Falta profile/${file}. Copia profile.example/ a profile/ o genera tu perfil con los prompts de README.md.`
		);
	}
	return path;
}

function read<T>(file: Parameters<typeof profilePath>[0]): T {
	return JSON.parse(readFileSync(profilePath(file), 'utf8'));
}

export const loadLocation = () => read<Location>('location.json');
export const loadKeywordSeed = () => read<{ keywords: string[] }>('keywords.json').keywords;
