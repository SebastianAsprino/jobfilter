import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient } from '#lib/server/shared/http';
import { talently, toPosting, type Offer } from './talently';

const response = JSON.parse(readFileSync(resolve('fixtures/talently/ofertas.json'), 'utf8'));
const offers: Offer[] = response.result.data;
const byId = (id: number) => toPosting(offers.find((o) => o.id === id)!);

describe('toPosting', () => {
	test('arma la vacante desde la API, con la fecha exacta', () => {
		const p = byId(51389);
		expect(p).toMatchObject({
			externalId: '51389',
			url: 'https://talently.tech/oferta/full-stack-engineer-backend-oriented-remoto-global',
			title: 'Full Stack Engineer (Backend Oriented)',
			company: 'LEASY',
			modality: 'remoto'
		});
		expect(p.location).toBeUndefined();
		expect(p.publishedAt.toISOString()).toBe('2026-09-30T16:02:49.000Z');
	});

	test('ubicación y modalidad', () => {
		expect(byId(51407)).toMatchObject({ location: 'New York City, Estados Unidos', modality: 'hibrido' });
		expect(byId(51383)).toMatchObject({ location: 'Colombia', modality: 'remoto' });
	});

	test('la descripción sale de responsabilidades y requisitos, sin markdown ni entidades', () => {
		expect(byId(51389).description).toContain('Django');
		expect(byId(51389).description).toContain('Mínimo 3 años');
		for (const o of offers) expect(toPosting(o).description ?? '').not.toMatch(/\*\*|&amp;|<p>/);
	});

	test('una empresa confidencial no se guarda como empresa', () => {
		expect(byId(51368).company).toBeNull();
	});
});

describe('search', () => {
	const setup = () => {
		let requests = 0;
		const client = {
			...createClient({ min: 0, max: 0 }),
			json: async <T>() => {
				requests++;
				return response as T;
			}
		};
		const run = async (term: string, country = 'Colombia', city = 'Barranquilla') => {
			const out: string[] = [];
			const location = { country, city, languages: ['es'] };
			for await (const p of talently.search(term, { client, since: new Date('2026-07-01'), location })) out.push(p.externalId);
			return out;
		};
		return { run, requests: () => requests };
	};

	test('filtra por palabra clave con el título, el rol y las tecnologías, desde `since`', async () => {
		// también las de Canadá (remoto local) y Nueva York (híbrido), y una de enero: no entran
		expect((await setup().run('fullstack')).sort()).toEqual(['51339', '51389']);
	});

	test('remoto local solo en tu país; híbrido solo en tu ciudad', async () => {
		const { run } = setup();
		expect(await run('guest experience')).toEqual(['51383']);
		expect(await run('guest experience', 'Perú', 'Lima')).toEqual([]);
		expect(await run('context marketing')).toEqual([]);
		expect(await run('context marketing', 'Perú', 'Lima')).toEqual(['51395']);
	});

	test('una sola petición por búsqueda, aunque haya varias palabras clave', async () => {
		const { run, requests } = setup();
		await run('fullstack');
		await run('backend');
		await run('devops');
		expect(requests()).toBe(1);
	});
});
