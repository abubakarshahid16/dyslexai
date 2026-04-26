# DyslexAI

DyslexAI is a full-stack learning platform for dyslexic learners with OCR-assisted handwriting workflows, adaptive exercises, teacher assignments, and a daily game curriculum.

## Tech Stack

- Frontend: React + TypeScript + Vite
- Backend: FastAPI + SQLAlchemy
- Auth: Supabase Auth with local user mapping
- Database: SQLite (local) or PostgreSQL (Supabase)
- OCR pipeline: DocTR + TrOCR + correction layers + optional Groq vision cross-check

## Repository Layout

- frontend: React web app
- dyslexia-backend: FastAPI API and OCR pipeline
- seed_data_90_days.html: 90-day game curriculum seed source

## Current Features

- Supabase-backed authentication (signup, login, session validation, logout)
- Student and teacher roles with teacher access code gating
- Adaptive exercise engine (typing, sentence typing, handwriting, tracing)
- Assignment flows for teacher-created and LLM-generated exercises
- OCR Studio for handwriting image upload, correction, and run history
- Daily Exercises game mode seeded from the 90-day curriculum file

## Prerequisites

- Python 3.10+
- Node.js 18+
- npm 9+

## Environment Setup

1. Copy .env.example values into dyslexia-backend/.env.
2. Add real values for Supabase and Groq keys.
3. Optional frontend env overrides can be set in frontend/.env.

Important: Do not commit secrets. Keep real keys only in local .env files.

## Backend Setup

```bash
cd dyslexia-backend
python3 -m venv ../.venv
source ../.venv/bin/activate
pip install -r requirements.txt
```

Start API:

```bash
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

Notes:
- On startup, tables are created from SQLAlchemy models.
- If game curriculum is empty, it auto-seeds from seed_data_90_days.html.
- For SQLite, startup also runs incremental migration scripts in scripts/.

## Frontend Setup

```bash
cd frontend
npm install
npm run dev -- --host 127.0.0.1 --port 5173
```

Open http://127.0.0.1:5173

## Core API Areas

- Auth: /api/auth/*
- Students: /api/students/*
- Exercises: /api/exercises/*
- Sessions: /api/sessions/*
- OCR: /api/ocr/*
- Dashboard: /api/dashboard/*
- Assignments: /assignments/*
- Game mode: /api/game/*

## Data and Runtime Notes

- OCR artifacts and uploads are stored under dyslexia-backend/data.
- First OCR run may be slower due to model loading.
- Groq-dependent features require GROQ_API_KEY.
- Supabase auth flow requires SUPABASE_URL and SUPABASE_ANON_KEY.
- Legacy local users can be migrated during login when SUPABASE_SERVICE_ROLE_KEY is set.

## Useful Commands

Seed adaptive exercises manually:

```bash
cd dyslexia-backend
source ../.venv/bin/activate
python db/seed.py
```

Run OCR history cleanup migration (optional):

```bash
cd dyslexia-backend
source ../.venv/bin/activate
python scripts/migrate_drop_raw_text_and_clear_ocr_history.py
```

## License

This project currently has no explicit license file in the repository.
