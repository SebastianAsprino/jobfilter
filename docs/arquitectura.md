# Arquitectura

JobFilter es una app SvelteKit que corre en tu máquina, con SQLite como base de datos. El
código del servidor está organizado en **slices verticales** con **CQRS**.

## Slices verticales + CQRS

Cada funcionalidad (feature) tiene su carpeta. Dentro, los **comandos** (cambian datos)
están separados de las **consultas** (solo leen). Cada archivo exporta una sola función con
el mismo nombre que el archivo.

```
src/lib/server/
  db/
    client.ts          elige el driver según el runtime y aplica las migraciones
    schema.ts          tablas (Drizzle)
  shared/
    http.ts            cliente HTTP: pausas aleatorias, reintentos, cookies de sesión anónima,
                       detección de bloqueos
    normalize.ts       normalización de textos, títulos, empresas y entidades HTML
    profile.ts         lectura de profile/
    language.ts        idioma de una descripción (es / en)
    relative-date.ts   "Hace 3 días" → fecha
  features/
    search/
      commands/start-search.ts           el botón Buscar
      queries/get-search-progress.ts     el avance que muestra la página
      adapters/                          una plataforma por archivo, con sus tests
      run-log.ts, detail-cache.ts, state.ts   internos del slice
    postings/
      commands/  save-posting, mark-applied, discard-posting, retake-posting
      queries/   list-new-postings, list-discarded, count-discarded, count-new-by-platform,
                 posting-exists
    companies/
      commands/  recalculate-blacklist, block-company, whitelist-company, unlist-company
      queries/   list-companies, count-blacklisted
    keywords/
      commands/  import-keyword-seed, add-keyword, disable-keyword
      queries/   list-keywords
    match/
      queries/   match-posting
src/routes/
  +page.svelte             lista de vacantes y botón Buscar
  descartadas/             vacantes descartadas (retomar)
  lista-negra/             lista negra y lista blanca
  api/buscar/+server.ts    arrancar la búsqueda y consultar su avance
src/hooks.server.ts        al arrancar, importa profile/keywords.json
scripts/buscar.ts          la búsqueda desde la terminal
drizzle/                   migraciones
```

Reglas:

- Las rutas de SvelteKit solo llaman a **un** comando o consulta. No hay lógica en las rutas.
- Un comando puede llamar a otro cuando el efecto es parte del mismo caso de uso (por ejemplo,
  `discardPosting` llama a `recalculateBlacklist`).
- Las consultas no escriben.
- Lo que solo usa un slice vive dentro del slice. Lo que usan varios va a `shared/`.

## Base de datos

SQLite con [Drizzle ORM](https://orm.drizzle.team). `db/client.ts` detecta el runtime al
arrancar:

| Runtime | Driver |
|---|---|
| Bun (`bun run dev`) | `bun:sqlite` (incluido en Bun) |
| Node (`bun run dev:node`) | `better-sqlite3` |

Los dos drivers son síncronos, así que el resto del código usa la misma API (`.all()`,
`.get()`, `.run()`). La base vive en `data/jobfilter.db` y las migraciones de `drizzle/` se
aplican solas al arrancar.

Para cambiar el esquema: edita `src/lib/server/db/schema.ts` y corre `bun run db:generate`.

### Tablas

```
companies     empresa normalizada + su lista (negra | blanca), motivo (JSON) y origen (auto | manual)
postings      cada vacante: plataforma, id externo, url, título, empresa, ubicación, descripción,
              fecha de publicación, estado (nueva | aplicada | descartada) y cuántas veces se publicó
publications  cada fecha de publicación distinta de una vacante (para detectar republicaciones)
keywords      palabras clave: las del perfil y las agregadas desde la app
keyword_cursors   hasta cuándo se buscó completa cada palabra en cada plataforma
detail_cache  descripción ya pedida de cada vacante, aunque se haya descartado
runs          cada búsqueda por plataforma: encontradas, nuevas, error
platforms     pausas por bloqueo de cada plataforma
```

## Búsqueda

`start-search` arranca una tarea en segundo plano que recorre todas las plataformas en
paralelo; dentro de cada una, las palabras clave van en secuencia y en orden aleatorio. El
avance se guarda en memoria (`state.ts`) y la página lo consulta cada segundo por
`/api/buscar`.

Cada plataforma es un **adapter** que solo traduce su formato a `RawPosting` y aplica el
filtro de ubicación e idioma. Si su listado no trae la descripción, implementa `fetchDetail`
y la búsqueda lo llama solo para las vacantes nuevas. Todo lo demás (guardar, deduplicar,
lista negra) es común. Ver [plataformas.md](plataformas.md) para agregar una.

## Tests

`bun run test` corre los tests de los parsers (`*.test.ts` junto a cada adapter) contra
respuestas reales guardadas en `fixtures/<plataforma>/`. No hacen peticiones a las
plataformas. El CI corre los tests y la revisión de tipos en cada PR.

## Filtros de la lista

La lista principal se filtra por plataforma y por antigüedad con parámetros de la URL
(`?plataforma=linkedin&dias=7`). `src/lib/filters.ts` define las opciones y `parseFilters`, que
ignora los valores que no reconoce; `+page.server.ts` los lee y se los pasa a
`listNewPostings`. Los filtros se aplican al final, después de calcular cuál es la mejor
vacante de cada empresa, para que esa marca no cambie según el filtro.

## Interfaz

Svelte 5 con runes y CSS propio, sin librerías de componentes. Los colores son variables CSS
con una versión clara y una oscura que sigue al sistema operativo. El color de cada
plataforma se define con un solo tono en `src/lib/platforms.ts`.
