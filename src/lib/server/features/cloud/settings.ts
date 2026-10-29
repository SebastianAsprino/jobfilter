import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

// La cuenta conectada vive en data/ (fuera de git): el token nunca sale de tu máquina.
const PATH = resolve('data/nube.json');

export type CloudSettings = {
	provider: 'google-drive';
	refreshToken: string;
	email: string | null;
	lastSyncAt: string | null;
	/** modifiedTime del respaldo en Drive tras la última sincronización de este computador. */
	remoteVersion?: string | null;
};

export function loadSettings(): CloudSettings | null {
	return existsSync(PATH) ? JSON.parse(readFileSync(PATH, 'utf8')) : null;
}

export function requireSettings(): CloudSettings {
	const settings = loadSettings();
	if (!settings) throw new Error('No hay ninguna cuenta conectada.');
	return settings;
}

export function saveSettings(settings: CloudSettings) {
	mkdirSync(dirname(PATH), { recursive: true });
	writeFileSync(PATH, JSON.stringify(settings, null, '\t'));
}

export function clearSettings() {
	rmSync(PATH, { force: true });
}
