import { useEffect, useRef, useState } from "react";

type CropRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type Point = {
  x: number;
  y: number;
};

type ResizeHandle = "nw" | "ne" | "se" | "sw";

type InteractionState = {
  mode: "move" | "resize";
  startPoint: Point;
  startCrop: CropRect;
  handle?: ResizeHandle;
};

type Props = {
  busy: boolean;
  onFileChange: (file: File | null) => void;
  accept?: string;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function toCropRect(start: Point, end: Point): CropRect {
  return {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
  };
}

function fileNameWithoutExt(fileName: string): string {
  const idx = fileName.lastIndexOf(".");
  return idx === -1 ? fileName : fileName.slice(0, idx);
}

function createDefaultCrop(width: number, height: number): CropRect {
  const cropWidth = Math.max(80, Math.floor(width * 0.72));
  const cropHeight = Math.max(80, Math.floor(height * 0.58));
  return {
    x: Math.floor((width - cropWidth) / 2),
    y: Math.floor((height - cropHeight) / 2),
    width: cropWidth,
    height: cropHeight,
  };
}

function extFromMime(mime: string): string {
  if (mime.includes("png")) return "png";
  if (mime.includes("jpeg") || mime.includes("jpg")) return "jpg";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("bmp")) return "bmp";
  if (mime.includes("tiff")) return "tiff";
  return "png";
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Could not create cropped image."));
          return;
        }
        resolve(blob);
      },
      type,
      0.95
    );
  });
}

export function ImageCropUploader({ busy, onFileChange, accept = "image/jpeg,image/png,image/webp,image/bmp,image/tiff" }: Props) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selection, setSelection] = useState<CropRect | null>(null);
  const [cropEnabled, setCropEnabled] = useState(false);
  const [interaction, setInteraction] = useState<InteractionState | null>(null);
  const [cropping, setCropping] = useState(false);
  const [selectedSource, setSelectedSource] = useState<"full" | "crop">("full");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!originalFile) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(originalFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [originalFile]);

  function onSelectFile(file: File | null) {
    setOriginalFile(file);
    setSelection(null);
    setCropEnabled(!!file);
    setInteraction(null);
    setSelectedSource("full");
    setError(null);
    onFileChange(file);
  }

  function initializeCropBox() {
    const img = imgRef.current;
    if (!img) return;
    if (img.clientWidth <= 0 || img.clientHeight <= 0) return;
    setSelection(createDefaultCrop(img.clientWidth, img.clientHeight));
    setCropEnabled(true);
  }

  function getPoint(event: React.PointerEvent<HTMLDivElement>): Point | null {
    const img = imgRef.current;
    if (!img) return null;
    const rect = img.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    return {
      x: clamp(event.clientX - rect.left, 0, rect.width),
      y: clamp(event.clientY - rect.top, 0, rect.height),
    };
  }

  function handleStagePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!interaction || !selection || !cropEnabled) return;
    const point = getPoint(event);
    if (!point) return;
    const img = imgRef.current;
    if (!img) return;

    const width = img.clientWidth;
    const height = img.clientHeight;
    const dx = point.x - interaction.startPoint.x;
    const dy = point.y - interaction.startPoint.y;
    const minSize = 48;

    if (interaction.mode === "move") {
      const x = clamp(interaction.startCrop.x + dx, 0, width - interaction.startCrop.width);
      const y = clamp(interaction.startCrop.y + dy, 0, height - interaction.startCrop.height);
      setSelection({ ...selection, x, y });
      return;
    }

    let left = interaction.startCrop.x;
    let top = interaction.startCrop.y;
    let right = interaction.startCrop.x + interaction.startCrop.width;
    let bottom = interaction.startCrop.y + interaction.startCrop.height;

    switch (interaction.handle) {
      case "nw":
        left += dx;
        top += dy;
        break;
      case "ne":
        right += dx;
        top += dy;
        break;
      case "se":
        right += dx;
        bottom += dy;
        break;
      case "sw":
        left += dx;
        bottom += dy;
        break;
      default:
        break;
    }

    left = clamp(left, 0, width - minSize);
    top = clamp(top, 0, height - minSize);
    right = clamp(right, minSize, width);
    bottom = clamp(bottom, minSize, height);

    if (right - left < minSize) {
      if (interaction.handle === "nw" || interaction.handle === "sw") {
        left = right - minSize;
      } else {
        right = left + minSize;
      }
    }

    if (bottom - top < minSize) {
      if (interaction.handle === "nw" || interaction.handle === "ne") {
        top = bottom - minSize;
      } else {
        bottom = top + minSize;
      }
    }

    setSelection({
      x: clamp(left, 0, width - minSize),
      y: clamp(top, 0, height - minSize),
      width: clamp(right - left, minSize, width),
      height: clamp(bottom - top, minSize, height),
    });
  }

  function endInteraction() {
    if (!interaction) return;
    setInteraction(null);
  }

  function startMove(event: React.PointerEvent<HTMLDivElement>) {
    if (busy || !selection || !cropEnabled) return;
    event.preventDefault();
    const point = getPoint(event);
    if (!point) return;
    setInteraction({ mode: "move", startPoint: point, startCrop: selection });
  }

  function startResize(handle: ResizeHandle, event: React.PointerEvent<HTMLDivElement>) {
    if (busy || !selection || !cropEnabled) return;
    event.preventDefault();
    event.stopPropagation();
    const point = getPoint(event);
    if (!point) return;
    setInteraction({ mode: "resize", handle, startPoint: point, startCrop: selection });
  }

  async function applyCrop() {
    if (!originalFile || !selection || !imgRef.current) return;
    if (!cropEnabled) {
      setError("Enable crop box first.");
      return;
    }
    if (selection.width < 12 || selection.height < 12) {
      setError("Crop area is too small. Draw a larger box.");
      return;
    }

    const img = imgRef.current;
    const displayWidth = img.clientWidth;
    const displayHeight = img.clientHeight;
    if (displayWidth <= 0 || displayHeight <= 0) {
      setError("Image preview is not ready yet.");
      return;
    }

    setCropping(true);
    setError(null);
    try {
      const scaleX = img.naturalWidth / displayWidth;
      const scaleY = img.naturalHeight / displayHeight;
      const sx = Math.max(0, Math.floor(selection.x * scaleX));
      const sy = Math.max(0, Math.floor(selection.y * scaleY));
      const sw = Math.max(1, Math.floor(selection.width * scaleX));
      const sh = Math.max(1, Math.floor(selection.height * scaleY));

      const canvas = document.createElement("canvas");
      canvas.width = sw;
      canvas.height = sh;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        throw new Error("Canvas is not available in this browser.");
      }

      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
      const blobType = originalFile.type || "image/png";
      const blob = await canvasToBlob(canvas, blobType);
      const ext = extFromMime(blob.type || blobType);
      const cropped = new File([blob], `${fileNameWithoutExt(originalFile.name)}_crop.${ext}`, {
        type: blob.type || blobType,
        lastModified: Date.now(),
      });

      onFileChange(cropped);
      setSelectedSource("crop");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not crop image.");
    } finally {
      setCropping(false);
    }
  }

  function removeCropAndUseFullImage() {
    if (!originalFile) return;
    onFileChange(originalFile);
    setCropEnabled(false);
    setSelectedSource("full");
    setError(null);
  }

  function enableCropBox() {
    const img = imgRef.current;
    if (!img || !originalFile) return;
    setCropEnabled(true);
    if (!selection) {
      setSelection(createDefaultCrop(img.clientWidth, img.clientHeight));
    }
  }

  useEffect(() => {
    if (!previewUrl) {
      setSelection(null);
      setCropEnabled(false);
      setInteraction(null);
      return;
    }
    setInteraction(null);
  }, [previewUrl]);

  return (
    <div className="crop-upload-stack">
      <input
        type="file"
        accept={accept}
        disabled={busy}
        onChange={(e) => onSelectFile(e.target.files?.[0] ?? null)}
      />

      {previewUrl ? (
        <>
          <p className="crop-helper">Move the crop box, drag the corner handles to resize, or remove the box to use full image.</p>
          <div
            className="crop-stage"
            onPointerMove={handleStagePointerMove}
            onPointerUp={endInteraction}
            onPointerCancel={endInteraction}
            onPointerLeave={endInteraction}
          >
            <img
              ref={imgRef}
              src={previewUrl}
              alt="Upload preview"
              className="crop-image"
              draggable={false}
              onLoad={initializeCropBox}
            />
            {selection && cropEnabled ? (
              <div
                className="crop-box"
                onPointerDown={startMove}
                style={{
                  left: `${selection.x}px`,
                  top: `${selection.y}px`,
                  width: `${selection.width}px`,
                  height: `${selection.height}px`,
                }}
              >
                <div className="crop-handle crop-handle-nw" onPointerDown={(e) => startResize("nw", e)} />
                <div className="crop-handle crop-handle-ne" onPointerDown={(e) => startResize("ne", e)} />
                <div className="crop-handle crop-handle-se" onPointerDown={(e) => startResize("se", e)} />
                <div className="crop-handle crop-handle-sw" onPointerDown={(e) => startResize("sw", e)} />
              </div>
            ) : null}
          </div>

          <div className="crop-actions">
            <button type="button" onClick={applyCrop} disabled={busy || cropping || !selection || !cropEnabled}>
              {cropping ? "Applying crop…" : "Apply crop"}
            </button>
            {cropEnabled ? (
              <button type="button" onClick={removeCropAndUseFullImage} disabled={busy || !originalFile}>
                Remove crop (use full image)
              </button>
            ) : (
              <button type="button" onClick={enableCropBox} disabled={busy || !originalFile}>
                Enable crop box
              </button>
            )}
            <span className="crop-status">Using: {selectedSource === "crop" ? "Cropped image" : "Full image"}</span>
          </div>
          {error ? <div className="error-banner">{error}</div> : null}
        </>
      ) : null}
    </div>
  );
}
