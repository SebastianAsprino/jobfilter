<script lang="ts">
	import { enhance } from '$app/forms';
	import { AGE_OPTIONS } from '$lib/filters';
	import PlatformBadge from '$lib/PlatformBadge.svelte';
	import { platform } from '$lib/platforms';

	let { data } = $props();

	const total = $derived(data.platforms.reduce((n, p) => n + p.total, 0));
	const filtered = $derived(
		data.filters.platform !== null || data.filters.maxAgeDays !== null || data.filters.text !== null
	);

	const MODALITY: Record<string, string> = { remoto: 'Remoto', hibrido: 'Híbrido', presencial: 'Presencial' };

	// escribir filtra sin apretar Enter, pero espera a que se deje de teclear
	let typing: ReturnType<typeof setTimeout> | undefined;
	function search(form: HTMLFormElement | null) {
		clearTimeout(typing);
		typing = setTimeout(() => form?.requestSubmit(), 300);
	}
</script>

<p class="muted intro">
	Vacantes a las que aplicaste. <strong>Deshacer</strong> la devuelve a la lista, por si la marcaste sin
	querer.
</p>

{#if total > 0}
	<form class="filters" method="GET" data-sveltekit-keepfocus data-sveltekit-noscroll>
		<input
			type="search"
			name="q"
			value={data.filters.text ?? ''}
			placeholder="Buscar cargo, empresa, ciudad o tecnología"
			autocomplete="off"
			oninput={(e) => search(e.currentTarget.form)}
		/>
		<label>
			Plataforma
			<select name="plataforma" onchange={(e) => e.currentTarget.form?.requestSubmit()}>
				<option value="">Todas ({total})</option>
				{#each data.platforms as p (p.platform)}
					<option value={p.platform} selected={data.filters.platform === p.platform}>
						{platform(p.platform).name} ({p.total})
					</option>
				{/each}
			</select>
		</label>
		<label>
			Aplicaste
			<select name="dias" onchange={(e) => e.currentTarget.form?.requestSubmit()}>
				<option value="">Cualquier fecha</option>
				{#each AGE_OPTIONS as o (o.days)}
					<option value={o.days} selected={data.filters.maxAgeDays === o.days}>{o.label}</option>
				{/each}
			</select>
		</label>
		{#if filtered}<a href="/aplicadas" class="clear">Quitar filtros</a>{/if}
	</form>

	<p class="summary muted">
		{#if filtered}{data.applied.length} de {total} aplicadas{:else}{total} aplicadas{/if}
	</p>
{/if}

{#if total === 0}
	<p class="empty">Todavía no marcaste ninguna vacante como aplicada.</p>
{:else if data.applied.length === 0}
	<p class="empty">Ninguna vacante cumple los filtros. <a href="/aplicadas">Quitar filtros</a></p>
{:else}
	<ul class="list">
		{#each data.applied as p (p.id)}
			<li class="heat-{p.match.level ?? 'none'}">
				<div class="info">
					<a href={p.url} target="_blank" rel="noopener noreferrer" class="title">{p.title}</a>
					<div class="meta">
						<PlatformBadge id={p.platform} />
						<span>{p.company ?? 'Empresa confidencial'}</span>
						{#if p.modality}<span>{p.location ?? MODALITY[p.modality]}</span>{/if}
						<span>publicada {p.publishedAt.slice(0, 10)}</span>
						<span class="applied">aplicaste {p.statusAt?.slice(0, 10)}</span>
					</div>
					{#if p.match.score !== null}
						<div class="skills">
							<span class="score">{Math.round(p.match.score * 100)}%</span>
							{#each p.match.known as s}<span class="have">{s}</span>{/each}
							{#each p.match.unknown as s}<span class="lack">✗ {s}</span>{/each}
						</div>
					{/if}
				</div>
				<form method="POST" action="?/deshacer" use:enhance>
					<input type="hidden" name="id" value={p.id} />
					<button>Deshacer</button>
				</form>
			</li>
		{/each}
	</ul>
{/if}

<style>
	.intro {
		font-size: 14px;
		margin: 0 0 12px;
	}
	.filters {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px 16px;
		font-size: 13px;
		color: var(--muted);
	}
	.filters label {
		display: inline-flex;
		align-items: center;
		gap: 6px;
	}
	.filters input,
	.filters select {
		font: inherit;
		border: 1px solid var(--border);
		border-radius: 6px;
		padding: 4px 8px;
		background: var(--surface);
		color: var(--text);
	}
	.filters input {
		flex: 1;
		min-width: 220px;
	}
	.clear {
		color: var(--accent);
	}
	.summary {
		margin: 12px 0 8px;
		font-size: 14px;
	}
	.empty {
		padding: 40px 0;
		text-align: center;
		color: var(--muted);
	}
	.list {
		list-style: none;
		margin: 0;
		padding: 0;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 8px;
	}
	.list li {
		display: flex;
		gap: 12px;
		align-items: center;
		padding: 12px 14px;
		border-top: 1px solid var(--border);
		border-left: 4px solid var(--heat, transparent);
	}
	.list li:first-child {
		border-top: 0;
	}
	.heat-verde {
		--heat: var(--ok);
	}
	.heat-naranja {
		--heat: var(--warn);
	}
	.heat-rojo {
		--heat: var(--danger);
	}
	.heat-none {
		--heat: var(--border);
	}
	.info {
		flex: 1;
		min-width: 0;
	}
	.title {
		color: var(--text);
		font-weight: 600;
		text-decoration: none;
	}
	.title:hover {
		color: var(--accent);
		text-decoration: underline;
	}
	.meta {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px 12px;
		font-size: 13px;
		color: var(--muted);
	}
	.applied {
		color: var(--ok);
		font-weight: 600;
	}
	.skills {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px 10px;
		margin-top: 4px;
		font-size: 12px;
	}
	.score {
		font-weight: 700;
		color: var(--heat);
	}
	.have {
		color: var(--ok);
	}
	.lack {
		color: var(--danger);
	}
	button {
		border: 1px solid var(--border);
		background: transparent;
		color: var(--text);
		border-radius: 6px;
		padding: 6px 12px;
		font-size: 13px;
	}
	button:hover {
		border-color: var(--accent);
		color: var(--accent);
	}
	@media (max-width: 600px) {
		.list li {
			flex-direction: column;
			align-items: stretch;
		}
		.filters input {
			min-width: 0;
			width: 100%;
		}
	}
</style>
