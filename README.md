# NEXAGEN

AI-powered voxel sandbox game playable in the browser.

![Screenshot](docs/screenshot-placeholder.png)

## Features

- **AI World Generation** - Procedurally generated infinite voxel worlds powered by neural networks
- **Browser Playable** - No download required, runs entirely in WebGL with Three.js
- **Multiplayer** - Real-time multiplayer via WebSocket with Redis pub/sub
- **Procedural Creatures** - AI-generated creatures with unique behaviors and appearances
- **AI Narrative** - Dynamic storytelling that adapts to player actions and world state
- **Custom Shaders** - Hand-written GLSL shaders for terrain, water, sky, fog, and crystal effects
- **Chunk-Based Rendering** - Efficient LOD system with Web Worker meshing for 60 FPS

## Tech Stack

| Layer | Technology |
|-------|------------|
| Monorepo | Turborepo |
| Frontend | Next.js 15, React 19, TypeScript 5 |
| 3D Rendering | Three.js, React Three Fiber, GLSL |
| State Management | Zustand |
| Styling | Tailwind CSS 4 |
| Backend | Node.js, Fastify, TypeScript |
| Database | PostgreSQL 16, Prisma ORM |
| Cache / Realtime | Redis 7 |
| Object Storage | MinIO (S3-compatible) |
| AI Services | Python 3.12, FastAPI, PyTorch |
| Validation | Zod (TS), Pydantic (Python) |
| Testing | Vitest, Playwright, Pytest |
| CI/CD | GitHub Actions |
| Containers | Docker, Docker Compose |

## Getting Started

### Prerequisites

- Node.js 22+
- Python 3.12+
- Docker and Docker Compose
- Git

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/nexagen.git
cd nexagen

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Start infrastructure services
docker compose up postgres redis minio -d

# Run database migrations
npx turbo run db:migrate --filter=@nexagen/db

# Start all services in development mode
npx turbo run dev
```

### Docker (full stack)

```bash
# Start everything with Docker Compose
docker compose up --build

# Web:        http://localhost:3000
# API:        http://localhost:4000
# MinIO:      http://localhost:9001 (console)
# PostgreSQL: localhost:5432
# Redis:      localhost:6379
```

## Project Structure

```
nexagen/
├── apps/
│   ├── web/                 # Next.js frontend (Three.js, shaders, UI)
│   └── api/                 # Fastify API server
├── packages/
│   ├── shared/              # Shared types and Zod schemas
│   ├── db/                  # Prisma client and migrations
│   ├── logger/              # Structured logger
│   └── config/              # Shared ESLint, TypeScript configs
├── services/
│   └── ai/
│       ├── terrain/         # Terrain generation AI (FastAPI)
│       ├── creatures/       # Creature generation AI (FastAPI)
│       └── narrative/       # Narrative AI (FastAPI)
├── tools/
│   └── docker/              # Dockerfiles
├── docker-compose.yml
├── turbo.json
└── package.json
```

## Architecture

```
                    ┌─────────────┐
                    │   Browser   │
                    │  (Next.js)  │
                    └──────┬──────┘
                           │ HTTP / WebSocket
                    ┌──────▼──────┐
                    │  API Server │
                    │  (Fastify)  │
                    └──┬───┬───┬──┘
                       │   │   │
            ┌──────────┘   │   └──────────┐
            │              │              │
     ┌──────▼──────┐ ┌────▼────┐ ┌───────▼──────┐
     │ PostgreSQL  │ │  Redis  │ │    MinIO      │
     │   (Data)    │ │ (Cache) │ │  (Assets)     │
     └─────────────┘ └─────────┘ └──────────────┘
                           │
            ┌──────────────┼──────────────┐
            │              │              │
     ┌──────▼──────┐ ┌────▼─────┐ ┌──────▼──────┐
     │ AI Terrain  │ │ AI       │ │ AI          │
     │ Generator   │ │ Creatures│ │ Narrative   │
     │ (FastAPI)   │ │ (FastAPI)│ │ (FastAPI)   │
     └─────────────┘ └──────────┘ └─────────────┘
```

## Contributing

1. Fork the repository
2. Create your feature branch: `git checkout -b feat/my-feature`
3. Follow the conventions defined in `CLAUDE.md`
4. Write tests first (TDD), ensure 80%+ coverage
5. Commit with conventional commits: `feat: add new feature`
6. Push to your branch: `git push origin feat/my-feature`
7. Open a Pull Request against `dev`

### Development Rules

- TypeScript strict mode, no `any`
- Validate all inputs with Zod
- Functional React components only
- Zustand for state management
- Tailwind CSS only (no CSS-in-JS)
- Max 300 lines per file
- Use the structured logger, not `console.log`

## License

MIT
