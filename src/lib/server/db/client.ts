import { existsSync, mkdirSync, renameSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import * as schema from './schema';

// Rutas relativas a jobfilter/: `bun run dev`, `bun run dev:node` y `bun run buscar` corren ahí.
const DB_PATH = resolve('data/jobfilter.db');
const MIGRATIONS = resolve('drizzle');
/** Respaldo bajado de la nube que espera al próximo arranque (features/cloud). */
export const STAGED_RESTORE_PATH = resolve('data/restaurar.db');

/** Ambos drivers son síncronos, así que el resto del código usa .all()/.get()/.run() igual. */
export type DB = BaseSQLiteDatabase<'sync', unknown, typeof schema>;

export const runtime = typeof globalThis.Bun !== 'undefined' ? 'bun' : 'node';

/**
 * La base actual queda como jobfilter.db.antes-de-restaurar. El -wal y el -shm se mueven con
 * ella: si quedaran junto a la base nueva, SQLite les aplicaría páginas de la vieja.
 */
function applyStagedRestore() {
	if (!existsSync(STAGED_RESTORE_PATH)) return;
	for (const suffix of ['', '-wal', '-shm']) {
		const previous = `${DB_PATH}.antes-de-restaurar${suffix}`;
		rmSync(previous, { force: true });
		if (existsSync(DB_PATH + suffix)) renameSync(DB_PATH + suffix, previous);
	}
	renameSync(STAGED_RESTORE_PATH, DB_PATH);
}

async function open(): Promise<DB> {
	mkdirSync(dirname(DB_PATH), { recursive: true });
	applyStagedRestore();

	if (runtime === 'bun') {
		const { Database } = await import('bun:sqlite');
		const { drizzle } = await import('drizzle-orm/bun-sqlite');
		const { migrate } = await import('drizzle-orm/bun-sqlite/migrator');
		const sqlite = new Database(DB_PATH, { create: true });
		// busy_timeout: la app y la terminal pueden escribir a la vez sin fallar al instante
		sqlite.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
		const db = drizzle(sqlite, { schema });
		migrate(db, { migrationsFolder: MIGRATIONS });
		return db as DB;
	}

	// SQLite estándar de Node (better-sqlite3)
	const { default: Database } = await import('better-sqlite3');
	const { drizzle } = await import('drizzle-orm/better-sqlite3');
	const { migrate } = await import('drizzle-orm/better-sqlite3/migrator');
	const sqlite = new Database(DB_PATH);
	sqlite.pragma('journal_mode = WAL');
	sqlite.pragma('foreign_keys = ON');
	const db = drizzle(sqlite, { schema });
	migrate(db, { migrationsFolder: MIGRATIONS });
	return db as DB;
}

export const db = await open();
