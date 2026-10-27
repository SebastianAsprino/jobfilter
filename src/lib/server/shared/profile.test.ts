import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { ProfileError, validateKeywords, validateLocation, validateSkills } from './profile';

const example = (file: string) => JSON.parse(readFileSync(`profile.example/${file}`, 'utf8'));

describe('el perfil de ejemplo', () => {
	test('es válido', () => {
		expect(validateLocation(example('location.json'))).toEqual([]);
		expect(validateKeywords(example('keywords.json'))).toEqual([]);
		expect(validateSkills(example('skills.json'))).toEqual([]);
	});
});

describe('validateLocation', () => {
	const ok = { country: 'Colombia', city: 'Bogotá', languages: ['es'] };

	test('pide país, ciudad y al menos un idioma', () => {
		expect(validateLocation({})).toHaveLength(3);
		expect(validateLocation({ ...ok, languages: [] })).toHaveLength(1);
		expect(validateLocation({ ...ok, country: '  ' })).toHaveLength(1);
	});

	test('los idiomas son códigos de dos letras en minúscula', () => {
		expect(validateLocation({ ...ok, languages: ['es', 'en'] })).toEqual([]);
		const problems = validateLocation({ ...ok, languages: ['español', 'EN'] });
		expect(problems).toHaveLength(2);
		expect(problems[0]).toContain('"español"');
	});

	test('no es un objeto', () => {
		expect(validateLocation(['Colombia'])).toHaveLength(1);
		expect(validateLocation(null)).toHaveLength(1);
	});
});

describe('validateKeywords', () => {
	test('una lista de textos', () => {
		expect(validateKeywords({ keywords: ['backend', 'qa automation'] })).toEqual([]);
		expect(validateKeywords({ keywords: [] })).toEqual([]);
	});

	test('avisa la posición de lo que no es texto', () => {
		expect(validateKeywords({ keywords: ['go', '', 3] })).toEqual([
			'"keywords"[1]: "" no es un texto',
			'"keywords"[2]: 3 no es un texto'
		]);
	});

	test('sin "keywords" o con una lista al revés', () => {
		expect(validateKeywords(['backend'])).toHaveLength(1);
		expect(validateKeywords({ keyword: ['backend'] })).toHaveLength(1);
	});
});

describe('validateSkills', () => {
	test('pide "tengo" y "no_tengo"', () => {
		expect(validateSkills({ tengo: {} })).toEqual([
			'"no_tengo" tiene que ser un objeto: { "Nombre visible": ["variante", …] }'
		]);
	});

	test('cada entrada es una lista de variantes no vacía', () => {
		const problems = validateSkills({ tengo: { Go: 'golang', Rust: [] }, no_tengo: { Java: ['java', ''] } });
		expect(problems).toEqual([
			'"tengo" › "Go" tiene que ser una lista con al menos una variante',
			'"tengo" › "Rust" tiene que ser una lista con al menos una variante',
			'"no_tengo" › "Java": "" no es una variante válida'
		]);
	});

	test('una variante no puede estar en "tengo" y en "no_tengo"', () => {
		const problems = validateSkills({ tengo: { React: ['react'] }, no_tengo: { 'React (otra)': ['React'] } });
		expect(problems).toEqual(['la variante "react" está en "tengo" › "React" y en "no_tengo" › "React (otra)"']);
	});

	test('"titulo:" cuenta como la misma variante y no puede ir vacío', () => {
		expect(validateSkills({ tengo: { Go: ['golang', 'titulo:go'] }, no_tengo: { Ir: ['go'] } })).toHaveLength(1);
		expect(validateSkills({ tengo: { Go: ['titulo:'] }, no_tengo: {} })).toHaveLength(1);
	});
});

describe('ProfileError', () => {
	test('lista todos los problemas con el archivo', () => {
		const err = new ProfileError('location.json', ['uno', 'dos']);
		expect(err.message).toBe('profile/location.json tiene errores:\n- uno\n- dos');
		expect(new ProfileError('skills.json', ['uno']).message).toStartWith('profile/skills.json tiene un error:');
	});
});
