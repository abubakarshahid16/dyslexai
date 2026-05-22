import { useCallback, useEffect, useRef, useState } from "react";

interface TracingCanvasProps {
  expected: string;
  onComplete: (traceScore: number, durationSeconds: number, strokeErrors?: Array<{ letter: string; accuracy: number }>, imageBase64?: string) => void;
  disabled?: boolean;
}

export function TracingCanvas({ expected, onComplete, disabled }: TracingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [strokeCount, setStrokeCount] = useState(0);
  // Each stroke is its own array of points — never connected across strokes
  const strokesRef = useRef<number[][][]>([]);
  const startTimeRef = useRef<number>(Date.now());

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const w = wrap.clientWidth;
    const h = Math.round(w * 0.55);
    if (canvas.width !== w || canvas.height !== h) {
      const scaleX = w / (canvas.width || w);
      const scaleY = h / (canvas.height || h);
      strokesRef.current = strokesRef.current.map(
        (stroke) => stroke.map(([x, y]) => [x * scaleX, y * scaleY])
      );
      canvas.width = w;
      canvas.height = h;
    }
  }, []);

  const drawGuide = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      const { width, height } = ctx.canvas;
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = "rgba(30, 41, 59, 0.5)";
      ctx.fillRect(0, 0, width, height);

      // Start with font size based on height, then shrink to fit width
      const padding = width * 0.06;
      const maxW = width - padding * 2;
      let fontSize = Math.round(height * 0.7);
      ctx.font = `${fontSize}px sans-serif`;
      const textW = ctx.measureText(expected).width;
      if (textW > maxW) {
        fontSize = Math.floor(fontSize * (maxW / textW));
      }

      ctx.font = `${fontSize}px sans-serif`;
      ctx.fillStyle = "rgba(148, 163, 184, 0.35)";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(expected, width / 2, height / 2);
    },
    [expected]
  );

  const guideBounds = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    const { width, height } = ctx.canvas;
    const padding = width * 0.06;
    const maxW = width - padding * 2;
    let fontSize = Math.round(height * 0.7);
    ctx.font = `${fontSize}px sans-serif`;
    const textW0 = ctx.measureText(expected).width;
    if (textW0 > maxW) fontSize = Math.floor(fontSize * (maxW / textW0));
    ctx.font = `${fontSize}px sans-serif`;
    const textW = ctx.measureText(expected).width;
    // Rough text box around the guide.
    // We intentionally add extra margin so correct traces don't get penalized
    // by small rendering/placement differences on the canvas.
    const boxW = Math.min(maxW, textW) * 1.18;
    const boxH = fontSize * 1.45;
    const left = width / 2 - boxW / 2;
    const top = height / 2 - boxH / 2;
    return { left, top, right: left + boxW, bottom: top + boxH, fontSize, boxW, boxH };
  }, [expected]);

  const drawStrokes = useCallback((ctx: CanvasRenderingContext2D) => {
    ctx.strokeStyle = "#308ce8";
    ctx.lineWidth = Math.max(4, ctx.canvas.width * 0.006);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // Each stroke is drawn as its own path — no connecting lines between strokes
    for (const stroke of strokesRef.current) {
      if (stroke.length < 2) continue;
      ctx.beginPath();
      ctx.moveTo(stroke[0][0], stroke[0][1]);
      for (let i = 1; i < stroke.length; i++) {
        ctx.lineTo(stroke[i][0], stroke[i][1]);
      }
      ctx.stroke();
    }
  }, []);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    drawGuide(ctx);
    drawStrokes(ctx);
  }, [drawGuide, drawStrokes]);

  useEffect(() => {
    resizeCanvas();
    redraw();
    const observer = new ResizeObserver(() => { resizeCanvas(); redraw(); });
    if (wrapRef.current) observer.observe(wrapRef.current);
    return () => observer.disconnect();
  }, [resizeCanvas, redraw]);

  useEffect(() => {
    redraw();
  }, [redraw, strokeCount]);

  const getCoords = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ("touches" in e) {
      return [
        (e.touches[0].clientX - rect.left) * scaleX,
        (e.touches[0].clientY - rect.top) * scaleY
      ];
    }
    return [(e.clientX - rect.left) * scaleX, (e.clientY - rect.top) * scaleY];
  };

  const handleStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (disabled) return;
    const coords = getCoords(e);
    if (coords) {
      // Start a brand new stroke array
      strokesRef.current.push([coords]);
      setStrokeCount((c) => c + 1);
      setIsDrawing(true);
    }
  };

  const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!isDrawing || disabled) return;
    const coords = getCoords(e);
    if (coords) {
      // Append to the current (last) stroke
      const strokes = strokesRef.current;
      if (strokes.length > 0) {
        strokes[strokes.length - 1].push(coords);
        setStrokeCount((c) => c + 1);
      }
    }
  };

  const handleEnd = () => {
    setIsDrawing(false);
  };

  const handleSubmit = () => {
    const allStrokes = strokesRef.current;
    const allPoints = allStrokes.flat();
    const durationSeconds = Math.round((Date.now() - startTimeRef.current) / 1000);
    const charCount = expected.replace(/\s/g, "").length || 1;

    if (allPoints.length < 5) {
      onComplete(0.2, durationSeconds, expected.split("").map((ch) => ({ letter: ch, accuracy: 0.2 })));
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const W = canvas.width;
    const H = canvas.height;
    const gb = guideBounds();

    const xs = allPoints.map((p) => p[0]);
    const ys = allPoints.map((p) => p[1]);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const bboxW = maxX - minX;
    const bboxH = maxY - minY;
    const bboxArea = bboxW * bboxH;
    const canvasArea = W * H;

    // How much of the stroke points are inside the guide text box.
    let inGuideRatio = 0.0;
    if (gb) {
      let inside = 0;
      for (const [x, y] of allPoints) {
        if (x >= gb.left && x <= gb.right && y >= gb.top && y <= gb.bottom) inside++;
      }
      inGuideRatio = inside / allPoints.length;
    }

    let score: number;

    // Used to reject off-target scribbles.
    const bboxCenterX = (minX + maxX) / 2;
    const bboxCenterY = (minY + maxY) / 2;
    const guideCenterX = gb ? (gb.left + gb.right) / 2 : W / 2;
    const guideCenterY = gb ? (gb.top + gb.bottom) / 2 : H / 2;
    const guideHalfW = gb ? Math.max(1, (gb.right - gb.left) / 2) : Math.max(1, W / 2);
    const guideHalfH = gb ? Math.max(1, (gb.bottom - gb.top) / 2) : Math.max(1, H / 2);
    const cxNorm = (bboxCenterX - guideCenterX) / guideHalfW;
    const cyNorm = (bboxCenterY - guideCenterY) / guideHalfH;
    // 1 when centered, decays with distance; keep this relatively gentle
    // because small bbox jitter should not tank scores.
    const centeringScore = Math.exp(-(cxNorm * cxNorm + cyNorm * cyNorm) * 0.6);

    // Overlap of user's drawn bbox with the guide bbox.
    const overlapW = gb ? Math.max(0, Math.min(maxX, gb.right) - Math.max(minX, gb.left)) : bboxW;
    const overlapH = gb ? Math.max(0, Math.min(maxY, gb.bottom) - Math.max(minY, gb.top)) : bboxH;
    const overlapArea = overlapW * overlapH;
    const guideBoxArea = gb ? Math.max(1, gb.boxW * gb.boxH) : Math.max(1, canvasArea * 0.2);
    const overlapRatio = Math.max(0, Math.min(1, overlapArea / guideBoxArea));

    // Pixel-level overlap of strokes with the expected glyph.
    // We compute an overlap-based "precision/recall" and blend it into the final score.
    // Also try small shifts to reduce false negatives from font/rendering alignment differences.
    let glyphOverlap = 1; // recall: how much of glyph is covered
    let strokePrecision = 1; // precision: how much of ink is on glyph
    let rasterF1 = 1;
    if (gb && typeof document !== "undefined") {
      try {
        const offGuide = document.createElement("canvas");
        offGuide.width = W;
        offGuide.height = H;
        const gctx = offGuide.getContext("2d");
        const offStroke = document.createElement("canvas");
        offStroke.width = W;
        offStroke.height = H;
        const sctx = offStroke.getContext("2d");

        if (gctx && sctx) {
          // Render expected text as a solid mask.
          gctx.clearRect(0, 0, W, H);
          gctx.fillStyle = "#ffffff";
          gctx.font = `${gb.fontSize}px sans-serif`;
          gctx.textAlign = "center";
          gctx.textBaseline = "middle";
          gctx.fillText(expected, W / 2, H / 2);

          // Render user strokes as a solid mask.
          sctx.clearRect(0, 0, W, H);
          sctx.strokeStyle = "#ffffff";
          sctx.lineWidth = Math.max(4, W * 0.006);
          sctx.lineCap = "round";
          sctx.lineJoin = "round";

          for (const stroke of allStrokes) {
            if (stroke.length < 2) continue;
            sctx.beginPath();
            sctx.moveTo(stroke[0][0], stroke[0][1]);
            for (let i = 1; i < stroke.length; i++) {
              sctx.lineTo(stroke[i][0], stroke[i][1]);
            }
            sctx.stroke();
          }

          const gData = gctx.getImageData(0, 0, W, H).data;
          const sData = sctx.getImageData(0, 0, W, H).data;

          // Build quick guide mask + list of stroke pixels.
          const guideMask = new Uint8Array(W * H);
          let guidePixels = 0;
          for (let idx = 0, p = 0; idx < gData.length; idx += 4, p++) {
            const ga = gData[idx + 3];
            // Use a higher alpha threshold so random scribbles don't
            // get counted just from antialiasing edges.
            if (ga > 3) {
              guideMask[p] = 1;
              guidePixels++;
            }
          }

          const strokeCoords: Array<[number, number]> = [];
          let strokePixels = 0;
          for (let idx = 0, p = 0; idx < sData.length; idx += 4, p++) {
            const sa = sData[idx + 3];
            if (sa > 3) {
              strokePixels++;
              const x = p % W;
              const y = Math.floor(p / W);
              strokeCoords.push([x, y]);
            }
          }

          if (guidePixels <= 0 || strokePixels <= 0) {
            glyphOverlap = 0;
            strokePrecision = 0;
            rasterF1 = 0;
          } else {
            // Allow a wider alignment window so correct traces don't get
            // punished by small shifts between the guide rendering and the
            // offscreen mask rendering.
            const offsets = [-8, -4, 0, 4, 8];
            let bestRecall = 0;
            let bestPrecision = 0;
            let bestF1 = 0;

            for (const dx of offsets) {
              for (const dy of offsets) {
                let intersection = 0;
                for (let i = 0; i < strokeCoords.length; i++) {
                  const [x, y] = strokeCoords[i];
                  const nx = x + dx;
                  const ny = y + dy;
                  if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
                  const p = ny * W + nx;
                  if (guideMask[p]) intersection++;
                }

                const recall = intersection / guidePixels; // glyph covered
                const precision = intersection / strokePixels; // ink on glyph
                const f1 = (2 * recall * precision) / Math.max(1e-6, recall + precision);
                if (f1 > bestF1) {
                  bestF1 = f1;
                  bestRecall = recall;
                  bestPrecision = precision;
                }
              }
            }

            glyphOverlap = bestRecall;
            strokePrecision = bestPrecision;
            rasterF1 = bestF1;
          }
        }
      } catch {
        // If something fails (rare), fall back to bbox-based scoring.
      }
    }

    if (charCount === 1) {
      // Single letter: strict size + placement + avoid huge scribbles
      const heightScore = Math.min(1, bboxH / (H * 0.52));
      const widthScore = Math.min(1, bboxW / (W * 0.22));
      const strokeIdeal = 3;
      // Allow a wider tolerance: kids often lift/restart even when tracing correctly.
      const strokeScore = Math.exp(-Math.abs(allStrokes.length - strokeIdeal) / (strokeIdeal * 2));
      // Make it hard to score high unless the stroke is mostly inside and centered.
      const areaPenalty = Math.max(0, 1 - bboxArea / (canvasArea * 0.35)); // huge scribble => penalty, but less harsh

      const strictGuideScore = gb
        ? Math.min(1, Math.max(0, (inGuideRatio - 0.22) / 0.78)) // more tolerant for correct traces
        : 0.2;

      // Combine multiple strictness signals.
      score =
        0.26 * heightScore +
        0.16 * widthScore +
        0.18 * strokeScore +
        0.14 * strictGuideScore +
        0.26 * areaPenalty;

      score *= centeringScore;
      // Avoid harsh punishment when the bbox slightly under/overlaps the rough guide box.
      score *= 0.85 + 0.15 * overlapRatio;
      // Raster match: blend it (don't multiply everything) and only hard-cap when
      // there is essentially no glyph overlap.
      const rasterBlend = 0.78 + 0.22 * Math.min(1, rasterF1 * 2.2);
      score *= rasterBlend;
      if (rasterF1 < 0.05) score = Math.min(score, 0.07);

      // If the raster match is decent, bump score so correct traces don't stay ~50%.
      // (rasterF1 is 0..1 where higher means ink is actually on the expected glyph.)
      const rasterBoost =
        0.10 + 0.90 * Math.pow(Math.max(0, Math.min(1, rasterF1)), 0.45);
      if (rasterF1 >= 0.10) score = Math.max(score, rasterBoost);

      // Perfect trace snap (single letter)
      if (
        rasterF1 >= 0.30 &&
        glyphOverlap >= 0.22 &&
        strokePrecision >= 0.20 &&
        inGuideRatio >= 0.45 &&
        centeringScore >= 0.25
      ) {
        score = 1.0;
      }
    } else {
      // Multi-char word: check each letter zone (column) has strokes
      const cols = charCount;
      const colHit = new Set<number>();
      if (gb) {
        const guideW = Math.max(1, gb.right - gb.left);
        for (const [x] of allPoints) {
          // Ignore points outside the guide bbox for column scoring.
          if (x < gb.left || x > gb.right) continue;
          const t = (x - gb.left) / guideW; // 0..1 within guide
          const idx = Math.max(0, Math.min(cols - 1, Math.floor(t * cols)));
          colHit.add(idx);
        }
      } else {
        for (const [x] of allPoints) {
          colHit.add(Math.min(cols - 1, Math.floor((x / W) * cols)));
        }
      }
      const columnScore = colHit.size / cols;

      // Prefer a reasonable number of strokes. Too few or too many is worse.
      const idealStrokes = Math.max(1, Math.round(charCount / 2));
      const strokeCountScore = Math.exp(-Math.abs(allStrokes.length - idealStrokes) / idealStrokes);

      // Strokes should overlap the guide significantly.
      // Make the width coverage slightly more tolerant: we don't require
      // the drawn bbox to fill the entire rough guide box.
      const widthCoverageScore = gb
        ? Math.min(1, overlapW / Math.max(1, gb.boxW * 0.85))
        : Math.min(1, bboxW / (W * 0.72));

      // Strokes should be in the vertical middle of the canvas
      const avgY = allPoints.reduce((s, p) => s + p[1], 0) / allPoints.length;
      const verticalScore = Math.max(0, 1 - Math.abs(avgY - H / 2) / (H / 2));

      const areaPenalty = Math.max(0, 1 - bboxArea / (canvasArea * 0.45));
      const strictGuideScore = gb ? Math.min(1, Math.max(0, (inGuideRatio - 0.55) / 0.45)) : 0.2;

      // If the trace only covers a small portion of the word (e.g., only first letter),
      // heavily cap the score.
      const progressRatio = widthCoverageScore; // already based on guide overlap

      score =
        0.28 * columnScore +
        0.18 * strokeCountScore +
        0.16 * widthCoverageScore +
        0.10 * verticalScore +
        0.20 * strictGuideScore +
        0.08 * areaPenalty;

      score *= centeringScore;
      // Soften the overlap punishment for correct traces.
      score *= 0.85 + 0.15 * overlapRatio;
      const rasterBlend = 0.65 + 0.35 * Math.min(1, rasterF1 * 1.4);
      score *= rasterBlend;

      // Hard caps: random scribbles that aren't actually on the guide go to near zero.
      if (rasterF1 < 0.08 || inGuideRatio < 0.50 || progressRatio < 0.45 || columnScore < 0.35) {
        score = Math.min(score, 0.05);
      } else {
        // Scale so partial traces cannot reach high scores.
        score *= Math.min(1, progressRatio / 0.85);
      }

      // If raster match suggests the ink is truly on the expected glyph,
      // raise the floor to be generous for correct traces.
      const looksOnGlyph =
        strokePrecision >= 0.06 &&
        glyphOverlap >= 0.10 &&
        inGuideRatio >= 0.45 &&
        overlapRatio >= 0.20 &&
        centeringScore >= 0.22;
      if (looksOnGlyph) {
        // Normalize using precision+recall instead of rasterF1 only.
        const t = Math.max(0, Math.min(1, (0.6 * glyphOverlap + 0.4 * strokePrecision) / 0.20));
        // Keep this generous but don't allow it to reach 100% by itself.
        // "100%" should come only from the strict perfect-trace snap below.
        const floorScore = Math.min(0.95, 0.75 + 0.25 * t);
        score = Math.max(score, floorScore);
      }

      // Perfect trace snap (word)
      const perfectWord =
        rasterF1 >= 0.30 &&
        strokePrecision >= 0.20 &&
        glyphOverlap >= 0.22 &&
        columnScore >= 0.85 &&
        verticalScore >= 0.55 &&
        progressRatio >= 0.65;
      if (perfectWord) score = 1.0;
    }

    // Make strict: allow very low scores for gibberish
    const clamped = Math.max(0.0, Math.min(1, Math.round(score * 100) / 100));
    const imageBase64 = canvasRef.current?.toDataURL("image/png");
    onComplete(clamped, durationSeconds, expected.split("").map((ch) => ({ letter: ch, accuracy: clamped })), imageBase64);
  };

  const handleClear = () => {
    strokesRef.current = [];
    setStrokeCount(0);
    redraw();
  };

  return (
    <div ref={wrapRef} className="tracing-canvas-wrap">
      <canvas
        ref={canvasRef}
        className="tracing-canvas"
        onMouseDown={handleStart}
        onMouseMove={handleMove}
        onMouseUp={handleEnd}
        onMouseLeave={handleEnd}
        onTouchStart={handleStart}
        onTouchMove={handleMove}
        onTouchEnd={handleEnd}
        style={{ touchAction: "none", cursor: disabled ? "not-allowed" : "crosshair" }}
      />
      <div className="form-row" style={{ marginTop: 12 }}>
        <button onClick={handleClear} disabled={disabled}>Clear</button>
        <button onClick={handleSubmit} disabled={disabled || strokeCount < 3}>Submit trace</button>
      </div>
    </div>
  );
}
