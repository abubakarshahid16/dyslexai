import { useMemo, useState } from "react";

import { processImage } from "../lib/api";
import { toAssetUrl } from "../lib/api";
import type { OCRRun } from "../types";
import { useAuth } from "../contexts/AuthContext";
import { OcrHistoryPanel } from "../components/OcrHistoryPanel";
import { ImageCropUploader } from "../components/ImageCropUploader";

export function WorkspacePage() {
  const [result, setResult] = useState<OCRRun | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const { user } = useAuth();

  const isTeacher = user?.role === "teacher";
  const [file, setFile] = useState<File | null>(null);

  const canSubmit = useMemo(() => !!file && !busy, [file, busy]);

  async function handleUpload() {
    if (!file) return;
    setBusy(true);
    setError(null);
    setStatus("Processing… grayscale -> segmentation -> OCR -> correction.");
    try {
      const response = await processImage({
        file,
        qualityMode: "quality_local"
      });
      setResult(response);
      setStatus(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Processing failed";
      let displayMsg = msg;
      if (msg.includes("abort") || msg.includes("AbortError")) {
        displayMsg = "OCR timed out. Try a smaller/cropped image.";
      } else if (msg.includes("fetch") || msg.includes("Failed to fetch")) {
        displayMsg = "Could not reach OCR service. Make sure the backend is running on port 8000.";
      } else if (msg.includes("Not Found") || msg.includes('"detail":"Not Found"')) {
        displayMsg =
          "OCR endpoint not found. Run the app with .\\scripts\\run.ps1 (full) or .\\scripts\\run-simple.ps1 (simple) so the backend is ready.";
      } else if (msg.includes("extra dependencies") || msg.includes("503")) {
        displayMsg =
          "OCR needs setup. In dyslexia-backend folder run: pip install torch transformers opencv-python python-doctr";
      }
      setError(displayMsg);
      setStatus(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page-stack">
      <section className="hero">
        <div>
          <span className="hero-badge">Teacher OCR Studio</span>
          <h1>Handwriting OCR</h1>
          <p>
            Upload a handwriting image to extract text.
          </p>
        </div>
      </section>

      {!isTeacher ? (
        <div className="error-banner">
          This tool is intended for teachers. Please switch to a teacher account to use OCR Studio.
        </div>
      ) : (
        <div className="card">
          <h3>Upload handwriting image</h3>
          <div className="upload-crop-row">
            <ImageCropUploader
              busy={busy}
              onFileChange={(f) => {
                setFile(f);
                setResult(null);
                setError(null);
                setStatus(null);
              }}
            />
            <button type="button" onClick={handleUpload} disabled={!canSubmit}>
              {busy ? "Processing…" : "Convert to text"}
            </button>
          </div>
          <p style={{ color: "var(--color-text-secondary)", marginTop: 10 }}>
            Tip: crop tightly around the paragraph before converting.
          </p>
        </div>
      )}

      {error ? <div className="error-banner">{error}</div> : null}
      {status ? <div className="card"><p>{status}</p></div> : null}

      {result && (
        <>
          <div className="card">
            <h3>Original image</h3>
            {toAssetUrl(result.original_image_path, result.original_image_url) ? (
              <img
                src={toAssetUrl(result.original_image_path, result.original_image_url) ?? undefined}
                alt="Original handwriting upload"
                style={{ width: "100%", maxWidth: 820, borderRadius: 14, border: "1px solid var(--color-divider)" }}
              />
            ) : (
              <p style={{ color: "var(--color-text-secondary)" }}>Original image not available.</p>
            )}
          </div>
          <div className="card">
            <h3>Corrected text</h3>
            <textarea
              className="text-area"
              value={result.corrected_text || ""}
              readOnly
              rows={10}
              style={{ width: "100%", resize: "vertical" }}
            />
          </div>
        </>
      )}

      <OcrHistoryPanel limit={30} refreshKey={result?.run_id ?? null} />
    </div>
  );
}
