type PendingConnection = { state: string; verifier: string; redirectUri: string };

// Solo dura entre el clic en Conectar y la vuelta desde Google; no hace falta guardarlo en disco.
let current: PendingConnection | null = null;

export const pending = {
	set(connection: PendingConnection) {
		current = connection;
	},
	take(state: string | null): PendingConnection {
		const connection = current;
		current = null;
		if (!connection || connection.state !== state) {
			throw new Error('La conexión expiró o no coincide. Vuelve a tocar Conectar.');
		}
		return connection;
	}
};
