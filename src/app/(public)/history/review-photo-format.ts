/** Check the declared MIME against the actual container header, not the filename. */
export function reviewPhotoExtension(bytes: Uint8Array, mime: string): "jpg" | "png" | "webp" | null {
  if (mime === "image/jpeg" && bytes.length >= 12 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
    && bytes.at(-2) === 255 && bytes.at(-1) === 217) return "jpg";
  if (mime === "image/png" && bytes.length >= 33
    && [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes[index] === byte)
    && bytes[8] === 0 && bytes[9] === 0 && bytes[10] === 0 && bytes[11] === 13
    && String.fromCharCode(...bytes.slice(12, 16)) === "IHDR") return "png";
  if (mime === "image/webp" && bytes.length >= 20
    && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF"
    && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
    && ["VP8 ", "VP8L", "VP8X"].includes(String.fromCharCode(...bytes.slice(12, 16)))
    && new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(4, true) + 8 === bytes.length) return "webp";
  return null;
}
