# SheerID Gemini Student Verification Platform

A Next.js + Prisma application that helps manage Gemini student verification flows with SheerID links and card keys.

## Features
- User portal for submitting SheerID links with card keys
- Real-time verification progress via SSE
- Daily stats dashboard
- Admin console for card key management, export, and audit logs

## Tech Stack
- Next.js App Router
- Prisma (SQLite) with Prisma 7 adapter
- SWR for stats polling

## Getting Started

### 1) Install dependencies
```bash
npm install
```

### 2) Configure environment
Copy `.env.example` to `.env` and fill in values.

### 3) Initialize database
```bash
npx prisma migrate dev
```

### 4) Run development server
```bash
npm run dev
```

Visit http://localhost:3000

## Admin Console
- Login: http://localhost:3000/admin/login
- After login: http://localhost:3000/admin

## API Overview
- `POST /api/verify` SSE verification
- `POST /api/query` query history
- `GET /api/stats` daily stats
- `POST /api/admin/login` admin login
- `GET/POST /api/admin/cardkeys` list/create keys
- `PATCH/DELETE /api/admin/cardkeys/[code]` revoke/delete
- `GET /api/admin/export` export keys
- `GET /api/admin/logs` audit logs

## Notes
- Admin authentication uses `ADMIN_PASSWORD` and a signed cookie session.
- Prisma 7 uses the libsql adapter for SQLite.
