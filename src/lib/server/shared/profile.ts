import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

// Todo lo personal vive en profile/ (fuera de git). profile.example/ trae un ejemplo y
// README.md explica cómo generar el tuyo a partir de tu CV. Se resuelve en cada lectura, no
// al importar, para que los tests puedan apuntar a un perfil de prueba.
const dir = () => resolve('profile');

type ProfileFile = 'keywords.json' | 'skills.json' | 'location.json';

export type Location = {
	/** Remoto: se aceptan las vacantes remotas abiertas a este país. */
	country: string;
	/** Presencial o híbrido: solo en esta ciudad. */
	city: string;
	/** Idiomas aceptados (ISO 639-1). Sin 'en', se descartan las vacantes en inglés. */
	languages: string[];
};

/** Nombre visible de cada tecnología y las formas en que aparece escrita en una vacante. */
export type SkillsFile = Record<'tengo' | 'no_tengo', Record<string, string[]>>;

/** Un archivo del perfil está mal armado. El mensaje dice qué arreglar, uno por línea. */
export class ProfileError extends Error {
	constructor(file: ProfileFile, problems: string[]) {
		super(`profile/${file} tiene ${problems.length === 1 ? 'un error' : 'errores'}:\n- ${problems.join('\n- ')}`);
	}
}

export function profilePath(file: ProfileFile): string {
	const path = join(dir(), file);
	if (!existsSync(path)) {
		throw new Error(
			`Falta profile/${file}. Copia profile.example/ a profile/ o genera tu perfil con los prompts de README.md.`
		);
	}
	return path;
}

function read(file: ProfileFile): unknown {
	try {
		return JSON.parse(readFileSync(profilePath(file), 'utf8'));
	} catch (err) {
		if (err instanceof SyntaxError) throw new ProfileError(file, [`no es un JSON válido (${err.message})`]);
		throw err;
	}
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isText = (v: unknown): v is string => typeof v === 'string' && v.trim() !== '';

// Las funciones validate* devuelven la lista de problemas (vacía si el archivo está bien), para
// mostrarlos todos de una vez en vez de hacer arreglar un error por arranque.

export function validateLocation(raw: unknown): string[] {
	if (!isObject(raw)) return ['tiene que ser un objeto con country, city y languages'];
	const problems: string[] = [];
	if (!isText(raw.country)) problems.push('"country" tiene que ser el nombre de tu país, por ejemplo "Colombia"');
	if (!isText(raw.city)) problems.push('"city" tiene que ser tu ciudad, por ejemplo "Bogotá"');
	if (!Array.isArray(raw.languages) || raw.languages.length === 0) {
		problems.push('"languages" tiene que ser una lista con al menos un idioma, por ejemplo ["es"]');
	} else {
		for (const lang of raw.languages) {
			if (typeof lang !== 'string' || !/^[a-z]{2}$/.test(lang)) {
				problems.push(`"languages": ${JSON.stringify(lang)} no es un código de idioma de dos letras en minúscula ("es", "en")`);
			}
		}
	}
	return problems;
}

export function validateKeywords(raw: unknown): string[] {
	if (!isObject(raw) || !Array.isArray(raw.keywords)) return ['tiene que tener "keywords" con una lista de búsquedas'];
	return raw.keywords.flatMap((k, i) => (isText(k) ? [] : [`"keywords"[${i}]: ${JSON.stringify(k)} no es un texto`]));
}

export function validateSkills(raw: unknown): string[] {
	if (!isObject(raw)) return ['tiene que ser un objeto con "tengo" y "no_tengo"'];
	const problems: string[] = [];
	// en qué entrada está cada variante, para avisar si se repite (sobre todo entre tengo y no_tengo)
	const seen = new Map<string, string>();
	for (const list of ['tengo', 'no_tengo'] as const) {
		const entries = raw[list];
		if (!isObject(entries)) {
			problems.push(`"${list}" tiene que ser un objeto: { "Nombre visible": ["variante", …] }`);
			continue;
		}
		for (const [name, aliases] of Object.entries(entries)) {
			const where = `"${list}" › "${name}"`;
			if (!Array.isArray(aliases) || aliases.length === 0) {
				problems.push(`${where} tiene que ser una lista con al menos una variante`);
				continue;
			}
			for (const alias of aliases) {
				if (!isText(alias) || alias === 'titulo:') {
					problems.push(`${where}: ${JSON.stringify(alias)} no es una variante válida`);
					continue;
				}
				const variant = alias.trim().toLowerCase().replace(/^titulo:/, '');
				const other = seen.get(variant);
				if (other) problems.push(`la variante "${variant}" está en ${other} y en ${where}`);
				else seen.set(variant, where);
			}
		}
	}
	return problems;
}

function load<T>(file: ProfileFile, validate: (raw: unknown) => string[]): T {
	const raw = read(file);
	const problems = validate(raw);
	if (problems.length) throw new ProfileError(file, problems);
	return raw as T;
}

export const loadLocation = () => load<Location>('location.json', validateLocation);
export const loadKeywordSeed = () => load<{ keywords: string[] }>('keywords.json', validateKeywords).keywords;
export const loadSkillsFile = () => load<SkillsFile>('skills.json', validateSkills);

/** Revisa los tres archivos al arrancar, para avisar de una vez en vez de fallar a mitad de una búsqueda. */
export function checkProfile() {
	loadLocation();
	loadKeywordSeed();
	loadSkillsFile();
}
