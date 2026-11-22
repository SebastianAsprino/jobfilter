<script lang="ts">
	import { enhance } from '$app/forms';
	import PlatformBadge from '#lib/PlatformBadge.svelte';

	let { data } = $props();

	let tab = $state<'negra' | 'blanca'>('negra');
	const companies = $derived(tab === 'negra' ? data.negra : data.blanca);

	const STATUS: Record<string, string> = { nueva: '', aplicada: 'aplicaste', descartada: 'descartada' };

	const evidenceIds = (c: { reasons: { ids: number[] }[] }) => new Set(c.reasons.flatMap((r) => r.ids));
</script>

<div class="tabs" role="tablist">
	<button role="tab" aria-selected={tab === 'negra'} class:active={tab === 'negra'} onclick={() => (tab = 'negra')}>
		Lista negra · {data.negra.length}
	</button>
	<button role="tab" aria-selected={tab === 'blanca'} class:active={tab === 'blanca'} onclick={() => (tab = 'blanca')}>
		Lista blanca · {data.blanca.length}
	</button>
</div>

<p class="muted intro">
	{#if tab === 'negra'}
		Empresas que publicaron la misma vacante 3+ veces en 3 meses, o que bloqueaste a mano. Sus
		vacantes no aparecen en la lista.
	{:else}
		Empresas que nunca caen en la lista negra, aunque repitan vacantes.
	{/if}
</p>

{#if companies.length === 0}
	<p class="empty">
		{tab === 'negra' ? 'Ninguna empresa en lista negra todavía.' : 'Ninguna empresa en lista blanca.'}
	</p>
{:else}
	<ul class="companies">
		{#each companies as c (c.id)}
			{@const manualBlock = tab === 'negra' && c.listSource === 'manual'}
			<li>
				<div class="head">
					<div>
						<strong>{c.name}</strong>
						<span class="muted since">desde {c.listedAt?.slice(0, 10)}</span>
					</div>
					<form method="POST" action={tab === 'negra' && !manualBlock ? '?/blanca' : '?/quitar'} use:enhance>
						<input type="hidden" name="id" value={c.id} />
						<button>
							{manualBlock ? 'Desbloquear' : tab === 'negra' ? 'Pasar a lista blanca' : 'Quitar de lista blanca'}
						</button>
					</form>
				</div>

				{#if c.reasons.length}
					<ul class="reasons">
						{#each c.reasons as reason}<li>{reason.text}</li>{/each}
					</ul>
				{/if}

				<details>
					<summary class="muted">
						{c.postings.length} {c.postings.length === 1 ? 'vacante' : 'vacantes'}{c.listSource === 'auto' ? ' · ⟲ las que prueban el motivo' : ''}
					</summary>
					<ul class="postings">
						{#each c.postings as p (p.id)}
							<li class:evidence={evidenceIds(c).has(p.id)}>
								<PlatformBadge id={p.platform} />
								<a href={p.url} target="_blank" rel="noopener noreferrer">{p.title}</a>
								<span class="muted">{p.published}{STATUS[p.status] ? ` · ${STATUS[p.status]}` : ''}</span>
							</li>
						{/each}
					</ul>
				</details>
			</li>
		{/each}
	</ul>
{/if}

<style>
	.tabs {
		display: flex;
		gap: 6px;
	}
	.tabs button {
		border: 1px solid var(--border);
		background: transparent;
		color: var(--muted);
		border-radius: 999px;
		padding: 4px 14px;
		font-size: 14px;
	}
	.tabs button.active {
		background: var(--surface);
		color: var(--text);
		border-color: var(--accent);
	}
	.intro {
		font-size: 14px;
		margin: 12px 0;
	}
	.empty {
		padding: 40px 0;
		text-align: center;
		color: var(--muted);
	}
	.companies {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 10px;
	}
	.companies > li {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 8px;
		padding: 12px 14px;
	}
	.head {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 12px;
		flex-wrap: wrap;
	}
	.since {
		font-size: 13px;
		margin-left: 6px;
	}
	.head button {
		border: 1px solid var(--border);
		background: transparent;
		color: var(--text);
		border-radius: 6px;
		padding: 6px 12px;
		font-size: 13px;
	}
	.head button:hover {
		border-color: var(--ok);
		color: var(--ok);
	}
	.reasons {
		margin: 8px 0 4px;
		padding-left: 18px;
		font-size: 14px;
	}
	details {
		margin-top: 6px;
		font-size: 14px;
	}
	summary {
		cursor: pointer;
	}
	.postings {
		list-style: none;
		padding: 0;
		margin: 8px 0 0;
		display: grid;
		gap: 6px;
	}
	.postings li {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-wrap: wrap;
	}
	.postings a {
		color: var(--text);
	}
	.postings li.evidence::before {
		content: '⟲';
		color: var(--danger);
		font-weight: 700;
		width: 1em;
	}
	.postings li:not(.evidence)::before {
		content: '';
		width: 1em;
	}
</style>
