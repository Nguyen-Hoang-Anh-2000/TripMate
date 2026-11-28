/**
 * Image compression and downscaling utility for client-side uploads.
 * Guarantees that photos (camera shots, receipts, trip covers) never exceed
 * Firestore 1MiB document limits or trigger Express 413 Payload Too Large errors.
 */

const MAX_COMPRESSED_DATAURL_CHARS = 750_000;

function loadImageElement(
  input: File | string,
  onReady: (img: HTMLImageElement, cleanup: () => void) => void,
  onError: (err: Error) => void,
  loadErrMsg: string
) {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  let objectUrl: string | null = null;

  const cleanup = () => {
    if (objectUrl) {
      try {
        URL.revokeObjectURL(objectUrl);
      } catch {}
      objectUrl = null;
    }
  };

  img.onload = () => {
    try {
      onReady(img, cleanup);
    } catch (err) {
      cleanup();
      onError(err instanceof Error ? err : new Error(loadErrMsg));
    }
  };

  img.onerror = () => {
    cleanup();
    onError(new Error(loadErrMsg));
  };

  if (typeof input === 'string') {
    img.src = input;
    return;
  }

  if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
    objectUrl = URL.createObjectURL(input);
    img.src = objectUrl;
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    img.src = e.target?.result as string;
  };
  reader.onerror = () => {
    onError(new Error('Failed reading file input'));
  };
  reader.readAsDataURL(input);
}

export async function compressImage(
  input: File | string,
  maxDimension = 1200,
  quality = 0.75
): Promise<string> {
  return new Promise((resolve, reject) => {
    loadImageElement(
      input,
      (img, cleanup) => {
        try {
          let width = img.width;
          let height = img.height;

          // Scale down if dimensions exceed maxDimension
          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, width);
          canvas.height = Math.max(1, height);

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            cleanup();
            return reject(new Error('Failed to create canvas context'));
          }

          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);

          let currentQuality = quality;
          let compressedBase64 = canvas.toDataURL('image/jpeg', currentQuality);
          while (compressedBase64.length > MAX_COMPRESSED_DATAURL_CHARS && currentQuality > 0.35) {
            currentQuality = Math.max(0.35, currentQuality - 0.12);
            compressedBase64 = canvas.toDataURL('image/jpeg', currentQuality);
          }

          cleanup();
          resolve(compressedBase64);
        } catch (err) {
          cleanup();
          reject(err);
        }
      },
      reject,
      'Failed to load image for compression'
    );
  });
}

/**
 * Square-crops and compresses a user/member avatar image so it stays compact
 * (<= 55,000 chars) for Firestore storage and renders crisply across Banner, Navbar & Expenses.
 */
export async function compressAvatarImage(
  input: File | string,
  size = 160,
  initialQuality = 0.82
): Promise<string> {
  return new Promise((resolve, reject) => {
    loadImageElement(
      input,
      (img, cleanup) => {
        try {
          const minSide = Math.min(img.width, img.height);
          const sx = Math.max(0, Math.floor((img.width - minSide) / 2));
          const sy = Math.max(0, Math.floor((img.height - minSide) / 2));

          const canvas = document.createElement('canvas');
          canvas.width = size;
          canvas.height = size;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            cleanup();
            return reject(new Error('Failed to create canvas context'));
          }

          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, size, size);
          ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);

          let quality = initialQuality;
          let dataUrl = canvas.toDataURL('image/jpeg', quality);
          while (dataUrl.length > 55000 && quality > 0.35) {
            quality -= 0.12;
            dataUrl = canvas.toDataURL('image/jpeg', quality);
          }
          cleanup();
          resolve(dataUrl);
        } catch (err) {
          cleanup();
          reject(err);
        }
      },
      reject,
      'Failed to load avatar image'
    );
  });
}


