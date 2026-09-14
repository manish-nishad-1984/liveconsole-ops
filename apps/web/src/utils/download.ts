import { toast } from 'sonner';

import { getErrorMessage } from '@/utils/errors';

/** Save a blob the API returned, under the name the server suggested. */
export const saveBlob = (blob: Blob, fileName: string): void => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

/** Run a CSV export and save it, with a toast if it fails. */
export const runExport = async (
  request: () => Promise<{ blob: Blob; fileName: string | null }>,
  fallbackName: string,
): Promise<void> => {
  try {
    const { blob, fileName } = await request();
    saveBlob(blob, fileName ?? fallbackName);
  } catch (error) {
    toast.error('Export failed', { description: getErrorMessage(error) });
  }
};
