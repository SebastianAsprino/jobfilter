# Changelog

Todos los cambios relevantes del proyecto se documentan aquí. El formato sigue
[Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y el proyecto usa
[Versionado Semántico](https://semver.org/lang/es/).

## [Sin publicar]

## [0.10.0] - 2026-10-29

### Agregado

- **Pestaña Aplicadas.** Las vacantes marcadas con *Apliqué* desaparecían sin dejar rastro.
  Ahora quedan en su propia pestaña, de la más reciente a la más vieja, con la fecha en que
  aplicaste y su encaje con tu perfil. Tiene un buscador (cargo, empresa, ciudad o tecnología,
  sin importar tildes, en el título y la descripción) y filtros por plataforma y por cuándo
  aplicaste, que viven en la URL (`/aplicadas?q=nestjs&plataforma=getonbrd&dias=30`).
  **Deshacer** devuelve la vacante a la lista si la marcaste sin querer.
  Gracias a [@BrayanGuti](https://github.com/BrayanGuti) ([#16](https://github.com/SebastianAsprino/jobfilter/pull/16)).

## [0.9.0] - 2026-10-26

### Agregado

- **Lista negra para empresas confidenciales.** Las vacantes sin empresa ("Empresa
  confidencial", "Importante empresa del sector") quedaban fuera de la regla de
  republicaciones. Ahora se agrupan por la descripción: son la misma vacante si la descripción
  es ≥ 90% igual, o si tienen el mismo título y una descripción ≥ 60% igual (el título solo no
  alcanza, porque muchas empresas distintas publican "Desarrollador Backend" sin dar su
  nombre). Cuando una se publica más de una vez queda bajo un publicador `Empresa
  confidencial: "<título>"`, con el aviso ⟲, la lista negra a las 3 publicaciones en 3 meses,
  Bloquear y lista blanca, como cualquier empresa.

## [0.8.1] - 2026-10-26

### Cambiado

- **Torre queda descartada.** Torre ya hace lo mismo que JobFilter: analiza tu CV y te filtra
  las vacantes según tu perfil. Además, buena parte de su listado se indexa de otros portales
  (en la práctica parece un envoltorio de LinkedIn, que ya está integrado), así que traería
  sobre todo vacantes repetidas. Lo que se investigó (sitemaps, API de reclutadores, API para
  profesionales en private beta) queda en `docs/plataformas.md`.

## [0.8.0] - 2026-10-26

### Agregado

- Integración con **Talently** por la API pública que usa su página de trabajos. Como tiene
  pocas vacantes activas (unas 40), trae el listado completo en **una sola petición** por
  búsqueda, para todas las palabras clave, y lo filtra por palabra clave (título, rol y
  tecnologías) y ubicación: remoto global, remoto local en tu país, o presencial/híbrido en tu
  ciudad. El listado ya trae la fecha exacta, la empresa y las responsabilidades y requisitos,
  así que no pide el detalle de cada vacante.

## [0.7.0] - 2026-10-26

### Agregado

- Integración con **Magneto365** (Colombia) por la API pública que usa el sitio, porque sus
  páginas de búsqueda responden 504. Busca remoto en Colombia y presencial o híbrido en tu
  ciudad, de la vacante más nueva a la más vieja, con la fecha exacta. El listado ya trae la
  descripción completa, así que no pide el detalle de cada vacante. Quita del título el código
  interno que agregan algunas agencias ("Desarrollador/a PHP 1626256994-158"), para que una
  republicación se reconozca.

## [0.6.1] - 2026-10-24

### Agregado

- **Filtros en la lista de vacantes**: por plataforma (con el número de vacantes de cada una)
  y por antigüedad (hoy, últimos 3 días, última semana, 15 días, último mes). Viven en la URL
  (`/?plataforma=linkedin&dias=7`), se pueden combinar y "Quitar filtros" los limpia. La marca
  "la mejor de la empresa" se sigue calculando con todas las vacantes de la empresa.
  Gracias a [@BrayanGuti](https://github.com/BrayanGuti) ([#10](https://github.com/SebastianAsprino/jobfilter/pull/10)).

## [0.6.0] - 2026-10-23

### Agregado

- Integración con **Hireline** (Colombia y México). Como tiene pocas vacantes activas por país
  (unas 30 en Colombia), trae el listado completo una vez por búsqueda, en páginas de 12, y lo
  filtra por palabra clave (título y resumen) y ubicación: remoto abierto a tu país o a LATAM,
  o presencial/híbrido en tu ciudad. Del JSON-LD de cada vacante nueva toma el título y la
  empresa por separado, la fecha exacta y la descripción completa. Si el sitio repitiera una
  página, deja de paginar.

## [0.5.1] - 2026-10-22

### Agregado

- **Freno para LinkedIn**: apretar Buscar muchas veces ya no se traduce en muchas peticiones.
  Hay al menos 30 minutos entre corridas de LinkedIn (`minGapMinutes`); mientras tanto se
  muestra en pausa y las demás plataformas buscan normal. Además, cada palabra clave se busca
  en LinkedIn como mucho una vez por semana (`refreshEveryHours`): las primeras búsquedas
  avanzan con las palabras pendientes y, cuando ya están todas, LinkedIn no recibe peticiones
  hasta que se cumpla la semana.

### Corregido

- **LinkedIn dejaba de responder (429) a las pocas peticiones.** El bloqueo es por volumen de
  peticiones por IP, no por velocidad, y lo que más cargaba era pedir el detalle de cada
  vacante. Ahora:
  - el detalle se pide solo si el título de la tarjeta menciona alguna palabra clave del
    perfil (`prefilterByTitle`);
  - el cupo de 25 peticiones por búsqueda es un tope duro: cuenta las páginas de búsqueda y
    los reintentos (antes podía llegar a 28, o a 40 con reintentos);
  - ante un 429 espera 75 segundos y reintenta una sola vez para terminar lo que estaba en
    curso, deja registrada una pausa corta y corta la búsqueda. Si la plataforma ya venía de un
    bloqueo, no reintenta. El aviso se guarda antes de esperar, así un Ctrl+C no lo borra;
  - **redirigir al muro de login** (authwall) cuenta como bloqueo: antes se tomaba como "sin
    resultados", seguía pidiendo y marcaba las palabras como buscadas. LinkedIn ya no sigue
    redirecciones (`blockRedirects`);
  - los bloqueos "silenciosos" (200 sin contenido) también frenan: dos detalles sin
    descripción en la misma búsqueda, o tres palabras seguidas sin ninguna tarjeta, cuentan
    como bloqueo antes de marcar palabras como buscadas;
  - 451 también cuenta como bloqueo, y cualquier otro error que corte la búsqueda de LinkedIn
    la pausa (`pauseOnErrors`); en el detalle solo se ignoran el 404 y el 410;
  - las pausas suben de a poco: 30 minutos, 2 horas, 8 horas y 1 día (`pauseMinutes`,
    reemplaza a `pauseHours`). Una búsqueda que sale bien baja un solo escalón, y solo si el
    último bloqueo fue hace más de un día: un bloqueo y un éxito alternados ya no dejan la
    escalera siempre abajo;
  - no le manda cookies (`cookies: false`), como JobSpy;
  - vuelve a un ritmo normal de 4 a 8 segundos, medidos desde que llega cada respuesta.
- **Palabras clave sin cursor buscaban solo los últimos días.** Una palabra que nunca se había
  buscado tomaba como referencia la última corrida de la plataforma aunque la hubiera cortado
  el cupo, y perdía su ventana de 3 meses. Ahora cada palabra usa solo su propio cursor.
- **Una palabra cortada por el cupo podía no completarse nunca.** Las palabras se ordenaban al
  azar; ahora el orden es estable y la que quedó a medias se retoma primero, aprovechando los
  detalles que ya están en caché.
- **Dos búsquedas a la vez** (la app y la terminal) podían pasar las dos el intervalo de 30
  minutos: registrar la corrida ahora es atómico y el intervalo se mide desde el final de la
  anterior. SQLite espera hasta 5 segundos si la base está ocupada, en vez de fallar.
- Quitar todas las palabras clave ya no rompe la búsqueda, y una recarga en caliente de la app
  en desarrollo no pierde el progreso.

## [0.5.0] - 2026-10-20

### Agregado

- Integración con **PeakU** por la API pública que usa su sitio. Como tiene pocas vacantes
  activas (decenas), trae el listado completo una vez por búsqueda y lo filtra por palabra
  clave (título y habilidades) y ubicación; la descripción sale del JSON-LD de cada vacante
  nueva. La fecha es la de la última activación: si la empresa reactiva una vacante, cuenta
  como republicación.

### Cambiado

- **Torre** queda fuera por ahora: cerró su búsqueda pública (el endpoint que usaba la
  comunidad responde 400 y su web nueva exige sesión) y su API oficial está en private beta
  con claves. Documentado en `docs/plataformas.md`.

## [0.4.0] - 2026-10-19

### Agregado

- Integración con **elempleo** (Colombia) por la API JSON que usa el propio sitio: busca remoto
  y en tu ciudad con filtros de modalidad, ciudad y fecha, 100 vacantes por página. La
  descripción viene completa en el listado, así que no pide detalle por vacante.
- El cliente HTTP guarda las **cookies de la sesión anónima** que manda cada sitio y las
  devuelve durante la misma búsqueda (elempleo las necesita junto a su token).

### Corregido

- El detector de captcha confundía un formulario con reCAPTCHA dentro de una página normal con
  un desafío. Ahora reCAPTCHA y hCaptcha solo cuentan en páginas cortas, como son los desafíos
  reales; las marcas de Cloudflare siguen contando siempre.

## [0.3.0] - 2026-10-19

### Agregado

- Integración con **LinkedIn Empleos** por el endpoint público de invitados: sin login ni
  cookies, así que no hay cuenta que se pueda bloquear. Busca remoto en tu país y en tu
  ciudad, y pide la descripción completa (con nivel y tipo de empleo) solo de las vacantes
  nuevas.
- **Cupo de peticiones por búsqueda** (`maxRequestsPerRun`) para plataformas que limitan
  mucho: LinkedIn hace 25 por búsqueda, con pausas de 15 a 25 segundos, y cada búsqueda
  avanza unas palabras clave.
- **Pausa por bloqueo configurable por plataforma** (`pauseHours`): LinkedIn se pausa 2 horas,
  porque su límite se resetea en minutos; las demás siguen en 24.
- **Cursor por palabra clave**: cada palabra recuerda cuándo se buscó completa, así una
  búsqueda cortada por el cupo sigue la próxima vez desde donde quedó.
- **Caché de detalles**: la descripción de cada vacante se pide una sola vez, aunque se
  descarte, y los filtros se vuelven a aplicar sobre la copia guardada.
- **Filtro de idioma** por la descripción, para todas las plataformas: si tu perfil solo acepta
  español, se descartan las vacantes en inglés aunque la plataforma no diga el idioma.
- LinkedIn bloquea con el código propio `999`: ahora también pausa la plataforma.

## [0.2.0] - 2026-10-17

### Agregado

- Integración con **Computrabajo**: busca en tu ciudad y en remoto con cada palabra clave, usa
  el filtro de fecha del sitio en las búsquedas incrementales y trae la descripción completa
  solo de las vacantes nuevas. Elige el sitio según el país del perfil (Colombia, México,
  Perú, Argentina, Chile y otros 12 países de Latinoamérica).
- Computrabajo busca por sinónimos ("tech lead" trae "Líder técnico de instalaciones"): sus
  vacantes solo se guardan si el título o la descripción mencionan el término (sus palabras en
  orden y cerca). Los adapters que buscan así lo declaran con `looseSearch`.
- Las empresas confidenciales de Computrabajo ("Importante empresa del sector") no se guardan
  como empresa, para no mezclarlas en la lista negra.
- Los adapters pueden pedir el detalle de una vacante (`fetchDetail`) cuando el listado no trae
  la descripción; la búsqueda lo hace solo para las vacantes que no están en la base.
- Fechas como las muestran los portales: "Hace 3 horas", "Ayer", "14 de septiembre" y "Más de
  30 días". Las que son solo un tope ("Más de 30 días") se marcan como aproximadas y no cuentan
  como republicación.
- Tests de los parsers con `bun test`, contra respuestas reales guardadas en `fixtures/`. El CI
  también los corre.

### Cambiado

- La lista se ordena por compatibilidad con tu perfil (100% primero) y, a igual porcentaje, por
  fecha de publicación, sin importar la plataforma. Las vacantes sin tecnologías reconocidas
  van al final.

## [0.1.0] - 2026-10-14

Primera versión.

### Agregado

- Botón **Buscar**: busca con las palabras clave del perfil, desde hoy hasta 3 meses atrás, y
  después solo lo nuevo. Pausas aleatorias entre peticiones y pausa automática de una
  plataforma ante un bloqueo (429, 403 o captcha).
- Integración con **GetOnBoard** (API pública), filtrando por país, ciudad e idioma del
  perfil.
- Lista de vacantes con **Apliqué** y **Descarto**, y página **Descartadas** para retomarlas.
- **Lista negra automática**: la misma vacante publicada 3 o más veces en 3 meses, reconocida
  por título o por similitud de la descripción. Aviso ⟲ desde la segunda publicación.
- **Bloquear empresa** a mano y **lista blanca**.
- **Mapa de calor** según `profile/skills.json`, con la mejor vacante de cada empresa marcada
  con ★.
- Perfil portable en `profile/` y prompts para generarlo desde un CV.
- SQLite con Drizzle ORM: `bun:sqlite` con Bun y `better-sqlite3` con Node, elegido al
  arrancar.
- Modo oscuro automático.

[Sin publicar]: https://github.com/SebastianAsprino/jobfilter/compare/v0.10.0...HEAD
[0.10.0]: https://github.com/SebastianAsprino/jobfilter/compare/v0.9.0...v0.10.0
[0.9.0]: https://github.com/SebastianAsprino/jobfilter/compare/v0.8.1...v0.9.0
[0.8.1]: https://github.com/SebastianAsprino/jobfilter/compare/v0.8.0...v0.8.1
[0.8.0]: https://github.com/SebastianAsprino/jobfilter/compare/v0.7.0...v0.8.0
[0.7.0]: https://github.com/SebastianAsprino/jobfilter/compare/v0.6.1...v0.7.0
[0.6.1]: https://github.com/SebastianAsprino/jobfilter/compare/v0.6.0...v0.6.1
[0.6.0]: https://github.com/SebastianAsprino/jobfilter/compare/v0.5.1...v0.6.0
[0.5.1]: https://github.com/SebastianAsprino/jobfilter/compare/v0.5.0...v0.5.1
[0.5.0]: https://github.com/SebastianAsprino/jobfilter/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/SebastianAsprino/jobfilter/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/SebastianAsprino/jobfilter/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/SebastianAsprino/jobfilter/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/SebastianAsprino/jobfilter/releases/tag/v0.1.0
