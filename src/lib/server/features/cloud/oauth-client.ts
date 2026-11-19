/**
 * Cliente OAuth de JobFilter, tipo "App de escritorio". Va en el código a propósito: en una app
 * que corre en la máquina de cada quien, Google no trata este secreto como secreto
 * (https://developers.google.com/identity/protocols/oauth2/native-app). Lo que protege la
 * conexión es PKCE y que Google solo devuelve el código a localhost.
 *
 * GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET en .env lo reemplazan, para quien quiera usar el suyo.
 * Cómo crearlo: docs/nube.md.
 */
export const GOOGLE_CLIENT = {
	id: '',
	secret: ''
};
