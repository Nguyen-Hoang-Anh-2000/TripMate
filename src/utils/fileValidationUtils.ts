const ALLOWED_IMAGE_EXTENSIONS = new Set([
  'jpg',
  'jpeg',
  'png',
  'gif',
  'webp',
  'bmp',
  'heic',
  'heif',
  'avif',
]);

export interface FileValidationResult {
  valid: boolean;
  errorVi?: string;
  errorEn?: string;
}

export function validateImageUploadFile(
  file: Pick<File, 'name' | 'type'> & { size?: number }
): FileValidationResult {
  const mime = (file.type || '').trim().toLowerCase();
  const fileName = (file.name || '').trim().toLowerCase();
  const dotIdx = fileName.lastIndexOf('.');
  const ext = dotIdx >= 0 ? fileName.slice(dotIdx + 1) : '';

  const hasValidMime = mime.startsWith('image/') && !mime.includes('svg');
  const hasValidExt = !ext || ALLOWED_IMAGE_EXTENSIONS.has(ext);

  if (!hasValidMime || !hasValidExt) {
    return {
      valid: false,
      errorVi: 'ERR-FILE-01: Định dạng tệp không hợp lệ. Vui lòng chỉ chọn tệp hình ảnh (PNG, JPG, WEBP).',
      errorEn: 'ERR-FILE-01: Invalid file format. Please select an image file only (PNG, JPG, WEBP).',
    };
  }

  return { valid: true };
}
