import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient } from '#lib/server/shared/http';
import { parseDetail, peaku, toPosting, type Job } from './peaku';

const fixture = (name: string) => readFileSync(resolve('fixtures/peaku', name), 'utf8');
const jobs: Job[] = JSON.parse(fixture('vacantes-activas.json'));
const job = (slug: string) => jobs.find((j) => j.url.startsWith(slug))!;

describe('toPosting', () => {
	test('arma la vacante desde el listado', () => {
		expect(toPosting(job('57876'))).toMatchObject({
			externalId: '57876',
			url: 'https://peaku.co/es/empleos/57876-mobile-application-developer---barranquilla',
			title: 'MOBILE APPLICATION DEVELOPER - BARRANQUILLA',
			company: 'Genia Tecnologia S.A.S',
			location: 'Barranquilla',
			modality: 'hibrido',
			publishedRaw: '2026-08-26'
		});
	});

	test('remoto, presencial y empresa confidencial', () => {
		expect(toPosting(job('57921')).modality).toBe('remoto');
		expect(toPosting(job('57921')).location).toBe('Remoto');
		expect(toPosting(job('62862')).modality).toBe('presencial');
		expect(toPosting(job('60859')).company).toBeNull();
	});
});

describe('search', () => {
	// listado falso: el adapter no hace peticiones reales en el test
	const client = { ...createClient({ min: 0, max: 0 }), json: async <T>() => jobs as T };
	const location = { country: 'Colombia', city: 'Barranquilla', languages: ['es'] };
	const run = async (term: string) => {
		const out = [];
		for await (const p of peaku.search(term, { client, since: new Date('2026-01-01'), location })) out.push(p.externalId);
		return out;
	};

	test('filtra por palabra clave con título y habilidades', async () => {
		expect(await run('backend developer')).toEqual(['57920']);
		expect(await run('mobile development')).toEqual(expect.arrayContaining(['57876', '57878']));
	});

	test('presencial de otra ciudad queda fuera; híbrido en tu ciudad entra', async () => {
		expect(await run('graphic designer')).toEqual([]);
		expect(await run('mobile application developer')).toContain('57876');
	});
});

describe('parseDetail', () => {
	test('descripción desde el JSON-LD JobPosting', () => {
		const { description } = parseDetail(fixture('detalle.html'));
		expect(description).toContain('Genia Tecnología');
		expect(description).toContain('desarrollo móvil');
		expect(description).not.toMatch(/<[a-z]/i);
	});

	test('sin JSON-LD devuelve vacío', () => {
		expect(parseDetail('<html></html>')).toEqual({});
	});
});
