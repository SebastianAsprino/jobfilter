import { statSync } from 'node:fs';
import { normalizeText } from '$lib/server/shared/normalize';
import { loadSkillsFile, profilePath } from '$lib/server/shared/profile';

export type MatchLevel = 'verde' | 'naranja' | 'rojo';

export type Match = {
	known: string[];
	unknown: string[];
	/** Parte de lo que pide la vacante que tienes (0–1); null si no se detectó ninguna tecnología. */
	score: number | null;
	level: MatchLevel | null;
};

type Skill = { name: string; known: boolean; pattern: RegExp | null; titlePattern: RegExp | null };

const GREEN_FROM = 0.75;
const ORANGE_FROM = 0.4;
const TITLE_WEIGHT = 2; // lo que dice el título es lo central del cargo

let cache: { mtime: number; skills: Skill[] } | null = null;

function escape(text: string) {
	return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Relee profile/skills.json solo si cambió, así se puede editar con la app corriendo. */
function loadSkills(): Skill[] {
	const mtime = statSync(profilePath('skills.json')).mtimeMs;
	if (cache?.mtime === mtime) return cache.skills;

	const file = loadSkillsFile();
	// mismas reglas que el texto: sin tildes, minúsculas; "java" no matchea "javascript"
	const regex = (aliases: string[]) =>
		aliases.length
			? new RegExp(`(?<![a-z0-9+#])(?:${aliases.map((a) => escape(normalizeText(a))).join('|')})(?![a-z0-9+#])`)
			: null;
	const build = (entries: Record<string, string[]>, known: boolean) =>
		Object.entries(entries).map(([name, aliases]) => {
			const titleOnly = aliases.filter((a) => a.startsWith('titulo:')).map((a) => a.slice('titulo:'.length));
			const anywhere = aliases.filter((a) => !a.startsWith('titulo:'));
			return { name, known, pattern: regex(anywhere), titlePattern: regex([...anywhere, ...titleOnly]) };
		});
	const skills = [...build(file.tengo, true), ...build(file.no_tengo, false)];
	cache = { mtime, skills };
	return skills;
}

export function matchPosting(title: string, description: string | null): Match {
	const t = normalizeText(title);
	const d = normalizeText(description ?? '');
	const known: string[] = [];
	const unknown: string[] = [];
	let have = 0;
	let total = 0;

	for (const skill of loadSkills()) {
		const inTitle = !!skill.titlePattern?.test(t);
		if (!inTitle && !skill.pattern?.test(d)) continue;
		const weight = inTitle ? TITLE_WEIGHT : 1;
		total += weight;
		if (skill.known) {
			have += weight;
			known.push(skill.name);
		} else {
			unknown.push(skill.name);
		}
	}

	if (!total) return { known, unknown, score: null, level: null };
	const score = have / total;
	const level = score >= GREEN_FROM ? 'verde' : score >= ORANGE_FROM ? 'naranja' : 'rojo';
	return { known, unknown, score, level };
}
