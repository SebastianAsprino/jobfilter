<script lang="ts">
	import { enhance } from '$app/forms';
	import PlatformBadge from '#lib/PlatformBadge.svelte';

	let { data } = $props();
</script>

<p class="muted intro">
	Vacantes que descartaste. <strong>Retomar</strong> la devuelve a la lista y, si ese descarte había
	mandado a la empresa a la lista negra, la saca de ahí.
</p>

{#if data.discarded.length === 0}
	<p class="empty">No has descartado ninguna vacante.</p>
{:else}
	<ul class="list">
		{#each data.discarded as p (p.id)}
			<li>
				<div class="info">
					<a href={p.url} target="_blank" rel="noopener noreferrer" class="title">{p.title}</a>
					<div class="meta">
						<PlatformBadge id={p.platform} />
						<span>{p.company ?? 'Empresa confidencial'}</span>
						<span>publicada {p.publishedAt.slice(0, 10)}</span>
						<span>descartada {p.statusAt?.slice(0, 10)}</span>
						{#if p.blacklisted}<span class="tag">mandó a la empresa a lista negra</span>{/if}
					</div>
				</div>
				<form method="POST" action="?/retomar" use:enhance>
					<input type="hidden" name="id" value={p.id} />
					<button>Retomar</button>
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
	.meta {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px 12px;
		font-size: 13px;
		color: var(--muted);
	}
	.tag {
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
	}
</style>
