<div align="center">

# JobFilter

**Tu búsqueda diaria de empleo, en un botón.**

Busca vacantes en los portales de empleo de Latinoamérica, saca de tu lista a las empresas
que reciclan la misma oferta para juntar CVs, y pinta cada vacante según cuánto encaja con
tu perfil. Corre en tu máquina y nunca inicia sesión en ninguna plataforma.

[![CI](https://github.com/SebastianAsprino/jobfilter/actions/workflows/ci.yml/badge.svg)](https://github.com/SebastianAsprino/jobfilter/actions/workflows/ci.yml)
[![Licencia: MIT](https://img.shields.io/badge/licencia-MIT-blue.svg)](LICENSE)
[![Bun](https://img.shields.io/badge/Bun-1.4+-000?logo=bun&logoColor=white)](https://bun.sh)
[![SvelteKit](https://img.shields.io/badge/SvelteKit-2-FF3E00?logo=svelte&logoColor=white)](https://svelte.dev)
[![Drizzle ORM](https://img.shields.io/badge/Drizzle_ORM-SQLite-C5F74F?logo=drizzle&logoColor=black)](https://orm.drizzle.team)
[![PRs bienvenidos](https://img.shields.io/badge/PRs-bienvenidos-brightgreen.svg)](CONTRIBUTING.md)

[English](README.en.md) · [Cómo funciona](docs/como-funciona.md) · [Plataformas](docs/plataformas.md) · [Contribuir](CONTRIBUTING.md)

</div>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/assets/lista-oscuro.png">
  <img alt="Lista de vacantes de JobFilter: cada fila tiene una franja de color según el encaje con el perfil, las tecnologías que se tienen en verde y las que faltan en rojo, y los botones Apliqué y Descarto." src="docs/assets/lista-claro.png">
</picture>

## ¿Por qué?

Buscar empleo a mano es repetir lo mismo todos los días: escribir "fullstack", "backend",
"typescript"… en cada portal, revisar vacantes que ya viste, y caer una y otra vez en las de
empresas que publican la misma oferta cada mes sin contratar a nadie.

JobFilter hace esa parte por ti. Tú solo decides a cuáles aplicar.

## Características

- 🔎 **Un botón, todas las plataformas.** Busca con tus palabras clave en cada portal, desde
  hoy hasta 3 meses atrás, y después solo trae lo nuevo.
- 🚫 **Lista negra automática.** Si una empresa publica la misma vacante 3 o más veces en 3
  meses, desaparece de tu lista, con el motivo y la evidencia a la vista. Reconoce la misma
  vacante aunque cambien el título o retoquen el texto.
- 🌡️ **Mapa de calor.** Cada vacante tiene un color según qué parte de lo que pide tienes:
  verde, naranja o rojo, y la lista se ordena de la más compatible a la menos. Ves de un
  vistazo qué tecnologías tienes y cuáles te faltan.
- ⭐ **Una por empresa.** Si una empresa tiene varias vacantes en tu lista, marca la que mejor
  encaja contigo.
- ✋ **Tú decides.** Apliqué, Descarto, Bloquear empresa, lista blanca y retomar descartadas.
- 📋 **Tus aplicaciones.** Las vacantes a las que aplicaste quedan en su pestaña, con buscador
  y filtros por plataforma y fecha.
- 🔒 **Local y sin login.** Tus datos quedan en un SQLite en tu máquina. El script nunca usa
  tu cuenta, así que no hay cuenta que bloquear.
- 🌗 **Modo oscuro** automático según tu sistema.

## Plataformas

| | Plataforma | |
|---|---|---|
| ✅ | GetOnBoard | Integrada |
| ✅ | Computrabajo | Integrada, en 17 países de Latinoamérica |
| ✅ | LinkedIn | Empleos, sin login |
| ✅ | elempleo | Integrada (Colombia) |
| ✅ | PeakU | Integrada |
| ✅ | Hireline | Integrada (Colombia y México) |
| ✅ | Magneto365 | Integrada (Colombia) |
| ✅ | Talently | Integrada |
| 🚫 | Torre | Descartada: ya filtra vacantes según tu CV y muchas vienen de otros portales |

El estado de cada una, lo que se sabe de cómo integrarla y la guía para agregar una nueva
están en [docs/plataformas.md](docs/plataformas.md). **Es la mejor forma de contribuir.**

## Inicio rápido

Necesitas [Bun](https://bun.sh) 1.4+ (o Node 22+, ver [Comandos](#comandos)).

```sh
git clone https://github.com/SebastianAsprino/jobfilter.git
cd jobfilter
bun install
cp -r profile.example profile   # perfil de ejemplo; genera el tuyo con docs/perfil.md
bun run dev                     # abre la app en el navegador
```

Presiona **Buscar**. La primera búsqueda trae los últimos 3 meses y tarda unos minutos; las
siguientes, segundos.

## Tu perfil

Todo lo personal vive en la carpeta `profile/`, que no se sube a git:

| Archivo | Para qué sirve |
|---|---|
| `keywords.json` | Las búsquedas que corre el botón (cargos y tecnologías). |
| `skills.json` | Las tecnologías que tienes y las que no. De aquí sale el color de cada vacante. |
| `location.json` | Tu país, tu ciudad y los idiomas en que aceptas vacantes. |

En [docs/perfil.md](docs/perfil.md) hay un prompt listo para generar los tres archivos a
partir de tu CV con cualquier asistente de IA (Claude, ChatGPT, Gemini…). La app en sí no usa
IA.

## Comandos

| Comando | Qué hace |
|---|---|
| `bun run dev` | Arranca la app con Bun (usa `bun:sqlite`) y abre el navegador. |
| `bun run dev:node` | Igual, con Node (usa `better-sqlite3`). |
| `bun run buscar` | La misma búsqueda del botón, desde la terminal. |
| `bun run test` | Tests de los parsers contra respuestas reales guardadas. |
| `bun run check` | Revisa los tipos. |
| `bun run db:generate` | Genera una migración después de cambiar el esquema. |

## Documentación

- [Cómo funciona](docs/como-funciona.md): la búsqueda, el mapa de calor y las reglas de la
  lista negra.
- [Tu perfil](docs/perfil.md): los prompts para generarlo desde tu CV.
- [Plataformas](docs/plataformas.md): estado de cada una y cómo agregar una nueva.
- [Arquitectura](docs/arquitectura.md): slices verticales con CQRS, Drizzle y la base de
  datos.

## Hoja de ruta

- [x] Búsqueda incremental de 3 meses con pausas y detección de bloqueos
- [x] Lista negra automática, bloqueo manual y lista blanca
- [x] Mapa de calor según tu perfil
- [x] Integración con GetOnBoard
- [x] Computrabajo (17 países)
- [x] LinkedIn Empleos (sin login)
- [ ] Publicaciones de LinkedIn ("estamos contratando")
- [x] elempleo
- [x] PeakU
- [x] Hireline
- [x] Magneto365
- [x] Talently
- [x] Lista negra para empresas confidenciales (agrupadas por descripción)

## Contribuir

¡Las contribuciones son bienvenidas! Lee [CONTRIBUTING.md](CONTRIBUTING.md) para preparar el
entorno y conocer las convenciones. Si quieres integrar una plataforma, abre primero un issue
con la plantilla **Nueva plataforma**.

Este proyecto sigue un [Código de Conducta](CODE_OF_CONDUCT.md). Para reportar una
vulnerabilidad, ver [SECURITY.md](SECURITY.md).

## Aviso

Algunas plataformas prohíben el scraping en sus términos de uso. JobFilter está pensado para
uso personal: pocas peticiones, pausas entre ellas, sin iniciar sesión y sin redistribuir
datos. Úsalo bajo tu propia responsabilidad.

## Licencia

[MIT](LICENSE) © Sebastian Asprino
