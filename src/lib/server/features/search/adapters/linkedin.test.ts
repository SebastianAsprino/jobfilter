import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { BlockedError, createClient } from '#lib/server/shared/http';
import { linkedin, parseDetail, parseSearchPage } from './linkedin';

const fixture = (name: string) => readFileSync(resolve('fixtures/linkedin', name), 'utf8');

describe('parseSearchPage', () => {
	const remote = parseSearchPage(fixture('busqueda-remoto.html'), 'remoto');

	test('lee las 10 tarjetas de una página', () => {
		expect(remote).toHaveLength(10);
	});

	test('arma la vacante con la URL limpia y la fecha exacta', () => {
		expect(remote[0]).toMatchObject({
			externalId: '4462080323',
			url: 'https://www.linkedin.com/jobs/view/4462080323/',
			title: 'Senior Full Stack Developer (Django + React) - Remote Work | REF#302834',
			company: 'BairesDev',
			location: 'Colombia',
			modality: 'remoto',
			publishedRaw: 'Hace 2 semanas'
		});
		expect(remote[0].publishedAt.toISOString()).toBe('2026-10-01T12:00:00.000Z');
	});

	test('la búsqueda por ciudad no asume modalidad', () => {
		const city = parseSearchPage(fixture('busqueda-ciudad.html'));
		expect(city.length).toBeGreaterThan(0);
		expect(city.every((p) => p.modality === undefined)).toBe(true);
		expect(city.some((p) => p.location?.startsWith('Barranquilla'))).toBe(true);
	});

	test('una página vacía no rompe', () => {
		expect(parseSearchPage('')).toEqual([]);
	});
});

describe('parseDetail', () => {
	test('descripción completa con los criterios', () => {
		const { description } = parseDetail(fixture('detalle.html'));
		expect(description).toContain('Integral Group Solution');
		expect(description).toContain('Nivel de antigüedad: Intermedio');
		expect(description).toContain('Tipo de empleo: Jornada completa');
		expect(description).not.toContain('<');
	});

	test('sin descripción devuelve vacío', () => {
		expect(parseDetail('<html></html>')).toEqual({});
	});
});

describe('fetchDetail', () => {
	const ctx = (body: string) => ({
		client: { ...createClient({ min: 0, max: 0 }), text: async () => body },
		since: new Date(0),
		location: { country: 'Colombia', city: 'Barranquilla', languages: ['es'] }
	});
	const posting = parseSearchPage(fixture('busqueda-remoto.html'), 'remoto')[0];

	test('con descripción la devuelve', async () => {
		expect((await linkedin.fetchDetail!(posting, ctx(fixture('detalle.html')))).description).toContain('Integral Group Solution');
	});

	test('un detalle suelto sin descripción se acepta; dos en la misma búsqueda son un bloqueo', async () => {
		const c = ctx('<html>Únete a LinkedIn</html>');
		expect(await linkedin.fetchDetail!(posting, c)).toEqual({});
		await expect(linkedin.fetchDetail!(posting, c)).rejects.toBeInstanceOf(BlockedError);
	});

	test('tres palabras seguidas sin ninguna tarjeta son un bloqueo', async () => {
		const c = ctx('');
		const run = async (term: string) => {
			for await (const _ of linkedin.search(term, c));
		};
		await run('a');
		await run('b');
		await expect(run('c')).rejects.toBeInstanceOf(BlockedError);
	});

	test('una palabra con resultados reinicia la cuenta de vacías', async () => {
		let body = '';
		const c = { ...ctx(''), client: { ...createClient({ min: 0, max: 0 }), text: async () => body } };
		const run = async (term: string) => {
			for await (const _ of linkedin.search(term, c));
		};
		await run('a');
		await run('b');
		body = fixture('busqueda-remoto.html');
		await run('c');
		body = '';
		await run('d');
		await run('e');
		await expect(run('f')).rejects.toBeInstanceOf(BlockedError);
	});
});
