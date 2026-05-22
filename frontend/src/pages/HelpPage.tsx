export function HelpPage() {
  return (
    <div className="legal-page">
      <h1>Help</h1>
      <section>
        <h2>Getting Started</h2>
        <p>
          After signing up or logging in, you can access the Dashboard for an overview,
          Workspace to upload and scan documents, Exercises for practice, and Daily
          Lessons for gamified learning.
        </p>
      </section>
      <section>
        <h2>Uploading Documents</h2>
        <p>
          Go to Workspace and select an image file (PNG, JPG, WebP, BMP, TIFF). Choose
          Quality mode for best handwriting results. Processing may take 30–90 seconds
          for handwriting. Use Fast mode for quicker results with typed text.
        </p>
      </section>
      <section>
        <h2>Understanding Results</h2>
        <p>
          After processing, you&apos;ll see raw OCR text, correction layers, and the final
          corrected output. Yellow highlights indicate corrections. Review suspicious
          lines and edit manually if needed.
        </p>
      </section>
      <section>
        <h2>Exercises</h2>
        <p>
          Create a student profile, then get adaptive exercises. You can practice
          word typing, sentence typing, handwriting (photo upload), or letter tracing.
          Daily Lessons adds XP, levels, and streaks for motivation.
        </p>
      </section>
      <section>
        <h2>Need More Help?</h2>
        <p>
          Check the About page for technical details. For support, contact your
          administrator or refer to the project documentation.
        </p>
      </section>
    </div>
  );
}
