// Filtros de la lista de vacantes. Viven en la URL (?plataforma=linkedin&dias=7) para que se
// puedan guardar en favoritos y sobrevivan a recargar la página.
export const AGE_OPTIONS = [
	{ days: 0, label: 'Hoy' },
	{ days: 3, label: 'Últimos 3 días' },
	{ days: 7, label: 'Última semana' },
	{ days: 15, label: 'Últimos 15 días' },
	{ days: 30, label: 'Último mes' }
] as const;

export type ListFilters = { platform: string | null; maxAgeDays: number | null };

/** Lee los filtros de la URL; lo que no reconoce se ignora en vez de romper la página. */
export function parseFilters(params: URLSearchParams): ListFilters {
	const days = AGE_OPTIONS.find((o) => String(o.days) === params.get('dias'))?.days;
	return { platform: params.get('plataforma') || null, maxAgeDays: days ?? null };
}

/** En Aplicadas, los días cuentan desde que aplicaste y además se busca por texto. */
export type AppliedFilters = ListFilters & { text: string | null };

export function parseAppliedFilters(params: URLSearchParams): AppliedFilters {
	return { ...parseFilters(params), text: params.get('q')?.trim() || null };
}

/** Misma cuenta que la edad que se muestra en la lista: "hoy" es menos de 24 horas. */
export function isWithinDays(publishedAt: string, maxAgeDays: number, now = Date.now()): boolean {
	return Math.floor((now - Date.parse(publishedAt)) / 86_400_000) <= maxAgeDays;
}
