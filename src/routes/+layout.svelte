<script lang="ts">
	import { page } from '$app/state';

	let { data, children } = $props();
</script>

<main>
	<nav>
		<a href="/" class:active={page.url.pathname === '/'}>Vacantes</a>
		<a href="/aplicadas" class:active={page.url.pathname === '/aplicadas'}>
			Aplicadas{#if data.appliedCount}<span class="count muted-count">{data.appliedCount}</span>{/if}
		</a>
		<a href="/descartadas" class:active={page.url.pathname === '/descartadas'}>
			Descartadas{#if data.discardedCount}<span class="count muted-count">{data.discardedCount}</span>{/if}
		</a>
		<a href="/lista-negra" class:active={page.url.pathname === '/lista-negra'}>
			Lista negra{#if data.blacklistCount}<span class="count">{data.blacklistCount}</span>{/if}
		</a>
		<a href="/nube" class:active={page.url.pathname === '/nube'}>Nube</a>
	</nav>

	{@render children()}
</main>

<style>
	:global(:root) {
		--bg: #f7f7f8;
		--surface: #ffffff;
		--text: #1b1b1f;
		--muted: #6b6b76;
		--border: #e3e3e8;
		--accent: #2f5bea;
		--accent-text: #ffffff;
		--ok: #1f8a4c;
		--warn: #b26b00;
		--danger: #c2372f;
		color-scheme: light dark;
	}
	@media (prefers-color-scheme: dark) {
		:global(:root) {
			--bg: #141417;
			--surface: #1d1d22;
			--text: #ececf1;
			--muted: #9a9aa6;
			--border: #2e2e36;
			--accent: #6b8cff;
			--accent-text: #0d0d10;
			--ok: #4cc283;
			--warn: #e3a440;
			--danger: #ef6b62;
		}
	}
	:global(body) {
		margin: 0;
		background: var(--bg);
		color: var(--text);
		font: 15px/1.45 system-ui, sans-serif;
	}
	:global(button) {
		font: inherit;
		cursor: pointer;
	}
	:global(.muted) {
		color: var(--muted);
	}
	main {
		max-width: 960px;
		margin: 0 auto;
		padding: 20px 16px 64px;
	}
	nav {
		display: flex;
		gap: 4px;
		margin-bottom: 20px;
		border-bottom: 1px solid var(--border);
	}
	nav a {
		padding: 8px 12px;
		color: var(--muted);
		text-decoration: none;
		font-weight: 600;
		border-bottom: 2px solid transparent;
		margin-bottom: -1px;
		display: inline-flex;
		align-items: center;
		gap: 6px;
	}
	nav a.active {
		color: var(--text);
		border-bottom-color: var(--accent);
	}
	.count {
		background: var(--danger);
		color: var(--accent-text);
		border-radius: 999px;
		font-size: 12px;
		padding: 0 7px;
		line-height: 18px;
	}
	.muted-count {
		background: var(--border);
		color: var(--muted);
	}
</style>
