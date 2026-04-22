# Revamperr

Application web pour **refondre des sites à partir d’une URL** (Revamp), générer et gérer des visuels (Imager), et piloter des campagnes e-mail (Emailer). Le dépôt est organisé en **monorepo** : API Node.js et interface React séparées.

## Architecture

| Partie | Technologie |
|--------|-------------|
| **Frontend** | [Vite](https://vitejs.dev/), React 18, TypeScript, Tailwind CSS, React Router, TanStack Query, i18next |
| **Backend** | [Express](https://expressjs.com/) 5, [Prisma](https://www.prisma.io/) 7, PostgreSQL (`pg`), TypeScript |
| **IA / services** | Clés optionnelles pour Grok/xAI, OpenAI, Anthropic, Jina ; e-mail via SMTP ; options avancées (Google Cloud pour certains flux) |

En développement, le frontend (port **5173**) proxifie `/api` et `/uploads` vers l’API (**3001**). L’UI principale n’est pas servie par l’API : la racine du backend renvoie un lien vers l’app et les endpoints de santé.

## Prérequis

- [Node.js](https://nodejs.org/) (LTS recommandé)
- [PostgreSQL](https://www.postgresql.org/) accessible localement ou à distance

## Installation et configuration

### Base de données et API

```bash
cd backend
cp .env.example .env   # PowerShell : Copy-Item .env.example .env
# Éditer .env : DATABASE_URL, JWT_SECRET (≥ 16 caractères), PORT si besoin
npm install
npx prisma migrate dev   # ou prisma db push selon votre flux
npm run dev              # écoute par défaut sur le port 3001
```

Variables utiles (voir `backend/.env.example`) : `DATABASE_URL`, `PORT`, `JWT_SECRET`, et optionnellement les clés API (Grok/xAI, OpenAI, Anthropic, Jina), SMTP, ainsi que les paramètres Google pour les fonctionnalités avancées.

Santé de l’API : `GET /api/health` (clés IA configurées ou non), `GET /api/db/health` (connexion PostgreSQL).

### Interface (frontend)

```bash
cd frontend
npm install
npm run dev
```

Ouvrir l’URL affichée par Vite (souvent `http://localhost:5173`). Les appels à `/api` sont proxifiés vers le backend défini dans `vite.config.ts`.

## Scripts utiles

**Backend** (`backend/package.json`) : `npm run build`, `npm start`, `npm run db:seed`, `npm run prisma:studio`, `npm test`.

**Frontend** : `npm run build`, `npm run preview`, `npm run lint`, `npm run typecheck`.

## Structure du dépôt

- `frontend/` — SPA React (pages : landing, auth, dashboard, Revamp, Imager, Emailer, paramètres).
- `backend/` — API Express, schéma Prisma, fichiers uploadés sous `uploads/`, file d’attente Revamp, etc.

## Licence

La licence du projet est celle indiquée dans les `package.json` de `backend/` et `frontend/`.
