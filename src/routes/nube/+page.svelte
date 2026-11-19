<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';

	let { data, form } = $props();

	let busy = $state<string | null>(null);
	/** Qué hacer cuando la pestaña de Google avise que terminó: solo conectar, o conectar y sincronizar. */
	let waitingLogin = $state<'login' | 'sync' | null>(null);
	let loginError = $state<string | null>(null);
	let syncForm = $state<HTMLFormElement>();
	const error = $derived(loginError ?? form?.error);

	/** Deshabilita los botones mientras Google responde (subir la base puede tardar). */
	const track = (action: string) => () => {
		busy = action;
		loginError = null;
		return async ({ update }: { update: () => Promise<void> }) => {
			await update();
			busy = null;
		};
	};

	/** Abre Google en otra pestaña; /nube/callback avisa por el canal cuando vuelve. */
	function login(then: 'login' | 'sync') {
		loginError = null;
		waitingLogin = then;
		window.open('/nube/conectar', '_blank');
	}

	onMount(() => {
		const channel = new BroadcastChannel('jobfilter-nube');
		channel.onmessage = async ({ data: message }: MessageEvent<{ error: string | null }>) => {
			const then = waitingLogin;
			waitingLogin = null;
			loginError = message.error;
			await invalidateAll();
			if (!message.error && then === 'sync') {
				await tick();
				syncForm?.requestSubmit();
			}
		};
		return () => channel.close();
	});
</script>

<p class="muted intro">
	Guarda tu perfil, tus vacantes aplicadas y descartadas, la lista negra y tus palabras clave en
	<strong>tu propia cuenta de Google Drive</strong>, en una carpeta oculta que solo ve JobFilter. Así
	no lo pierdes si cambias de computador. No pasa por ningún servidor: va directo de tu máquina a tu
	Drive.
</p>

{#if !data.cloud.configured}
	<div class="card">
		<p>
			Esta copia de JobFilter no trae cliente de Google, así que no puede iniciar sesión. Los pasos
			para ponerle uno están en <code>docs/nube.md</code>.
		</p>
	</div>
{:else}
	<div class="card">
		<p>
			{#if data.cloud.connected}
				Sesión iniciada como <strong>{data.cloud.email ?? 'tu cuenta de Google'}</strong>.
				{#if data.cloud.lastSyncAt}
					Última sincronización: {new Date(data.cloud.lastSyncAt).toLocaleString('es')}.
				{:else}
					Este computador todavía no se ha sincronizado con tu Drive.
				{/if}
			{:else if waitingLogin}
				Termina de iniciar sesión en la pestaña de Google que se abrió.
			{:else}
				No has iniciado sesión. Al tocar un botón se abre Google en otra pestaña.
			{/if}
		</p>
		<div class="actions">
			<form
				method="POST"
				action="?/sincronizar"
				bind:this={syncForm}
				use:enhance={track('sincronizar')}
			>
				<button
					class="primary"
					disabled={busy !== null}
					onclick={(e) => {
						if (!data.cloud.connected) {
							e.preventDefault();
							login('sync');
						}
					}}
				>
					{busy === 'sincronizar' ? 'Sincronizando…' : 'Sincronizar'}
				</button>
			</form>
			{#if data.cloud.connected}
				<form method="POST" action="?/restaurar" use:enhance={track('restaurar')}>
					<button disabled={busy !== null}>
						{busy === 'restaurar' ? 'Bajando…' : 'Restaurar desde Drive'}
					</button>
				</form>
				<form method="POST" action="?/desconectar" use:enhance={track('desconectar')}>
					<button class="link" disabled={busy !== null}>Cerrar sesión</button>
				</form>
			{:else}
				<button disabled={busy !== null} onclick={() => login('login')}>
					Iniciar sesión con Google
				</button>
			{/if}
		</div>
		<p class="muted small">
			Sincronizar sube todo lo de este computador y reemplaza el respaldo. Restaurar hace lo
			contrario; lo que había queda guardado en <code>data/</code> por si te arrepientes.
		</p>
	</div>
{/if}

{#if data.cloud.restorePending}
	<p class="notice">
		Respaldo descargado y perfil restaurado. <strong>Reinicia la app</strong> (detén
		<code>bun run dev</code> y vuelve a correrlo) para cargar tus vacantes y listas.
	</p>
{/if}

{#if error}
	<p class="error">{error}</p>
	{#if form?.conflict}
		<div class="actions">
			<form method="POST" action="?/restaurar" use:enhance={track('restaurar')}>
				<button class="primary" disabled={busy !== null}>Traer lo de Drive</button>
			</form>
			<form method="POST" action="?/sincronizar" use:enhance={track('sincronizar')}>
				<input type="hidden" name="force" value="1" />
				<button disabled={busy !== null}>Reemplazarlo con lo de este computador</button>
			</form>
		</div>
	{/if}
{/if}

<style>
	.intro {
		font-size: 14px;
		margin: 0 0 12px;
	}
	.card {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 8px;
		padding: 14px 16px;
	}
	.card p {
		margin: 0 0 12px;
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		align-items: center;
		margin-bottom: 12px;
	}
	button {
		background: var(--surface);
		color: var(--text);
		border: 1px solid var(--border);
		border-radius: 8px;
		padding: 10px 16px;
	}
	button:disabled {
		opacity: 0.6;
		cursor: progress;
	}
	.primary {
		background: var(--accent);
		color: var(--accent-text);
		border: 0;
		font-weight: 600;
	}
	.link {
		background: none;
		border: 0;
		color: var(--danger);
	}
	.small {
		font-size: 13px;
		margin: 0;
	}
	.notice {
		margin-top: 12px;
		color: var(--warn);
	}
	.error {
		margin-top: 12px;
		color: var(--danger);
		overflow-wrap: anywhere;
	}
</style>
