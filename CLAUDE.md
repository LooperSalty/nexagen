# NEXAGEN - Instructions pour Claude Code

## Description du projet

NEXAGEN est un jeu de type voxel sandbox jouable dans le navigateur, avec generation procedurale de mondes par IA, creatures intelligentes, et narration dynamique. Le projet utilise une architecture monorepo Turborepo avec un frontend Next.js/Three.js et un backend Node.js/Fastify, accompagnes de microservices Python (FastAPI) pour l'IA.

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
| Monorepo | Turborepo + npm workspaces |
| Frontend | Next.js 15, React 19, TypeScript 5.7 |
| Rendu 3D | Three.js 0.170, React Three Fiber 8.17, @react-three/rapier 1.5, GLSL shaders |
| State | Zustand |
| Styles | Tailwind CSS 4, Framer Motion |
| Backend API | Node.js 22+, Fastify 5, tRPC 11, TypeScript |
| Base de donnees | PostgreSQL 16 + Prisma 6 |
| Cache / Realtime | Redis 7, BullMQ (job queues), Socket.IO |
| Stockage objets | MinIO (compatible S3) |
| Auth | Clerk |
| Paiement | Stripe |
| Services IA | Python 3.12, FastAPI, PyTorch, ONNX Runtime |
| Validation | Zod (TS), Pydantic (Python) |
| Tests | Vitest (TS), Pytest (Python), Playwright (E2E) |
| CI/CD | GitHub Actions |
| Conteneurs | Docker, Docker Compose |

## Structure du projet

```
nexagen/
├── apps/
│   ├── web/                    # Frontend Next.js 15
│   │   └── src/
│   │       ├── app/            # App Router pages
│   │       │   ├── (marketing)/  # Landing page publique
│   │       │   └── (auth)/       # Pages authentifiees (play, explore, studio)
│   │       ├── components/
│   │       │   ├── engine/     # WorldCanvas, ChunkRenderer, SkyboxSystem, PostProcessing
│   │       │   ├── hud/        # HealthBar, Crosshair, DebugOverlay, Hotbar
│   │       │   └── social/     # WorldCard
│   │       ├── engine/         # Moteur de jeu complet
│   │       │   ├── core/       # Engine, GameLoop
│   │       │   ├── world/      # TerrainGenerator, ChunkManager
│   │       │   ├── rendering/  # MeshBuilder, ShaderManager, TextureAtlas, SkySystem
│   │       │   ├── physics/    # PhysicsWorld
│   │       │   ├── entities/   # EntityManager, PlayerController
│   │       │   ├── gameplay/   # CombatSystem, InventorySystem, QuestSystem
│   │       │   ├── audio/      # AudioManager
│   │       │   └── input/      # InputManager
│   │       ├── stores/         # Zustand stores (game, player, ui, world)
│   │       ├── shaders/        # GLSL shaders (.vert, .frag)
│   │       └── lib/            # Utilitaires, client tRPC
│   └── api/                    # Backend Fastify 5
│       └── src/
│           ├── index.ts        # Serveur Fastify + Socket.IO
│           ├── trpc/           # Routeurs tRPC
│           │   ├── world.ts    # CRUD mondes, exploration
│           │   ├── generation.ts # Appels services IA
│           │   ├── billing.ts  # Abonnements, credits
│           │   ├── user.ts     # Profils, social
│           │   ├── social.ts   # Follows, commentaires, likes
│           │   └── game.ts     # Sauvegardes, quetes
│           ├── lib/            # Redis, BullMQ, Prisma, S3, AI client
│           └── middleware/     # Auth (Clerk), rate limiting
├── packages/
│   ├── shared/                 # Types et schemas Zod partages
│   │   └── src/
│   │       ├── types/          # world, quest, player, entity, network
│   │       ├── constants/      # biomes (10 types), blocks, config
│   │       └── utils/          # chunk-utils, serialization, noise, math
│   ├── db/                     # Client Prisma et schema
│   │   ├── prisma/
│   │   │   └── schema.prisma   # 13 modeles, enums complets
│   │   └── src/index.ts        # Exports Prisma client
│   ├── logger/                 # (A creer) Logger structure
│   └── config/                 # (A creer) Configurations ESLint, TS partagees
├── services/
│   └── ai/
│       ├── terrain/            # Generation de terrain (FastAPI, port 5001)
│       │   ├── generators/     # biome, WFC, structures, heightmap-ml, noise, pipeline
│       │   ├── main.py
│       │   └── requirements.txt
│       ├── creatures/          # Generation de creatures (FastAPI, port 5002)
│       │   ├── generators/     # mesh_gen, lsystem, texture_gen
│       │   ├── rl/             # Reinforcement learning (train, environments, export_onnx)
│       │   ├── main.py
│       │   └── requirements.txt
│       └── narrative/          # Narration dynamique (FastAPI, port 5003)
│           ├── generators/     # npcs, dialogue, quests, names, lore
│           ├── prompts/        # Templates de prompts Markdown
│           ├── main.py
│           └── requirements.txt
├── tools/
│   └── docker/
│       ├── Dockerfile.web      # Multi-stage Next.js (node:22-alpine)
│       ├── Dockerfile.api      # Multi-stage Fastify (node:22-alpine)
│       └── Dockerfile.ai       # Python FastAPI (python:3.12-slim)
├── .github/
│   └── workflows/
│       ├── ci.yml              # Lint, typecheck, test, python-lint, build
│       └── deploy.yml          # Deploy via SSH + Docker Compose
├── docker-compose.yml          # 7 services : web, api, 3x AI, postgres, redis, minio
├── turbo.json
├── .env.example
└── package.json                # Node >=22, npm@10.8.0
```

## Commandes de developpement

### Demarrage rapide

```bash
# 1. Installer les dependances
npm install

# 2. Copier et configurer les variables d'environnement
cp .env.example .env.local

# 3. Demarrer l'infrastructure (PostgreSQL, Redis, MinIO)
docker compose up postgres redis minio -d

# 4. Generer le client Prisma et pousser le schema
npm run db:generate
npm run db:push

# 5. Lancer le dev (frontend + backend)
npm run dev
```

### Commandes Turborepo (depuis la racine)

| Commande | Description |
|----------|-------------|
| `npm run dev` | Lancer le dev (web :3000, api :4000) |
| `npm run build` | Build de production |
| `npm run lint` | Linter TypeScript |
| `npm run typecheck` | Verification des types |
| `npm run test` | Tests unitaires (Vitest) |
| `npm run test:e2e` | Tests end-to-end (Playwright) |
| `npm run format` | Formatter avec Prettier |
| `npm run format:check` | Verifier le formatage |
| `npm run db:generate` | Generer le client Prisma |
| `npm run db:push` | Pousser le schema Prisma |
| `npm run db:migrate` | Appliquer les migrations |
| `npm run db:seed` | Seed de la base de donnees |
| `npm run clean` | Nettoyer les builds et node_modules |

### Services Python (depuis chaque dossier service)

```bash
cd services/ai/terrain   # ou creatures, narrative
pip install -r requirements.txt
uvicorn main:app --reload --port 5001  # 5002, 5003
```

### Docker Compose complet

```bash
docker compose up -d          # Lancer tout le stack
docker compose up -d postgres redis minio  # Infrastructure seule
docker compose logs -f api    # Logs d'un service
```

## Architecture de l'API

L'API utilise **tRPC v11** sur Fastify avec les routeurs suivants :

- `world` : CRUD des mondes, exploration, chunks
- `generation` : Orchestration des appels aux services IA Python
- `billing` : Gestion des abonnements Stripe et credits
- `user` : Profils utilisateur, parametres
- `social` : Follows, commentaires, likes sur les mondes
- `game` : Sauvegardes de jeu, progression des quetes

**Temps reel** : Socket.IO est integre au serveur Fastify pour la synchronisation multijoueur.

**Jobs asynchrones** : BullMQ + Redis pour les taches longues (generation de terrain, etc.).

## Schema de base de donnees (Prisma)

13 modeles principaux :

| Modele | Description |
|--------|-------------|
| `User` | Joueur (integration Clerk), role, credits, temps de jeu |
| `Follow` | Relations sociales entre joueurs |
| `Subscription` | Abonnements Stripe (FREE/STARTER/PRO/ENTERPRISE) |
| `CreditUsage` | Suivi des couts de generation IA |
| `World` | Mondes voxel (statut, visibilite, metadata de generation) |
| `Chunk` | Donnees de chunks voxel avec heightmap et biome maps |
| `BlockChange` | Modifications de blocs par les joueurs |
| `Entity` | Creatures, PNJ, objets interactifs |
| `NPC` | PNJ avec personnalite, dialogues, connaissances |
| `DialogueMessage` | Historique de chat avec les PNJ |
| `Quest` | Quetes avec objectifs, recompenses, prerequis |
| `GameSave` | Progression du joueur (position, inventaire, HP) |
| `WorldLike` / `Comment` | Interactions sociales sur les mondes |

## Design system

- **Palette** : Fond sombre (`#0a0a0f`), accents neon cyan (`#00f5ff`), violet (`#8b5cf6`), emeraude (`#10b981`), orange (`#f97316`)
- **Typographie** : Inter (sans-serif, UI), JetBrains Mono (monospace, code/stats)
- **Composants** : Style gaming/sci-fi avec bordures lumineuses et effets de glow
- **Animations** : Framer Motion, transitions fluides, pas de layout shift. Keyframes custom : fade-in, slide-in, scale-in, pulse-glow, float, shimmer
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
- **Commits** : Conventional commits, messages en anglais. Format : `type: description`
- **Types autorises** : feat, fix, refactor, docs, test, chore, perf, ci
- **PR** : Obligatoire pour merge dans `main` et `dev`, review requise
- **CI** : Tous les checks doivent passer avant merge (lint, typecheck, test, build)

## CI/CD (GitHub Actions)

### ci.yml (push main/dev, PRs)

Jobs paralleles :
1. **lint** : `turbo lint`
2. **typecheck** : `turbo typecheck`
3. **test** : `turbo test` (Vitest)
4. **python-lint** : `ruff check` sur `services/ai/`
5. **build** : `turbo build` (apres les 4 jobs precedents)

### deploy.yml (push main uniquement)

Deploy via SSH sur VPS : `git pull` + `docker compose build` + `docker compose up -d`

## Variables d'environnement

Voir `.env.example` pour la liste complete. Cles principales :

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | URL PostgreSQL (defaut: `postgresql://nexagen:nexagen@localhost:5432/nexagen`) |
| `REDIS_URL` | URL Redis (defaut: `redis://localhost:6379`) |
| `S3_ENDPOINT` | Endpoint MinIO (defaut: `http://localhost:9000`) |
| `NEXT_PUBLIC_CLERK_*` | Cles Clerk pour l'authentification |
| `STRIPE_*` | Cles Stripe pour les paiements |
| `TERRAIN_SERVICE_URL` | Service IA terrain (defaut: `http://localhost:5001`) |
| `CREATURE_SERVICE_URL` | Service IA creatures (defaut: `http://localhost:5002`) |
| `NARRATIVE_SERVICE_URL` | Service IA narration (defaut: `http://localhost:5003`) |
| `ANTHROPIC_API_KEY` | Cle API Claude pour la narration IA |

## Ports de developpement

| Service | Port |
|---------|------|
| Web (Next.js) | 3000 |
| API (Fastify) | 4000 |
| AI Terrain | 5001 |
| AI Creatures | 5002 |
| AI Narrative | 5003 |
| PostgreSQL | 5432 |
| Redis | 6379 |
| MinIO API | 9000 |
| MinIO Console | 9001 |

## Etat actuel du projet

Le scaffold initial est complet avec du code fonctionnel dans toutes les couches. Elements a completer :

- **@nexagen/logger** : Package reference dans les regles mais pas encore cree. A implementer avec un logger structure (pino ou winston).
- **@nexagen/config** : Package de configurations ESLint/TS partagees, pas encore cree.
- **Migrations Prisma** : Le schema existe mais aucune migration n'a ete generee.
- **Tests** : L'infrastructure de test est configuree (Vitest, Pytest) mais les fichiers de test ne sont pas encore ecrits.
- **Modeles ML** : Les services IA ont le code d'inference mais les modeles entraines ne sont pas inclus.
