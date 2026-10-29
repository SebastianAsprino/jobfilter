<div align="center">

# JobFilter

**Your daily job search, in one button.**

Searches Latin American job boards, drops companies that keep reposting the same opening to
harvest CVs, and color-codes every posting by how well it fits your profile. Runs on your
machine and never logs in to any platform.

[![CI](https://github.com/SebastianAsprino/jobfilter/actions/workflows/ci.yml/badge.svg)](https://github.com/SebastianAsprino/jobfilter/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Bun](https://img.shields.io/badge/Bun-1.4+-000?logo=bun&logoColor=white)](https://bun.sh)
[![SvelteKit](https://img.shields.io/badge/SvelteKit-2-FF3E00?logo=svelte&logoColor=white)](https://svelte.dev)
[![Drizzle ORM](https://img.shields.io/badge/Drizzle_ORM-SQLite-C5F74F?logo=drizzle&logoColor=black)](https://orm.drizzle.team)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

[Español](README.md) · [Contributing](CONTRIBUTING.md)

</div>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/assets/lista-oscuro.png">
  <img alt="JobFilter's posting list: each row has a color stripe showing profile fit, the technologies you have in green and the missing ones in red, plus Applied and Discard buttons." src="docs/assets/lista-claro.png">
</picture>

> The app UI and the detailed docs are in Spanish, since the target platforms and users are
> in Latin America. This page is an English overview.

## Why?

Searching for jobs by hand means doing the same thing every day: typing "fullstack",
"backend", "typescript"… into every job board, re-reading postings you've already seen, and
landing again and again on companies that post the same opening every month without hiring
anyone.

JobFilter does that part for you. You only decide where to apply.

## Features

- 🔎 **One button, every platform.** Searches each job board with your keywords, from today
  back to 3 months, then only fetches what's new.
- 🚫 **Automatic blacklist.** A company that posts the same opening 3+ times within 3 months
  disappears from your list, with the reason and the evidence shown. It recognizes the same
  opening even when the title changes or the text gets reworded.
- 🌡️ **Fit heat map.** Every posting gets a color based on how much of what it asks for you
  have: green, orange or red, and the list is sorted from best to worst fit. You see at a glance which technologies you have and which you
  lack.
- ⭐ **One per company.** When a company has several postings in your list, the best fit is
  starred.
- ✋ **You're in control.** Applied, Discard, Block company, whitelist and restore discarded
  postings.
- 📋 **Your applications.** Postings you applied to get their own tab, with search and
  filters by platform and date.
- 🔒 **Local, no login.** Your data stays in a SQLite file on your machine. The scraper never
  uses your account, so there's no account to get banned.
- 🌗 **Automatic dark mode.**

## Platforms

✅ GetOnBoard · ✅ Computrabajo (17 Latin American countries) · ✅ LinkedIn Jobs (no login) · ✅ elempleo (Colombia) · ✅ PeakU · ✅ Hireline · ✅ Magneto365 (Colombia) · ✅ Talently · 🚫 Torre (discarded: it already matches jobs to your CV, and many of its postings come from other boards)

See [docs/plataformas.md](docs/plataformas.md) (Spanish) for each platform's status, what's
known about integrating it, and a step-by-step guide to add a new one. **That's the best way
to contribute.**

## Quick start

Requires [Bun](https://bun.sh) 1.4+ (or Node 22+ via `bun run dev:node`).

```sh
git clone https://github.com/SebastianAsprino/jobfilter.git
cd jobfilter
bun install
cp -r profile.example profile   # example profile; build your own with docs/perfil.md
bun run dev                     # opens the app in your browser
```

Press **Buscar** (Search). The first search pulls the last 3 months and takes a few minutes;
later ones take seconds.

## Your profile

Everything personal lives in `profile/`, which is git-ignored:

| File | Purpose |
|---|---|
| `keywords.json` | The searches the button runs (job titles and technologies). |
| `skills.json` | Technologies you have and don't have. Drives each posting's color. |
| `location.json` | Your country, city and the languages you accept postings in. |

[docs/perfil.md](docs/perfil.md) has a ready-made prompt to generate all three files from
your CV with any AI assistant. The app itself doesn't use AI.

## Tech stack

SvelteKit 2 + Svelte 5, Bun, SQLite with Drizzle ORM (`bun:sqlite` on Bun, `better-sqlite3`
on Node, picked at startup), organized as vertical slices with CQRS. See
[docs/arquitectura.md](docs/arquitectura.md).

## Contributing

Contributions are welcome! Read [CONTRIBUTING.md](CONTRIBUTING.md). Issues and PRs in English
or Spanish are both fine.

## Disclaimer

Some platforms forbid scraping in their terms of service. JobFilter is meant for personal
use: few requests, pauses between them, no login and no data redistribution. Use it at your
own risk.

## License

[MIT](LICENSE) © Sebastian Asprino
