import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient } from '$lib/server/shared/http';
import { hireline, parseDetail, parseListing } from './hireline';

const fixture = (name: string) => readFileSync(resolve('fixtures/hireline', name), 'utf8');
const NOW = new Date('2026-10-22T20:00:00Z');
const cards = parseListing(fixture('listado-p1.html'), NOW);
const card = (id: string) => cards.find((c) => c.externalId === id)!;

describe('parseListing', () => {
	test('lee las 12 tarjetas de la página', () => {
		expect(cards).toHaveLength(12);
	});

	test('separa título y empresa, y lee ubicación y modalidad', () => {
		expect(card('114883')).toMatchObject({
			url: 'https://hireline.io/co/empleos/private-cloud-specialist/114883',
			title: 'Private Cloud Specialist',
			company: 'Kyndryl México',
			location: 'Bogota - Híbrido',
			modality: 'hibrido'
		});
		expect(card('114901')).toMatchObject({ modality: 'remoto', location: 'Remoto: LATAM' });
	});

	test('fechas relativas; "más de 30 días" queda como aproximada', () => {
		expect(card('114901').publishedAt.toISOString().slice(0, 10)).toBe('2026-10-21');
		expect(card('114901').publishedApprox).toBeUndefined();
		expect(card('114614').publishedApprox).toBe(true);
	});
});

describe('search', () => {
	const client = { ...createClient({ min: 0, max: 0 }), text: async () => fixture('listado-p1.html') };
	const run = async (term: string, city = 'Barranquilla') => {
		const out: string[] = [];
		const location = { country: 'Colombia', city, languages: ['es'] };
		for await (const p of hireline.search(term, { client, since: new Date('2026-07-01'), location })) out.push(p.externalId);
		return out;
	};

	test('filtra por palabra clave con el título y el resumen', async () => {
		expect(await run('full-stack engineer')).toEqual(['114880']);
	});

	test('remoto abierto a LATAM o a tu país entra; híbrido de otra ciudad no', async () => {
		expect(await run('pm jr')).toEqual(['114836']); // Remoto: México, Colombia
		expect(await run('private cloud')).toEqual([]); // Bogotá híbrido, vives en Barranquilla
		expect(await run('private cloud', 'Bogotá')).toEqual(['114883']);
	});
});

describe('parseDetail', () => {
	test('título, empresa, fecha exacta y descripción desde el JSON-LD', () => {
		const d = parseDetail(fixture('detalle.html'));
		expect(d).toMatchObject({
			title: 'AI Software Engineer — Remote | Contractor | Full-Time',
			company: 'Crossbridge',
			publishedRaw: '2026-10-21',
			publishedApprox: false
		});
		expect(d.description).toContain('Crossbridge');
	});

	test('sin JSON-LD devuelve vacío', () => {
		expect(parseDetail('<html></html>')).toEqual({});
	});
});
