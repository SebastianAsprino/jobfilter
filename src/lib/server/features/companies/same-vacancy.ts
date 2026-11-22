import { normalizeText } from '#lib/server/shared/normalize';

const DAY = 86_400_000;
const MIN_GAP = 7 * DAY; // más cerca es la misma publicación (o la misma en dos plataformas)
// Medido con vacantes reales: distintas de una misma empresa ≤ 0,21 (comparten la
// presentación de la empresa); la misma con el texto retocado ≈ 0,7; copia exacta = 1.
// Entre confidenciales distintas, la mediana es 0,004.
const AUTO_SIMILARITY = 0.9; // el script solo, sin tu opinión: casi idénticas
const DISCARD_SIMILARITY = 0.6; // con tu descarte basta con que sea muy parecida

export type Posting = {
	id: number;
	companyId: number | null;
	title: string;
	normalizedTitle: string;
	description: string | null;
	status: string;
	dates: number[]; // publicaciones, ordenadas
};

/** Una misma vacante: sus publicaciones y si tu descarte ayudó a reconocerla. */
export type Vacancy = { postings: Posting[]; dates: number[]; discards: Posting[] };

/**
 * Agrupa las vacantes que son la misma: mismo título normalizado, descripción casi idéntica,
 * o —si descartaste una de las dos— descripción muy parecida.
 *
 * Entre confidenciales (`confidential`) el título no alcanza: empresas distintas publican
 * "Desarrollador Backend" sin dar su nombre. Con el mismo título hace falta además una
 * descripción muy parecida, y sin descripción no se agrupan.
 */
export function sameVacancies(postings: Posting[], { confidential = false } = {}): Vacancy[] {
	const shingles = postings.map((p) => (p.description ? shingleSet(p.description) : null));
	const parent = postings.map((_, i) => i);
	const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
	const linkedByDiscard = new Set<number>();

	for (let i = 0; i < postings.length; i++) {
		for (let j = i + 1; j < postings.length; j++) {
			const a = postings[i];
			const b = postings[j];
			const sim = shingles[i] && shingles[j] ? jaccard(shingles[i]!, shingles[j]!) : 0;
			const sameTitle = a.normalizedTitle === b.normalizedTitle && (!confidential || sim >= DISCARD_SIMILARITY);
			const discarded = [a, b].filter((p) => p.status === 'descartada');
			if (sameTitle || sim >= AUTO_SIMILARITY) {
				parent[find(i)] = find(j);
			} else if (discarded.length && sim >= DISCARD_SIMILARITY) {
				parent[find(i)] = find(j);
				discarded.forEach((p) => linkedByDiscard.add(p.id));
			}
		}
	}

	return [...Map.groupBy(postings, (_, i) => find(i)).values()].map((group) => ({
		postings: group,
		dates: distinctDates(group.flatMap((p) => p.dates)),
		discards: group.filter((p) => linkedByDiscard.has(p.id))
	}));
}

/** Publicaciones distintas: separadas por más de 7 días de la anterior contada. */
function distinctDates(all: number[]): number[] {
	const dates: number[] = [];
	for (const t of [...all].sort((a, b) => a - b)) {
		if (!dates.length || t - dates.at(-1)! > MIN_GAP) dates.push(t);
	}
	return dates;
}

/** Grupos de 3 palabras seguidas: comparar estos conjuntos mide cuánto texto comparten. */
function shingleSet(text: string): Set<string> {
	const words = normalizeText(text).split(' ');
	const set = new Set<string>();
	for (let i = 0; i + 3 <= words.length; i++) set.add(words.slice(i, i + 3).join(' '));
	return set;
}

function jaccard(a: Set<string>, b: Set<string>): number {
	let shared = 0;
	for (const s of a) if (b.has(s)) shared++;
	const union = a.size + b.size - shared;
	return union ? shared / union : 0;
}
