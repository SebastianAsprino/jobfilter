import { describe, expect, test } from 'bun:test';
import { isWithinDays, parseFilters } from './filters';

describe('parseFilters', () => {
	test('lee plataforma y días', () => {
		expect(parseFilters(new URLSearchParams('plataforma=linkedin&dias=7'))).toEqual({
			platform: 'linkedin',
			maxAgeDays: 7
		});
	});

	test('sin parámetros no filtra', () => {
		expect(parseFilters(new URLSearchParams(''))).toEqual({ platform: null, maxAgeDays: null });
	});

	test('"hoy" (0 días) es un filtro válido', () => {
		expect(parseFilters(new URLSearchParams('dias=0')).maxAgeDays).toBe(0);
	});

	test('ignora días que no son una opción', () => {
		expect(parseFilters(new URLSearchParams('dias=5')).maxAgeDays).toBeNull();
		expect(parseFilters(new URLSearchParams('dias=abc')).maxAgeDays).toBeNull();
		expect(parseFilters(new URLSearchParams('dias=')).maxAgeDays).toBeNull();
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
