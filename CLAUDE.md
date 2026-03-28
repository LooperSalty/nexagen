# NEXAGEN - Instructions pour Claude Code

## Description du projet

NEXAGEN est un jeu de type voxel sandbox jouable dans le navigateur, avec generation procedurale de mondes par IA, creatures intelligentes, et narration dynamique. Le projet utilise une architecture monorepo Turborepo avec un frontend Next.js/Three.js et un backend Node.js, accompagnes de microservices Python pour l'IA.

## Regles absolues

1. **TypeScript strict** : `strict: true` dans tous les tsconfig.json. Aucune exception.
2. **Aucun `any`** : Utiliser `unknown` + type guards si le type est inconnu. Jamais de `any`, `as any`, ou `@ts-ignore`.
3. **Validation Zod** : Toute donnee entrant dans le systeme (API, formulaires, WebSocket, fichiers) doit etre validee avec un schema Zod.
4. **Prisma pour la BDD** : Toute interaction avec PostgreSQL passe par Prisma. Aucune requete SQL brute.
5. **React fonctionnel uniquement** : Aucune classe React. Composants fonctionnels + hooks uniquement.
6. **Zustand pour le state** : Aucun autre state manager. Pas de Redux, pas de Context pour le state global.
7. **Tailwind CSS uniquement** : Aucun CSS-in-JS, aucun fichier .css custom (sauf globals.css pour les variables Tailwind). Pas de `style={{}}` inline.
8. **Pas de console.log** : Utiliser le logger structure du package `@nexagen/logger`. `console.log` = erreur de lint.
9. **Conventional commits** : Format `type: description`. Types autorises : feat, fix, refactor, docs, test, chore, perf, ci.
10. **Maximum 300 lignes par fichier** : Si un fichier depasse 300 lignes, il doit etre decoupe. Aucune exception.

## Stack technique

| Couche | Technologie |
|--------|-------------|
| Monorepo | Turborepo |
| Frontend | Next.js 15, React 19, TypeScript 5 |
| Rendu 3D | Three.js, React Three Fiber, GLSL shaders |
| State | Zustand |
| Styles | Tailwind CSS 4 |
| Backend API | Node.js, Fastify, TypeScript |
| Base de donnees | PostgreSQL 16 + Prisma |
| Cache / Realtime | Redis 7 |
| Stockage objets | MinIO (compatible S3) |
| Services IA | Python 3.12, FastAPI, PyTorch |
| Validation | Zod (TS), Pydantic (Python) |
| Tests | Vitest (TS), Pytest (Python) |
| CI/CD | GitHub Actions |
| Conteneurs | Docker, Docker Compose |

## Structure du projet

```
nexagen/
├── apps/
│   ├── web/              # Frontend Next.js
│   │   └── src/
│   │       ├── app/      # App Router pages
│   │       ├── components/
│   │       ├── hooks/
│   │       ├── stores/   # Zustand stores
│   │       ├── shaders/  # GLSL shaders
│   │       └── lib/
│   └── api/              # Backend Fastify
│       └── src/
│           ├── routes/
│           ├── services/
│           ├── repositories/
│           └── middleware/
├── packages/
│   ├── shared/           # Types et schemas Zod partages
│   ├── db/               # Client Prisma et migrations
│   ├── logger/           # Logger structure
│   └── config/           # Configurations ESLint, TS partagees
├── services/
│   └── ai/
│       ├── terrain/      # Generation de terrain par IA
│       ├── creatures/    # Generation de creatures par IA
│       └── narrative/    # Narration dynamique par IA
├── tools/
│   └── docker/           # Dockerfiles
└── docker-compose.yml
```

## Design system

- **Palette** : Fond sombre (`#0a0a0f`), accents neon cyan (`#00f5ff`), violet (`#8b5cf6`), emeraude (`#10b981`)
- **Typographie** : Inter pour l'UI, JetBrains Mono pour le code/stats
- **Composants** : Style gaming/sci-fi avec bordures lumineuses et effets de glow
- **Animations** : Framer Motion, transitions fluides, pas de layout shift
- **Responsive** : Mobile-first, breakpoints Tailwind standard

## Exigences de performance

- **FPS** : Minimum 60 FPS stable sur un GPU milieu de gamme
- **Chunks** : Systeme de chunks avec chargement/dechargement dynamique
- **Workers** : Meshing et generation de terrain dans des Web Workers
- **LOD** : Niveau de detail adaptatif selon la distance
- **Bundle** : Premier chargement < 500KB gzippe (hors assets 3D)
- **TTFB** : < 200ms avec SSR/streaming Next.js

## Conventions de test

- **Couverture minimale** : 80% sur tout le code TypeScript
- **Tests unitaires** : Vitest pour toutes les fonctions utilitaires et stores
- **Tests d'integration** : Supertest pour les routes API
- **Tests E2E** : Playwright pour les parcours critiques
- **Tests IA** : Pytest avec fixtures pour les services Python
- **Nommage** : `*.test.ts` pour les tests unitaires, `*.e2e.ts` pour E2E

## Conventions Git

- **Branches** : `main` (production), `dev` (integration), `feat/*`, `fix/*`, `refactor/*`
- **Commits** : Conventional commits, messages en anglais
- **PR** : Obligatoire pour merge dans `main` et `dev`, review requise
- **CI** : Tous les checks doivent passer avant merge (lint, typecheck, test, build)
