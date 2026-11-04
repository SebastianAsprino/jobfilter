import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// profile/ se resuelve desde el directorio actual: se arma uno de prueba y se importa el
// módulo después de entrar ahí, para no depender del perfil de quien corre los tests
const dir = mkdtempSync(join(tmpdir(), 'jobfilter-match-'));
const skillsPath = join(dir, 'profile', 'skills.json');
const previousCwd = process.cwd();

function writeSkills(tengo: Record<string, string[]>, noTengo: Record<string, string[]>, mtime: Date) {
	writeFileSync(skillsPath, JSON.stringify({ tengo, no_tengo: noTengo }));
	utimesSync(skillsPath, mtime, mtime);
}

let matchPosting: typeof import('./match-posting').matchPosting;
let matchSavedPosting: typeof import('./match-posting').matchSavedPosting;

beforeAll(async () => {
	mkdirSync(join(dir, 'profile'));
	writeSkills(
		{ TypeScript: ['typescript'], Go: ['golang', 'titulo:go'], JavaScript: ['javascript'] },
		{ Java: ['java'], Spring: ['spring boot'] },
		new Date('2026-01-01')
	);
	process.chdir(dir);
	({ matchPosting, matchSavedPosting } = await import('./match-posting'));
});

afterAll(() => {
	process.chdir(previousCwd);
	rmSync(dir, { recursive: true, force: true });
});

describe('matchPosting', () => {
	test('todo lo que pide lo tienes: verde', () => {
		const m = matchPosting('Backend developer', 'Buscamos experiencia en TypeScript y Golang');
		expect(m).toEqual({ known: ['TypeScript', 'Go'], unknown: [], score: 1, level: 'verde' });
	});

	test('"java" no cuenta como JavaScript', () => {
		const m = matchPosting('Frontend', 'Experiencia con JavaScript');
		expect(m.known).toEqual(['JavaScript']);
		expect(m.unknown).toEqual([]);
	});

	test('una variante "titulo:" solo cuenta en el título', () => {
		expect(matchPosting('Developer', 'Let us go further').score).toBeNull();
		expect(matchPosting('Go developer', null).known).toEqual(['Go']);
	});

	test('lo que dice el título pesa el doble', () => {
		// Java en el título (2) contra TypeScript en la descripción (1): 1/3, rojo
		const m = matchPosting('Java developer', 'También TypeScript');
		expect(m.score).toBeCloseTo(1 / 3);
		expect(m.level).toBe('rojo');
	});

	test('los cortes de color: 40% es naranja', () => {
		// TypeScript, Go y JavaScript contra Java y Spring en la descripción: 3/5 = 60%
		const m = matchPosting('Dev', 'typescript golang javascript java spring boot');
		expect(m.score).toBeCloseTo(0.6);
		expect(m.level).toBe('naranja');
	});

	test('sin tecnologías reconocidas no tiene color', () => {
		expect(matchPosting('Vendedor', 'Atención al cliente')).toEqual({ known: [], unknown: [], score: null, level: null });
	});
});

describe('matchSavedPosting', () => {
	const posting = { id: 1, title: 'Backend', description: 'TypeScript y Java', descriptionHash: 'a' };

	test('da lo mismo que matchPosting y recuerda el resultado', () => {
		const first = matchSavedPosting(posting);
		expect(first).toEqual(matchPosting(posting.title, posting.description));
		expect(matchSavedPosting(posting)).toBe(first);
	});

	test('recalcula si cambia el título o la descripción', () => {
		const first = matchSavedPosting(posting);
		expect(matchSavedPosting({ ...posting, title: 'Java developer' })).not.toBe(first);
		expect(matchSavedPosting({ ...posting, description: 'Solo TypeScript', descriptionHash: 'b' }).unknown).toEqual([]);
	});

	test('recalcula si se edita skills.json con la app corriendo', () => {
		const before = matchSavedPosting(posting);
		expect(before.level).toBe('naranja');
		writeSkills({ TypeScript: ['typescript'], Java: ['java'] }, {}, new Date('2026-02-01'));
		expect(matchSavedPosting(posting).level).toBe('verde');
	});
});
