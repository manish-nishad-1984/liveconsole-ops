import { z } from 'zod';

import { optionalText, uuid } from '../../lib/validators.js';

export const closureSchema = z.object({
  /** Why the line was drawn — "year end", "handover", "testing". */
  note: optionalText(200),
});

export const closureParams = z.object({ id: uuid });

export type ClosureInput = z.infer<typeof closureSchema>;
