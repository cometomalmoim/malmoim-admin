/** Activity gallery photos only. Review attachments have a separate policy.
 * MB labels here use 1024-based units as specified by the product contract.
 * File limits do not imply that a multipart request fits a hosting body limit. */
export const activityPhotoPolicy = Object.freeze({
  maxFiles: 10,
  maxBytes: 4.5 * 1024 * 1024,
  totalBytes: 45 * 1024 * 1024,
  mimeTypes: Object.freeze(["image/jpeg", "image/png", "image/webp"] as const),
});
/** Conservative temporary envelope ceiling, NOT a verified Vercel limit.
 * Full 4.5MiB files cannot pass through this disabled multipart endpoint.
 * A separate transport design is required before enabling any upload. */
export const activityUploadBodyBytes = 4_000_000;
