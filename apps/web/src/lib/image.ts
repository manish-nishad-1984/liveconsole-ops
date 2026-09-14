/**
 * Receipt photos straight off a phone camera are 3–8 MB. Site connections are
 * slow, so photos are scaled to a readable size and re-encoded as JPEG in the
 * browser before upload — a receipt stays legible at 1600px on the long edge.
 * PDFs and anything that fails to decode are sent untouched.
 */

const MAX_EDGE = 1600;
const QUALITY = 0.8;
/** Below this there is nothing worth saving. */
const SKIP_BELOW_BYTES = 400 * 1024;

const loadImage = (file: File): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read the image'));
    };
    image.src = url;
  });

export interface PreparedUpload {
  blob: Blob;
  fileName: string;
}

export const prepareUpload = async (file: File): Promise<PreparedUpload> => {
  if (!file.type.startsWith('image/') || file.size < SKIP_BELOW_BYTES) {
    return { blob: file, fileName: file.name };
  }

  try {
    const image = await loadImage(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(image.naturalWidth * scale);
    canvas.height = Math.round(image.naturalHeight * scale);

    const context = canvas.getContext('2d');
    if (!context) return { blob: file, fileName: file.name };
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', QUALITY),
    );
    if (!blob || blob.size >= file.size) return { blob: file, fileName: file.name };

    const baseName = file.name.replace(/\.[^.]+$/, '') || 'receipt';
    return { blob, fileName: `${baseName}.jpg` };
  } catch {
    // HEIC on some browsers cannot be decoded — let the server decide.
    return { blob: file, fileName: file.name };
  }
};

export const formatFileSize = (bytes: number): string =>
  bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`;
