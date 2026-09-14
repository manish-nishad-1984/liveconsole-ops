import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { env } from '../config/env.js';

/**
 * File storage on local disk.
 *
 * On the live host this is `/app/uploads`, which the root web.config blocks from
 * the web and the deploy never deletes — files are only ever served by the API,
 * after it has checked the caller may see the record they belong to.
 *
 * Stored names are generated (`2026/09/<uuid>.jpg`), never the uploader's own file
 * name, so nothing a user types can steer where a file lands.
 */

const root = path.resolve(env.UPLOAD_DIR);

const resolveStored = (storedName: string): string => {
  const full = path.resolve(root, storedName);
  if (!full.startsWith(root + path.sep)) throw new Error('Invalid stored file name');
  return full;
};

export const ALLOWED_UPLOAD_TYPES: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'application/pdf': '.pdf',
};

export const saveFile = async (content: Buffer, mimeType: string): Promise<string> => {
  const extension = ALLOWED_UPLOAD_TYPES[mimeType] ?? '';
  const now = new Date();
  const folder = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  const storedName = `${folder}/${randomUUID()}${extension}`;

  await fs.promises.mkdir(path.join(root, folder), { recursive: true });
  await fs.promises.writeFile(resolveStored(storedName), content);
  return storedName;
};

export const openFile = (storedName: string): fs.ReadStream =>
  fs.createReadStream(resolveStored(storedName));

export const fileExists = async (storedName: string): Promise<boolean> =>
  fs.promises
    .access(resolveStored(storedName))
    .then(() => true)
    .catch(() => false);

/** Best-effort: a missing file is not an error worth failing a request over. */
export const deleteFile = async (storedName: string): Promise<void> => {
  await fs.promises.rm(resolveStored(storedName), { force: true });
};
