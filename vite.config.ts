import adapter from '@sveltejs/adapter-bun';
import { sveltekit } from '@sveltejs/kit/vite';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';

export default defineConfig({
	// desde SvelteKit 3 la config va aquí; svelte.config.js ya no se lee
	plugins: [
		sveltekit({
			preprocess: vitePreprocess(),
			adapter: adapter(),
			// Kit 3 quitó $lib (ahora es #lib); se mantiene como alias para no renombrar todos los imports
			alias: { $lib: 'src/lib' }
		})
	],
	// bun:sqlite lo resuelve Bun en runtime, Vite no debe intentar empaquetarlo
	ssr: { external: ['bun:sqlite'] },
	optimizeDeps: { exclude: ['bun:sqlite'] }
});
