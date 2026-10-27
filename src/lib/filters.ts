// Filtros de la lista de vacantes. Viven en la URL (?plataforma=linkedin&dias=7) para que se
// puedan guardar en favoritos y sobrevivan a recargar la página.
export const AGE_OPTIONS = [
	{ days: 0, label: 'Hoy' },
	{ days: 3, label: 'Últimos 3 días' },
	{ days: 7, label: 'Última semana' },
	{ days: 15, label: 'Últimos 15 días' },
	{ days: 30, label: 'Último mes' }
] as const;

export const MODALITY_OPTIONS = [
	{ value: 'remoto', label: 'Remoto' },
	{ value: 'hibrido', label: 'Híbrido' },
	{ value: 'presencial', label: 'Presencial' }
] as const;

/** El encaje mínimo: "naranja" deja las verdes y las naranjas. */
export const MATCH_OPTIONS = [
	{ value: 'verde', label: 'Solo verdes' },
	{ value: 'naranja', label: 'Verdes y naranjas' }
] as const;

export type Modality = (typeof MODALITY_OPTIONS)[number]['value'];
export type MinMatch = (typeof MATCH_OPTIONS)[number]['value'];

export type ListFilters = {
	platform: string | null;
	maxAgeDays: number | null;
	modality: Modality | null;
	minMatch: MinMatch | null;
};

export const NO_FILTERS: ListFilters = { platform: null, maxAgeDays: null, modality: null, minMatch: null };

/** Lee los filtros de la URL; lo que no reconoce se ignora en vez de romper la página. */
export function parseFilters(params: URLSearchParams): ListFilters {
	const days = AGE_OPTIONS.find((o) => String(o.days) === params.get('dias'))?.days;
	const modality = MODALITY_OPTIONS.find((o) => o.value === params.get('modalidad'))?.value;
	const minMatch = MATCH_OPTIONS.find((o) => o.value === params.get('encaje'))?.value;
	return {
		platform: params.get('plataforma') || null,
		maxAgeDays: days ?? null,
		modality: modality ?? null,
		minMatch: minMatch ?? null
	};
}

export function isFiltered(filters: ListFilters): boolean {
	return Object.values(filters).some((v) => v !== null);
}

/** Misma cuenta que la edad que se muestra en la lista: "hoy" es menos de 24 horas. */
export function isWithinDays(publishedAt: string, maxAgeDays: number, now = Date.now()): boolean {
	return Math.floor((now - Date.parse(publishedAt)) / 86_400_000) <= maxAgeDays;
}

/** Si el color de la vacante alcanza el mínimo pedido; las que no mencionan tecnologías no lo alcanzan. */
export function meetsMatch(level: 'verde' | 'naranja' | 'rojo' | null, minMatch: MinMatch): boolean {
	return level === 'verde' || (minMatch === 'naranja' && level === 'naranja');
}
