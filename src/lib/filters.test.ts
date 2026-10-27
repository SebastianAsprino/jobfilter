import { describe, expect, test } from 'bun:test';
import { isFiltered, isWithinDays, meetsMatch, NO_FILTERS, parseFilters } from './filters';

describe('parseFilters', () => {
	test('lee plataforma y días', () => {
		expect(parseFilters(new URLSearchParams('plataforma=linkedin&dias=7'))).toEqual({
			...NO_FILTERS,
			platform: 'linkedin',
			maxAgeDays: 7
		});
	});

	test('sin parámetros no filtra', () => {
		expect(parseFilters(new URLSearchParams(''))).toEqual(NO_FILTERS);
	});

	test('"hoy" (0 días) es un filtro válido', () => {
		expect(parseFilters(new URLSearchParams('dias=0')).maxAgeDays).toBe(0);
	});

	test('ignora días que no son una opción', () => {
		expect(parseFilters(new URLSearchParams('dias=5')).maxAgeDays).toBeNull();
		expect(parseFilters(new URLSearchParams('dias=abc')).maxAgeDays).toBeNull();
		expect(parseFilters(new URLSearchParams('dias=')).maxAgeDays).toBeNull();
	});

	test('lee modalidad y encaje', () => {
		expect(parseFilters(new URLSearchParams('modalidad=hibrido&encaje=naranja'))).toEqual({
			...NO_FILTERS,
			modality: 'hibrido',
			minMatch: 'naranja'
		});
	});

	test('ignora modalidad y encaje que no son una opción', () => {
		const filters = parseFilters(new URLSearchParams('modalidad=marte&encaje=rojo'));
		expect(filters.modality).toBeNull();
		expect(filters.minMatch).toBeNull();
	});
});

describe('isFiltered', () => {
	test('sin filtros es false', () => {
		expect(isFiltered(NO_FILTERS)).toBe(false);
	});

	test('cualquier filtro lo activa', () => {
		expect(isFiltered({ ...NO_FILTERS, modality: 'remoto' })).toBe(true);
		expect(isFiltered({ ...NO_FILTERS, maxAgeDays: 0 })).toBe(true);
	});
});

describe('meetsMatch', () => {
	test('"verde" deja solo las verdes', () => {
		expect(meetsMatch('verde', 'verde')).toBe(true);
		expect(meetsMatch('naranja', 'verde')).toBe(false);
	});

	test('"naranja" deja verdes y naranjas', () => {
		expect(meetsMatch('verde', 'naranja')).toBe(true);
		expect(meetsMatch('naranja', 'naranja')).toBe(true);
		expect(meetsMatch('rojo', 'naranja')).toBe(false);
	});

	test('sin tecnologías reconocidas no pasa ningún mínimo', () => {
		expect(meetsMatch(null, 'naranja')).toBe(false);
	});
});

describe('isWithinDays', () => {
	const now = Date.parse('2026-10-23T18:00:00.000Z');

	test('hoy incluye lo de las últimas 24 horas', () => {
		expect(isWithinDays('2026-10-23T12:00:00.000Z', 0, now)).toBe(true);
		expect(isWithinDays('2026-10-22T20:00:00.000Z', 0, now)).toBe(true);
		expect(isWithinDays('2026-10-22T12:00:00.000Z', 0, now)).toBe(false);
	});

	test('el límite coincide con "hace N días"', () => {
		expect(isWithinDays('2026-10-16T18:00:00.000Z', 7, now)).toBe(true);
		expect(isWithinDays('2026-10-15T12:00:00.000Z', 7, now)).toBe(false);
	});
});
