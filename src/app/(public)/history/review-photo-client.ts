import { ORIGINAL_PHOTO_LIMIT, PHOTO_LIMIT, PHOTO_MAX_EDGE } from "./review-types";
import { reviewPhotoExtension } from "./review-photo-format";

const supportedTypes = ["image/jpeg", "image/png", "image/webp"];
const qualities = [0.86, 0.8, 0.74];

export function reviewPhotoSize(width: number, height: number, maxEdge = PHOTO_MAX_EDGE) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) throw new Error("사진 크기를 확인할 수 없어요.");
  const ratio = Math.min(1, maxEdge / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * ratio)), height: Math.max(1, Math.round(height * ratio)) };
}

async function decodePhoto(file: File) {
  if (typeof createImageBitmap === "function") {
    try {
      const image = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { image, width: image.width, height: image.height, release: () => image.close() };
    } catch { /* Safari / decoder fallback: use the browser's oriented image element. */ }
  }
  const url = URL.createObjectURL(file);
  const image = new Image();
  try {
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => { image.src = ""; reject(new Error("사진을 여는 데 시간이 오래 걸려요. 다시 선택해주세요.")); }, 15000);
      image.onload = () => { clearTimeout(timeout); resolve(); };
      image.onerror = () => { clearTimeout(timeout); reject(new Error("사진을 열 수 없어요. 다른 JPG·PNG·WebP 파일을 선택해주세요.")); };
      image.src = url;
    });
    return { image, width: image.naturalWidth, height: image.naturalHeight, release: () => URL.revokeObjectURL(url) };
  } catch (error) { URL.revokeObjectURL(url); throw error; }
}

function encode(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("사진을 변환하지 못했어요. 다른 사진을 선택해주세요.")), type, quality);
  });
}

/** Called only after a file-selection event. Never uploads or returns the original bytes. */
export async function prepareReviewPhoto(file: File): Promise<File> {
  if (!supportedTypes.includes(file.type)) throw new Error("JPG, PNG, WebP 사진만 선택할 수 있어요.");
  if (!file.size || file.size > ORIGINAL_PHOTO_LIMIT) throw new Error("원본 사진은 장당 5MB 이하로 선택해주세요. 빈 파일은 첨부할 수 없어요.");
  const decoded = await decodePhoto(file);
  const canvas = document.createElement("canvas");
  try {
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("이 브라우저에서 사진을 처리할 수 없어요. Safari나 Chrome을 업데이트한 뒤 다시 시도해주세요.");
    let outputType = "image/webp";
    let previousSize = "";
    for (const edge of [PHOTO_MAX_EDGE, 1440, 1280]) {
      const size = reviewPhotoSize(decoded.width, decoded.height, edge);
      const key = `${size.width}x${size.height}`;
      if (key === previousSize) continue;
      previousSize = key;
      canvas.width = size.width; canvas.height = size.height;
      context.imageSmoothingEnabled = true; context.imageSmoothingQuality = "high";
      context.drawImage(decoded.image, 0, 0, size.width, size.height);
      for (const quality of qualities) {
        let blob = await encode(canvas, outputType, quality);
        // Unsupported canvas encoders silently return PNG, including on some Safari versions.
        if (outputType === "image/webp" && blob.type !== "image/webp") {
          const pixels = context.getImageData(0, 0, size.width, size.height).data;
          let transparent = false;
          for (let index = 3; index < pixels.length; index += 4) if (pixels[index] !== 255) { transparent = true; break; }
          outputType = transparent ? "image/png" : "image/jpeg";
          blob = await encode(canvas, outputType, quality);
        }
        if (blob.size > 0 && blob.size <= PHOTO_LIMIT) {
          const extension = reviewPhotoExtension(new Uint8Array(await blob.arrayBuffer()), blob.type);
          if (!extension) throw new Error("변환한 사진의 형식을 확인하지 못했어요. 다른 사진을 선택해주세요.");
          return new File([blob], `${file.name.replace(/\.[^.]*$/, "")}.${extension}`, { type: blob.type, lastModified: file.lastModified });
        }
        if (blob.type === "image/png") break; // PNG ignores the quality argument.
      }
    }
    throw new Error("화질을 유지하면서 사진을 1MB 이하로 줄이지 못했어요. 다른 사진이나 작은 사진을 선택해주세요.");
  } finally { decoded.release(); canvas.width = 1; canvas.height = 1; }
}
