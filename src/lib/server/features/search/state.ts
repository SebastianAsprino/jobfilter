import type { SearchProgress } from '#lib/progress';

// Estado en memoria de la búsqueda en curso: lo escribe el comando, lo lee la consulta.
// Vive en globalThis para que una recarga en caliente de Vite no lo pierda a mitad de búsqueda.
const holder = globalThis as typeof globalThis & { __jobfilterSearch?: { progress: SearchProgress } };
export const search = (holder.__jobfilterSearch ??= {
	progress: { running: false, startedAt: null, finishedAt: null, platforms: [] }
});
