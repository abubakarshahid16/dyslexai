# DyslexAI 🧠✨

DyslexAI is an intelligent, full-stack learning platform designed to provide adaptive support for dyslexic learners. It features interactive OCR-assisted handwriting workflows, AI-generated adaptive exercises, teacher-assigned curriculums, and a daily 90-day game-based learning path. 

The platform leverages state-of-the-art Generative AI and Vision LLMs to actively validate student handwriting and tracing in real-time.

## 🚀 Key Features

### 🎓 For Students
- **Daily Game Curriculum:** A structured 90-day learning path automatically seeded from our interactive curriculum (`seed_data_90_days.html`).
- **Adaptive Exercises:** Dynamic exercises spanning Word Typing, Sentence Typing, Handwriting, and Tracing.
- **OCR Studio:** Upload handwriting images for AI-driven transcription, correction, and historical progress tracking.
- **Vision-Based Evaluation:** Tracing and handwriting exercises are scored using **Groq Vision LLMs**, evaluating not just what is written, but *how* closely the student followed the tracing guides to prevent gibberish scoring.

### 👩‍🏫 For Teachers
- **Teacher Dashboard:** An instantly loading, optimized dashboard offering collective stats, attendance tracking (last 30 days), and individual student deep dives.
- **Custom Assignments:** Create and push custom assignments to students, or let the LLM generate targeted practice based on the student's current "struggling words."
- **Performance Analytics:** Track letter-confusion patterns, accuracy by exercise type, and score trend progression.

### ⚙️ Engine & Architecture
- **Zero-Latency Transitions:** On-the-fly LLM exercise generation is offloaded to background tasks to keep student navigation instantly responsive.
- **Optimized Queries:** Dashboard and analytics use optimized group-by joins to completely eliminate N+1 query bottlenecks.
- **Robust Auth:** Supabase Auth with Role-Based Access Control (RBAC) and teacher access-code gating.
- **Mobile Responsive:** A fluid, fully responsive frontend that adapts flawlessly from desktop monitors to mobile phones.

---

## 🛠️ Tech Stack

- **Frontend:** React 18, TypeScript, Vite, Responsive Vanilla CSS
- **Backend:** FastAPI, SQLAlchemy, Pydantic
- **Database:** PostgreSQL (via Supabase) / SQLite (local dev)
- **AI / LLMs:** Groq (`llama-4-scout-17b-16e-instruct` for vision/evaluation)
- **OCR Pipeline:** DocTR + TrOCR + Correction Layers

---

## 💻 Environment Setup

1. Copy the `.env.example` file to create your local environment:
   ```bash
   cp .env.example dyslexia-backend/.env
   ```
2. Add your real **Supabase** and **Groq** API keys. *(Do not commit these!)*
3. For local mobile testing, create a `frontend/.env.local` to point Vite to your local backend IP.

---

## 🏃‍♂️ Running Locally

### Backend Setup
```bash
cd dyslexia-backend
python3 -m venv ../.venv
source ../.venv/bin/activate
pip install -r requirements.txt

# Start the API
uvicorn app.main:app --host 0.0.0.0 --port 7860 --reload
```
*Note: On startup, tables are auto-created from models. If the game curriculum is empty, it will auto-seed from `seed_data_90_days.html`.*

### Frontend Setup
```bash
cd frontend
npm install

# Start the Vite dev server (exposed to local network for mobile testing)
npm run dev -- --host
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 📡 API Overview

- `/api/auth/*` — Authentication & Session management
- `/api/students/*` — Student profiles & progress analytics
- `/api/exercises/*` — Adaptive exercise engine & background LLM generation
- `/api/sessions/*` — Exercise submission & Vision LLM validation
- `/api/ocr/*` — Handwriting image processing pipeline
- `/api/dashboard/*` — Optimized teacher analytics
- `/api/assignments/*` — Assignment creation & status
- `/api/game/*` — 90-day curriculum progression

---

## 🔧 Useful Commands

**Manually seed the adaptive exercises database:**
```bash
cd dyslexia-backend
source ../.venv/bin/activate
python db/seed.py
```

**Run OCR history cleanup migration (optional):**
```bash
cd dyslexia-backend
source ../.venv/bin/activate
python scripts/migrate_drop_raw_text_and_clear_ocr_history.py
```
