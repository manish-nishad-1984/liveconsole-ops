/**
 * Enum presentation: turning `PENDING_APPROVAL` into "Pending Approval" with a
 * semantic colour, for every enum in the system.
 *
 * A per-enum lookup table would rot the moment a module is added. Labels come
 * from a humaniser plus an acronym dictionary; tones come from ordered keyword
 * rules. Both accept explicit overrides for the genuinely special cases, so
 * `StatusBadge` never needs per-page colour logic.
 */

export type StatusTone =
  | 'neutral' // not started, informational
  | 'info' // in flight, no action needed
  | 'progress' // actively being worked
  | 'success' // terminal, good
  | 'warning' // needs attention
  | 'danger' // failed, rejected, terminal bad
  | 'muted'; // dormant, cancelled, not applicable

/** Words that must not be title-cased naively. Extend for your domain. */
const ACRONYMS: Record<string, string> = {
  ID: 'ID',
  URL: 'URL',
  API: 'API',
  PDF: 'PDF',
  CSV: 'CSV',
  HR: 'HR',
  QC: 'QC',
};

/** Whole-value overrides where the humanised form reads badly. */
const LABEL_OVERRIDES: Record<string, string> = {
  IN_PROGRESS: 'In Progress',
  ON_HOLD: 'On Hold',
};

/** Ordered: the first rule whose keyword appears in the value wins. */
const TONE_RULES: { tone: StatusTone; keywords: string[] }[] = [
  {
    tone: 'danger',
    keywords: ['REJECT', 'FAIL', 'ERROR', 'DISABLED', 'SUSPENDED', 'EXPIRED', 'OVERDUE', 'DENIED'],
  },
  { tone: 'muted', keywords: ['CANCEL', 'ARCHIV', 'CLOSED', 'VOID', 'INACTIVE', 'DELETED'] },
  {
    tone: 'success',
    keywords: [
      'ACTIVE',
      'APPROVED',
      'COMPLETED',
      'PAID',
      'DONE',
      'SUCCESS',
      'VERIFIED',
      'ENABLED',
      'GIVEN',
    ],
  },
  { tone: 'warning', keywords: ['WARNING', 'LOCKED', 'HOLD', 'PARTIAL', 'BLOCKED', 'ATTENTION'] },
  {
    tone: 'progress',
    keywords: ['IN_PROGRESS', 'PROCESSING', 'RUNNING', 'ONGOING', 'STARTED', 'ON_RENT'],
  },
  {
    tone: 'info',
    keywords: [
      'SUBMITTED',
      'SENT',
      'INVITED',
      'SCHEDULED',
      'QUEUED',
      'REVIEW',
      'RETURNED',
      'UPCOMING',
    ],
  },
  { tone: 'neutral', keywords: ['PENDING', 'DRAFT', 'NEW', 'OPEN', 'TODO'] },
];

/** `PENDING_APPROVAL` → `Pending Approval`. */
export const humanizeEnum = (value: string): string => {
  const override = LABEL_OVERRIDES[value];
  if (override) return override;

  return value
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((word) => {
      const upper = word.toUpperCase();
      const acronym = ACRONYMS[upper];
      if (acronym) return acronym;
      return upper.charAt(0) + word.slice(1).toLowerCase();
    })
    .join(' ');
};

export interface DescribedStatus {
  label: string;
  tone: StatusTone;
}

export const describeStatus = (status: string | null | undefined): DescribedStatus => {
  if (!status) return { label: '—', tone: 'muted' };

  const upper = status.toUpperCase();
  const rule = TONE_RULES.find(({ keywords }) =>
    keywords.some((keyword) => upper.includes(keyword)),
  );

  return { label: humanizeEnum(upper), tone: rule?.tone ?? 'neutral' };
};
