# 🌐 DyslexAI Web: Comprehensive Dyslexia Support Ecosystem

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![FastAPI](https://img.shields.io/badge/FastAPI-005571?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com/)

**DyslexAI Web** is a professional, web-based educational platform designed to support students with dyslexia and provide teachers with powerful AI-driven assessment tools. It brings the power of the DyslexAI handwriting engine to the browser, enabling accessible education for everyone, everywhere.

---

## 🌟 Visual Experience

![DyslexAI Web Hero](docs/assets/hero.png)

### 🎥 Live Demo Walkthrough
[![Watch the Demo](docs/assets/hero.png)](https://github.com/abubakarshahid16/dyslexai/raw/main/docs/assets/demo.mp4)

*Click the image above to watch the full system demonstration.*

---

## 🚀 World-Class Features

### 🖋️ Handwriting Analysis Portal
Upload or capture student handwriting directly through the web interface. Our backend AI (TrOCR Large) analyzes the input and identifies phonetic errors, reversals (b/d, p/q), and spelling patterns common in dyslexia.

### 🏫 Teacher Dashboard
A centralized hub for classroom management.
*   **Student Progress:** Monitor real-time stats for entire cohorts.
*   **Assignment Builder:** Use AI to generate custom reading and writing assignments.
*   **Mastery Tracking:** Visualize word-level mastery trends over time.

### 🎮 Gamified Learning
Complete the 90-day adaptive curriculum. The web app synchronizes with the mobile platform to ensure a seamless "learning anywhere" experience.

---

## 🏗️ Technical Architecture

*   **Frontend:** Modern React + TypeScript powered by **Vite** for lightning-fast performance and a premium UI.
*   **Backend:** High-performance **FastAPI** service handling authentication, gamification logic, and database management.
*   **AI Engine:** Integrated OCR and NLP pipelines for handwriting correction and phonetic analysis.
*   **Database:** Scalable architecture supporting both SQLite for local development and PostgreSQL for production.

---

## 🛠️ Installation & Setup

### Prerequisites
*   Node.js v18+
*   Python 3.10+
*   PostgreSQL or SQLite

### Steps to Run

1.  **Backend Setup:**
    ```bash
    cd dyslexia-backend
    pip install -r requirements.txt
    uvicorn app.main:app --port 8000
    ```

2.  **Frontend Setup:**
    ```bash
    cd frontend
    npm install
    npm run dev
    ```

---

## 📈 Roadmap
- [x] Full Student/Teacher Portal synchronization
- [x] Real-time handwriting OCR analysis
- [x] 90-Day adaptive curriculum integration
- [ ] Direct Browser Canvas support for handwriting exercises
- [ ] Accessibility-focused UI themes (Dyslexie font support)

---

## 🤝 Contributing
Join us in making education accessible to all! Open an issue or submit a pull request.

## 📄 License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---
Created with ❤️ by **Abubakar Shahid**
