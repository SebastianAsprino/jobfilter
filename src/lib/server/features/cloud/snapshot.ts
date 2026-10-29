import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { sql } from 'drizzle-orm';
import { db, STAGED_RESTORE_PATH } from '$lib/server/db/client';

const PROFILE_DIR = resolve('profile');
const PROFILE_BACKUP_DIR = resolve('data/profile-antes-de-restaurar');

/** Nombres de los archivos en la nube. */
export const DB_FILE = 'jobfilter.db';
export const PROFILE_FILE = 'profile.json';

const isProfileFile = (name: string) => /^[\w-]+\.json$/.test(name);

type Bytes = Uint8Array<ArrayBuffer>;

/** Copia consistente de la base (VACUUM INTO funciona aunque esté en modo WAL) y de profile/. */
export function createSnapshot(): { db: Bytes; profile: Bytes } {
	const tmp = resolve(`data/respaldo-${Date.now()}.db`);
	db.run(sql`VACUUM INTO ${tmp}`);
	try {
		const files = existsSync(PROFILE_DIR) ? readdirSync(PROFILE_DIR).filter(isProfileFile) : [];
		const profile = Object.fromEntries(
			files.map((f) => [f, JSON.parse(readFileSync(join(PROFILE_DIR, f), 'utf8'))])
		);
		return { db: readFileSync(tmp), profile: Buffer.from(JSON.stringify(profile, null, '\t')) };
	} finally {
		rmSync(tmp, { force: true });
	}
}

/**
 * El perfil se reemplaza ya (el anterior queda en data/profile-antes-de-restaurar/). La base no
 * se puede cambiar con la app abierta: queda lista y db/client.ts la pone en el próximo arranque.
 */
export function stageRestore(dbData: Uint8Array, profileData: Uint8Array | null) {
	if (profileData) {
		const profile: Record<string, unknown> = JSON.parse(Buffer.from(profileData).toString('utf8'));
		if (existsSync(PROFILE_DIR)) {
			rmSync(PROFILE_BACKUP_DIR, { recursive: true, force: true });
			cpSync(PROFILE_DIR, PROFILE_BACKUP_DIR, { recursive: true });
		}
		mkdirSync(PROFILE_DIR, { recursive: true });
		for (const [name, content] of Object.entries(profile)) {
			if (isProfileFile(name)) {
				writeFileSync(join(PROFILE_DIR, name), JSON.stringify(content, null, '\t'));
			}
		}
	}
	writeFileSync(STAGED_RESTORE_PATH, dbData);
}
