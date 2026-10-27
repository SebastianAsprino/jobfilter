<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { AGE_OPTIONS, isFiltered, MATCH_OPTIONS, MODALITY_OPTIONS } from '$lib/filters';
	import PlatformBadge from '$lib/PlatformBadge.svelte';
	import { platform } from '$lib/platforms';
	import type { SearchProgress } from '$lib/progress';
	import { onDestroy, onMount } from 'svelte';

	let { data, form } = $props();

	// svelte-ignore state_referenced_locally
	let progress = $state<SearchProgress>(data.progress);
	let timer: ReturnType<typeof setInterval> | undefined;

	const platformCount = $derived(new Set(data.postings.map((p) => p.platform)).size);
	const total = $derived(data.platforms.reduce((n, p) => n + p.total, 0));
	const filtered = $derived(isFiltered(data.filters));
	const overall = $derived.by(() => {
		const total = progress.platforms.reduce((n, p) => n + p.total, 0);
		const done = progress.platforms.reduce(
			(n, p) => n + (p.state === 'buscando' || p.state === 'pendiente' ? p.done : p.total),
			0
		);
		return total ? Math.round((done / total) * 100) : 0;
	});

	async function poll() {
		progress = await (await fetch('/api/buscar')).json();
		if (!progress.running) {
			clearInterval(timer);
			timer = undefined;
			await invalidateAll();
		}
	}

	async function buscar() {
		progress = await (await fetch('/api/buscar', { method: 'POST' })).json();
		timer ??= setInterval(poll, 1_000);
	}

	// si se recarga la página con una búsqueda en curso, se sigue mostrando el avance
	onMount(() => {
		if (progress.running) timer = setInterval(poll, 1_000);
	});
	onDestroy(() => clearInterval(timer));

	const MODALITY: Record<string, string> = { remoto: 'Remoto', hibrido: 'Híbrido', presencial: 'Presencial' };

	function age(iso: string): string {
		const days = Math.floor((Date.now() - Date.parse(iso)) / 86_400_000);
		if (days <= 0) return 'hoy';
		if (days === 1) return 'ayer';
		return `hace ${days} días`;
	}

	const confirmBlock =
		(company: string | null): SubmitFunction =>
		({ cancel }) => {
			if (!confirm(`¿Bloquear ${company}? Sus vacantes dejan de aparecer (se puede deshacer en Lista negra).`)) cancel();
		};

	function pausedLabel(iso: string | null): string {
		return iso ? `en pausa hasta ${new Date(iso).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}` : '';
	}
</script>

<header>
	<div class="search">
		<button class="primary" onclick={buscar} disabled={progress.running}>
			{#if progress.running}
				<span class="spinner" aria-hidden="true"></span> Buscando… {overall}%
			{:else}
				Buscar
			{/if}
		</button>

		<ul class="chips">
			{#each data.keywords as k (k.id)}
				<li class="chip" class:manual={k.source === 'manual'}>
					{k.term}
					<form method="POST" action="?/quitarPalabra" use:enhance>
						<input type="hidden" name="id" value={k.id} />
						<button type="submit" aria-label="Quitar {k.term}" title="Quitar">×</button>
					</form>
				</li>
			{/each}
			<li>
				<form method="POST" action="?/agregarPalabra" use:enhance class="add">
					<input name="term" placeholder="+ palabra clave" autocomplete="off" />
				</form>
			</li>
		</ul>
		{#if form?.error}<p class="error">{form.error}</p>{/if}
	</div>

	{#if progress.platforms.length}
		<ul class="platforms">
			{#each progress.platforms as p (p.id)}
				<li class={p.state}>
					<PlatformBadge id={p.id} />
					{#if p.state === 'buscando'}
						<span class="bar"><span style="width: {p.total ? (p.done / p.total) * 100 : 0}%"></span></span>
						<span class="muted">{p.term} · {p.done}/{p.total}</span>
					{:else if p.state === 'pausada'}
						<span class="muted">⏸ {pausedLabel(p.detail)}</span>
					{:else if p.state === 'error'}
						<span class="muted" title={p.detail}>error: {p.detail}</span>
					{:else if p.state === 'pendiente'}
						<span class="muted">en espera</span>
					{:else if p.state === 'ok' && p.detail}
						<span class="muted">{p.detail}</span>
					{/if}
					{#if p.state !== 'pendiente' && p.state !== 'pausada'}
						<span class="count">{p.created} nuevas</span>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
</header>

<form class="filters" method="GET" data-sveltekit-keepfocus data-sveltekit-noscroll>
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
		Publicada
		<select name="dias" onchange={(e) => e.currentTarget.form?.requestSubmit()}>
			<option value="">Cualquier fecha</option>
			{#each AGE_OPTIONS as o (o.days)}
				<option value={o.days} selected={data.filters.maxAgeDays === o.days}>{o.label}</option>
			{/each}
		</select>
	</label>
	<label>
		Modalidad
		<select name="modalidad" onchange={(e) => e.currentTarget.form?.requestSubmit()}>
			<option value="">Todas</option>
			{#each MODALITY_OPTIONS as o (o.value)}
				<option value={o.value} selected={data.filters.modality === o.value}>{o.label}</option>
			{/each}
		</select>
	</label>
	<label>
		Encaje
		<select name="encaje" onchange={(e) => e.currentTarget.form?.requestSubmit()}>
			<option value="">Todos</option>
			{#each MATCH_OPTIONS as o (o.value)}
				<option value={o.value} selected={data.filters.minMatch === o.value}>{o.label}</option>
			{/each}
		</select>
	</label>
	{#if filtered}<a href="/" class="clear">Quitar filtros</a>{/if}
</form>

<p class="summary muted">
	{#if filtered}{data.postings.length} de {total} vacantes por revisar{:else}{data.postings.length} vacantes por revisar{platformCount > 1 ? ` en ${platformCount} plataformas` : ''}{/if}
</p>

{#if data.postings.length === 0}
	{#if filtered}
		<p class="empty">Ninguna vacante cumple los filtros. <a href="/">Quitar filtros</a></p>
	{:else}
		<p class="empty">No hay vacantes pendientes. Presiona <strong>Buscar</strong>.</p>
	{/if}
{:else}
	<ul class="list">
		{#each data.postings as p (p.id)}
			<li class="heat-{p.match.level ?? 'none'}">
				<div class="info">
					<a href={p.url} target="_blank" rel="noopener noreferrer" class="title">{p.title}</a>
					<div class="meta">
						<PlatformBadge id={p.platform} />
						<span class="company">
							{p.company ?? 'Empresa confidencial'}
							{#if p.companyId !== null}
								<form method="POST" action="?/bloquear" use:enhance={confirmBlock(p.company)}>
									<input type="hidden" name="id" value={p.companyId} />
									<button class="block" title="Mandar a la lista negra">Bloquear</button>
								</form>
							{/if}
						</span>
						{#if p.modality}<span>{p.location ?? MODALITY[p.modality]}</span>{/if}
						<span title={p.publishedAt.slice(0, 10)}>{age(p.publishedAt)}</span>
						{#if p.repeatTimes > 1}
							<span class="repeat" title="La empresa ya publicó esta misma vacante. Con 3 publicaciones en 3 meses pasa a lista negra.">
								⟲ {p.repeatTimes}ª publicación, desde {p.repeatFirst?.slice(0, 10)}
							</span>
						{/if}
					</div>
					<div class="skills">
						{#if p.match.score === null}
							<span class="muted">sin tecnologías reconocidas</span>
						{:else}
							<span class="score">{Math.round(p.match.score * 100)}%</span>
							{#each p.match.known as s}<span class="have">{s}</span>{/each}
							{#each p.match.unknown as s}<span class="lack">✗ {s}</span>{/each}
						{/if}
						{#if p.sameCompany}
							<span class="same" class:best={p.sameCompany.isBest}>
								{p.sameCompany.isBest ? `★ la mejor de ${p.sameCompany.total} en esta empresa` : `${p.sameCompany.total} vacantes en esta empresa`}
							</span>
						{/if}
					</div>
				</div>
				<div class="actions">
					<form method="POST" action="?/aplique" use:enhance>
						<input type="hidden" name="id" value={p.id} />
						<button class="apply">Apliqué</button>
					</form>
					<form method="POST" action="?/descarto" use:enhance>
						<input type="hidden" name="id" value={p.id} />
						<button class="discard">Descarto</button>
					</form>
				</div>
			</li>
		{/each}
	</ul>
{/if}

<style>
	.search {
		display: flex;
		gap: 16px;
		align-items: flex-start;
		flex-wrap: wrap;
	}
	.primary {
		background: var(--accent);
		color: var(--accent-text);
		border: 0;
		border-radius: 8px;
		padding: 10px 22px;
		font-weight: 600;
		display: inline-flex;
		align-items: center;
		gap: 8px;
		min-width: 150px;
		justify-content: center;
	}
	.primary:disabled {
		opacity: 0.85;
		cursor: progress;
	}
	.spinner {
		width: 14px;
		height: 14px;
		border: 2px solid currentColor;
		border-right-color: transparent;
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
	.chips {
		flex: 1;
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.chip {
		display: inline-flex;
		align-items: center;
		gap: 2px;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 999px;
		padding: 2px 4px 2px 10px;
		font-size: 13px;
	}
	.chip.manual {
		border-color: var(--accent);
	}
	.chip button {
		border: 0;
		background: none;
		color: var(--muted);
		padding: 0 4px;
	}
	.add input {
		font: inherit;
		font-size: 13px;
		border: 1px dashed var(--border);
		border-radius: 999px;
		padding: 3px 10px;
		background: transparent;
		color: var(--text);
		width: 130px;
	}
	.error {
		color: var(--danger);
		width: 100%;
		margin: 0;
	}
	.platforms {
		list-style: none;
		padding: 12px;
		margin: 16px 0 0;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 8px;
		display: grid;
		gap: 6px;
		font-size: 14px;
	}
	.platforms li {
		display: flex;
		align-items: center;
		gap: 10px;
		flex-wrap: wrap;
	}
	.platforms .ok::after {
		content: '✓';
		color: var(--ok);
		order: -1;
	}
	.platforms .pausada,
	.platforms .error {
		color: var(--warn);
	}
	.bar {
		width: 120px;
		height: 6px;
		background: var(--border);
		border-radius: 3px;
		overflow: hidden;
	}
	.bar span {
		display: block;
		height: 100%;
		background: var(--accent);
		transition: width 0.4s;
	}
	.count {
		margin-left: auto;
		color: var(--muted);
	}
	.filters {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px 16px;
		margin-top: 20px;
		font-size: 13px;
		color: var(--muted);
	}
	.filters label {
		display: inline-flex;
		align-items: center;
		gap: 6px;
	}
	.filters select {
		font: inherit;
		border: 1px solid var(--border);
		border-radius: 6px;
		padding: 4px 8px;
		background: var(--surface);
		color: var(--text);
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
	}
	.list li:first-child {
		border-top: 0;
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
	.title:visited {
		color: var(--muted);
	}
	.meta {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px 12px;
		font-size: 13px;
		color: var(--muted);
	}
	.list li {
		border-left: 4px solid var(--heat, transparent);
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
	.company {
		display: inline-flex;
		align-items: center;
		gap: 6px;
	}
	.block {
		border: 0;
		background: none;
		padding: 0;
		font-size: 12px;
		color: var(--muted);
		text-decoration: underline dotted;
	}
	.block:hover {
		color: var(--danger);
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
	.same {
		color: var(--muted);
	}
	.same.best {
		color: var(--accent);
		font-weight: 600;
	}
	.repeat {
		color: var(--warn);
		font-weight: 600;
	}
	.actions {
		display: flex;
		gap: 6px;
	}
	.actions button {
		border-radius: 6px;
		padding: 6px 12px;
		font-size: 13px;
		border: 1px solid var(--border);
		background: transparent;
		color: var(--text);
	}
	.actions .apply:hover {
		border-color: var(--ok);
		color: var(--ok);
	}
	.actions .discard:hover {
		border-color: var(--danger);
		color: var(--danger);
	}
	@media (max-width: 600px) {
		.list li {
			flex-direction: column;
			align-items: stretch;
		}
	}
</style>
