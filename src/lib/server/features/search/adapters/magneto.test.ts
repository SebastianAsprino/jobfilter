import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient } from '#lib/server/shared/http';
import { cityId, magneto, toPosting, type Job } from './magneto';

const fixture = (name: string) => JSON.parse(readFileSync(resolve('fixtures/magneto', name), 'utf8'));
const remote: Job[] = fixture('busqueda-remoto.json').rows;
const inCity: Job[] = fixture('busqueda-ciudad.json').rows;
const job = (rows: Job[], id: number) => rows.find((j) => j.id === id)!;

describe('cityId', () => {
	test('saca el id de la ciudad del autocompletado', () => {
		expect(cityId(fixture('ubicaciones-barranquilla.json'), 'Barranquilla')).toBe('CT17028');
		expect(cityId(fixture('ubicaciones-barranquilla.json'), 'Bogotá')).toBeNull();
	});
});

describe('toPosting', () => {
	test('arma la vacante desde la API, con la fecha exacta', () => {
		const p = toPosting(job(inCity, 996853), false);
		expect(p).toMatchObject({
			externalId: '996853',
			url: 'https://www.magneto365.com/co/empleos/analista-qa-barranquilla-996853',
			title: 'Analista QA',
			company: 'VIVA1A',
			location: 'Barranquilla',
			modality: 'presencial'
		});
		expect(p.publishedAt.toISOString()).toBe('2026-07-15T21:18:05.068Z');
	});

	test('modalidad: la búsqueda remota manda; en la ciudad, isRemote es híbrido', () => {
		expect(toPosting(job(remote, 1094241), true).modality).toBe('remoto');
		expect(toPosting(job(inCity, 1110934), false).modality).toBe('hibrido');
	});

	test('quita el código interno que algunas agencias agregan al título', () => {
		expect(toPosting(job(remote, 1042233), true).title).toBe('Desarrollador/a PHP');
	});

	test('una empresa confidencial no se guarda como empresa', () => {
		expect(toPosting(job(remote, 1110101), true).company).toBeNull();
	});

	test('la descripción queda en texto plano', () => {
		for (const j of [...remote, ...inCity]) expect(toPosting(j, true).description ?? '').not.toMatch(/<[a-z]/i);
	});
});

describe('search', () => {
	const run = async (since: string, country = 'Colombia') => {
		const urls: string[] = [];
		const client = {
			...createClient({ min: 0, max: 0 }),
			json: async <T>(url: string) => {
				urls.push(decodeURIComponent(url));
				if (url.includes('/locations?')) return fixture('ubicaciones-barranquilla.json') as T;
				return fixture(url.includes('remote') ? 'busqueda-remoto.json' : 'busqueda-ciudad.json') as T;
			}
		};
		const location = { country, city: 'Barranquilla', languages: ['es'] };
		const out: string[] = [];
		for await (const p of magneto.search('desarrollador', { client, since: new Date(since), location })) {
			out.push(`${p.modality} ${p.externalId}`);
		}
		return { out, urls };
	};

	test('busca remoto en Colombia y presencial o híbrido en tu ciudad, hasta `since`', async () => {
		const { out, urls } = await run('2026-10-15');
		expect(out).toEqual([
			'remoto 1110101',
			'remoto 1109948',
			'remoto 1106804',
			'hibrido 1111607',
			'hibrido 1110934',
			'hibrido 1110911',
			'hibrido 1109708',
			'hibrido 1109685',
			'hibrido 1109663',
			'hibrido 1108588'
		]);
		expect(urls[1]).toContain('filters[locations][0]=C47&filters[work_modality][0]=remote');
		expect(urls[2]).toContain('filters[locations][0]=CT17028&filters[work_modality][0]=hybrid&filters[work_modality][1]=onSite');
		expect(urls[1]).toContain('queries[0][term]=desarrollador');
	});

	test('una página que trae todo no pide la siguiente', async () => {
		const { out, urls } = await run('2026-01-01');
		expect(out).toHaveLength(21 + 12);
		expect(urls).toHaveLength(3); // ubicaciones, remoto y ciudad
	});

	test('fuera de Colombia no busca', async () => {
		expect((await run('2026-10-15', 'México')).urls).toEqual([]);
	});
});
