// Corre la misma búsqueda del botón, desde la terminal: `bun run buscar`
import { importKeywordSeed } from '$lib/server/features/keywords/commands/import-keyword-seed';
import { startSearch } from '$lib/server/features/search/commands/start-search';
import { getSearchProgress } from '$lib/server/features/search/queries/get-search-progress';
import { checkProfile } from '$lib/server/shared/profile';

checkProfile();
importKeywordSeed();
startSearch();

const timer = setInterval(() => {
	const { running, platforms } = getSearchProgress();
	const line = platforms
		.map(
			(p) =>
				`${p.name}: ${p.state} ${p.done}/${p.total} (${p.found} vistas, ${p.created} nuevas)` +
				(p.term ? ` · ${p.term}` : '') +
				(p.detail ? ` · ${p.detail}` : '')
		)
		.join(' | ');
	console.log(line);
	if (!running) clearInterval(timer);
}, 3_000);
