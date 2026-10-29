# Respaldo en la nube

JobFilter guarda todo en tu máquina: `data/jobfilter.db` (vacantes nuevas, aplicadas y
descartadas, lista negra y blanca, palabras clave) y `profile/` (tu perfil). La pestaña
**Nube** sube una copia de los dos a **tu propia cuenta de Google Drive**, para no perderlos si
cambias de computador o se daña el disco.

- **Cada quien en su cuenta.** No hay servidor de JobFilter en el medio: la app habla
  directo con Google desde tu máquina.
- **Solo una carpeta oculta.** Se pide el permiso `drive.appdata`, que da acceso únicamente a
  una carpeta privada de la app. JobFilter no puede ver ni tocar el resto de tu Drive, y esa
  carpeta tampoco aparece entre tus archivos.
- **El token se queda contigo**, en `data/nube.json` (fuera de git).

## Uso

1. Abre la pestaña **Nube** y toca **Sincronizar** (o **Iniciar sesión con Google**).
2. Se abre Google en otra pestaña. Elige tu cuenta y acepta el permiso. La pestaña se cierra sola
   y JobFilter sigue donde estaba: si tocaste Sincronizar, sincroniza de una vez.
3. Desde ahí, cada vez que toques **Sincronizar** se suben todos los cambios de este computador
   (vacantes, listas, palabras clave y perfil) y reemplazan el respaldo anterior.

No hay que tocar `.env` ni crear nada en Google Cloud: la app ya trae su cliente de Google.

- **Si el respaldo cambió desde otro computador** después de tu última sincronización (o este
  computador nunca ha sincronizado y ya hay uno), Sincronizar no lo pisa: te pregunta si
  **traer lo de Drive** o **reemplazarlo con lo de este computador**.
- **Restaurar desde Drive** reemplaza lo de este computador por el respaldo. El perfil se
  cambia de una vez; la base se cambia la próxima vez que arranques la app, porque no se puede
  reemplazar mientras está abierta. Lo que había queda en `data/jobfilter.db.antes-de-restaurar`
  y `data/profile-antes-de-restaurar/`.
- **Cerrar sesión** revoca el permiso. El respaldo sigue en tu Drive; para borrarlo, en
  [drive.google.com](https://drive.google.com) → ⚙ Configuración → **Administrar apps** →
  JobFilter → **Borrar datos ocultos de la app**.

En un computador nuevo: instala JobFilter, toca **Sincronizar**, inicia sesión con la misma cuenta
y elige **Traer lo de Drive**.

## El cliente de Google (para quien mantiene el proyecto)

Google exige que cada app tenga un cliente OAuth. JobFilter trae uno en
`src/lib/server/features/cloud/oauth-client.ts`, de tipo **App de escritorio**: en apps que
corren en la máquina de cada quien, Google no trata su secreto como secreto
([docs](https://developers.google.com/identity/protocols/oauth2/native-app)); la conexión la
protegen PKCE y que Google solo devuelve el código a `localhost`. Los clientes de escritorio
aceptan cualquier puerto de `localhost`, así que no hay que registrar la URI de redirección.

Para crearlo (una sola vez, lo hace quien publica JobFilter):

1. En [console.cloud.google.com](https://console.cloud.google.com) crea un proyecto
   (por ejemplo, `jobfilter`).
2. **APIs y servicios → Biblioteca**: habilita **Google Drive API**.
3. **Google Auth Platform → Branding**: nombre de la app y correo de contacto. Público:
   **Externo**. En **Acceso a los datos** agrega el permiso `.../auth/drive.appdata`.
4. **Público → Publicar app**, para que no venza a los 7 días ni quede limitado a usuarios de
   prueba. Hasta que Google la verifique, al iniciar sesión sale el aviso de app no verificada
   (**Avanzado → Ir a JobFilter**).
5. **Clientes → Crear cliente**, tipo **App de escritorio**. Copia el ID y el secreto a
   `oauth-client.ts`.

Quien prefiera usar su propio cliente puede ponerlo en `.env`, que tiene prioridad:

```sh
GOOGLE_CLIENT_ID=1234567890-xxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxx
```

## Cómo está hecho

Slice `src/lib/server/features/cloud/`:

```
oauth-client.ts     el cliente de Google que trae la app
google-drive.ts     OAuth (con PKCE) y la API de archivos de Drive, con fetch
snapshot.ts         copia de la base con VACUUM INTO (consistente aunque esté en modo WAL) y de profile/
settings.ts         data/nube.json: la cuenta, la última sincronización y la versión del respaldo
pending.ts          el estado de OAuth entre Iniciar sesión y la vuelta desde Google
commands/  start-connection, finish-connection, sync-cloud, restore-backup, disconnect-cloud
queries/   get-cloud-status
```

El inicio de sesión va en otra pestaña: `/nube/conectar` arma el enlace a Google y
`/nube/callback` recibe la vuelta, guarda la cuenta, avisa a `/nube` por un `BroadcastChannel` y se
cierra. Para saber si otro computador subió algo, se guarda el `modifiedTime` que Drive le da a
`jobfilter.db` en cada sincronización y se compara con el actual antes de subir.

En Drive quedan dos archivos: `jobfilter.db` (la base tal cual) y `profile.json` (los archivos
de `profile/` en un solo JSON). `db/client.ts` aplica la restauración pendiente
(`data/restaurar.db`) antes de abrir la base; las migraciones corren después, así que un
respaldo de una versión anterior se pone al día solo.

Para sumar otro proveedor (Dropbox, OneDrive) hace falta otro archivo con las mismas funciones
(`authUrl`, `exchangeCode`, `putFile`, `getFile`, `fileVersion`, `revoke`) y que los comandos
elijan según `provider` en `data/nube.json`. La copia y la restauración no cambian.
