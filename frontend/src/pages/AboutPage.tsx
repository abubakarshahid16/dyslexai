export function AboutPage() {
  return (
    <div className="legal-page">
      <h1>About DyslexAI</h1>
      <section>
        <h2>What is DyslexAI?</h2>
        <p>
          DyslexAI is an assistive web application designed to support individuals with dyslexia.
          It combines OCR (Optical Character Recognition) for handwriting with correction layers
          and gamified learning exercises to improve reading and writing skills.
        </p>
      </section>
      <section>
        <h2>Features</h2>
        <ul>
          <li>Document scan and OCR for handwritten text</li>
          <li>Multi-layer correction (lexical, contextual, spelling refinement)</li>
          <li>Learning exercises: word typing, sentence typing, handwriting, tracing</li>
          <li>Daily Lessons path with XP, levels, and streaks</li>
          <li>Student progress tracking</li>
          <li>Teacher review portal for OCR results</li>
        </ul>
      </section>
      <section>
        <h2>Technology</h2>
        <p>
          DyslexAI uses DocTR and TrOCR for handwriting recognition, ByT5 for contextual
          correction, and optional Groq LLM for advanced refinement. The design follows
          dyslexia-friendly guidelines: Lexend font, high contrast, and clear spacing.
        </p>
      </section>
      <p className="legal-muted">DyslexAI Web App • Version 1.0</p>
    </div>
  );
}
