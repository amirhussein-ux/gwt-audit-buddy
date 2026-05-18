import type { AuditDetailData, CheckItem } from '@/lib/validation/auditSchemas';
import { AuditDetailDataSchema } from '@/lib/validation/auditSchemas';

type ParseOk<T> = { ok: true; data: T };
type ParseErr = { ok: false; error: string; issues?: unknown };
export type ParseResult<T> = ParseOk<T> | ParseErr;

export type AuditDetailUiModel = {
  audit: {
    _id?: string;
    auditUrl: string;
    createdAt: string;
    status: string;

    checks: CheckItem[];
    pageAudits: Array<{ url: string }>;
    crawledPages: Array<{ url: string }>;
    crawlSummary?: { pagesCrawled?: number };

    pst?: { found: boolean; location?: string };
    transparencySeal?: { found: boolean; link?: string };

    performance?: { loadTimeMs: number; pagesCrawled?: number };

    masthead?: { aboutUs?: boolean; contactUs?: boolean };
    citizensCharter?: { found?: boolean };

    auditResults?: {
      checks?: CheckItem[] | undefined;
      crawlSummary?: { pagesCrawled?: number } | undefined;
      pageAudits?: Array<{ url: string }> | undefined;
    } | null;
  };
  compliance: NonNullable<AuditDetailData['compliance']>;
  uiReport?: NonNullable<AuditDetailData['uiReport']>;
};

const normalizeAuditUrl = (value: unknown): string => {
  return typeof value === 'string' && value.trim().length > 0 ? value : 'Unknown audited site';
};

const normalizeString = (value: unknown): string => {
  return typeof value === 'string' ? value : '';
};

const normalizeCheckItems = (items: unknown): CheckItem[] => {
  if (!Array.isArray(items)) return [];

  return items.map((item, idx) => {
    const candidate = item as Partial<CheckItem> & { key?: unknown; status?: unknown };

    const key =
      typeof candidate.key === 'string' && candidate.key.trim().length > 0 ? candidate.key : `generated-check-${idx}`;

    const status =
      candidate.status === 'Pass' || candidate.status === 'Fail' || candidate.status === 'N/A' || candidate.status === 'NotTested'
        ? candidate.status
        : 'NotTested';

    return { key, status };
  });
};

const pickChecks = (audit: AuditDetailData['audit']): CheckItem[] => {
  const flat = normalizeCheckItems(audit.checks);
  const legacy = normalizeCheckItems(audit.auditResults?.checks);

  // Prefer flat if present (non-empty), else legacy.
  return flat.length > 0 ? flat : legacy;
};

const normalizeUrlArray = (items: unknown): Array<{ url: string }> => {
  if (!Array.isArray(items)) return [];
  const normalized = items
    .map((item) => {
      const candidate = item as { url?: unknown };
      const url = typeof candidate.url === 'string' ? candidate.url.trim() : '';
      return { url };
    })
    .filter((x) => x.url.length > 0);

  return normalized;
};

export const mapAuditResponseToUiModel = (data: AuditDetailData): AuditDetailUiModel => {
  const audit = data.audit;

  const checks = pickChecks(audit);

  const pageAudits = normalizeUrlArray(audit.pageAudits);
  const crawledPages = normalizeUrlArray(audit.crawledPages);

  const pst =
    audit.pst && typeof audit.pst === 'object'
      ? {
          found: audit.pst.found === true,
          location: typeof audit.pst.location === 'string' ? audit.pst.location : undefined,
        }
      : undefined;

  const transparencySeal =
    audit.transparencySeal && typeof audit.transparencySeal === 'object'
      ? {
          found: audit.transparencySeal.found === true,
          link: typeof audit.transparencySeal.link === 'string' ? audit.transparencySeal.link : undefined,
        }
      : undefined;

  const performance =
    audit.performance && typeof audit.performance === 'object'
      ? {
          loadTimeMs: typeof audit.performance.loadTimeMs === 'number' ? audit.performance.loadTimeMs : 0,
          pagesCrawled: typeof audit.performance.pagesCrawled === 'number' ? audit.performance.pagesCrawled : undefined,
        }
      : undefined;

  const auditResults = audit.auditResults
    ? {
        checks: normalizeCheckItems(audit.auditResults.checks),
        crawlSummary:
          audit.auditResults.crawlSummary && typeof audit.auditResults.crawlSummary === 'object'
            ? {
                pagesCrawled:
                  typeof audit.auditResults.crawlSummary.pagesCrawled === 'number'
                    ? audit.auditResults.crawlSummary.pagesCrawled
                    : undefined,
              }
            : undefined,
        pageAudits: normalizeUrlArray(audit.auditResults.pageAudits),
      }
    : null;

  const compliance =
    data.compliance ?? {
      overallScore: 0,
      webPresence: { stage1: 0, stage2: 0, stage3: 0, stage4: 0 },
    };

  return {
    audit: {
      _id: audit._id,
      auditUrl: normalizeAuditUrl(audit.auditUrl),
      createdAt: normalizeString(audit.createdAt),
      status: typeof audit.status === 'string' ? audit.status : 'unknown',

      checks,
      pageAudits,
      crawledPages,

      crawlSummary:
        audit.crawlSummary && typeof audit.crawlSummary === 'object'
          ? {
              pagesCrawled: typeof audit.crawlSummary.pagesCrawled === 'number' ? audit.crawlSummary.pagesCrawled : undefined,
            }
          : undefined,

      pst,
      transparencySeal,
      performance,

      masthead: audit.masthead && typeof audit.masthead === 'object'
        ? {
            aboutUs: typeof audit.masthead.aboutUs === 'boolean' ? audit.masthead.aboutUs : undefined,
            contactUs: typeof audit.masthead.contactUs === 'boolean' ? audit.masthead.contactUs : undefined,
          }
        : undefined,

      citizensCharter: audit.citizensCharter && typeof audit.citizensCharter === 'object'
        ? {
            found: typeof audit.citizensCharter.found === 'boolean' ? audit.citizensCharter.found : undefined,
          }
        : undefined,

      auditResults,
    },
    compliance,
    uiReport: data.uiReport ?? undefined,
  };
};

export const parseAuditDetailResponse = (payload: unknown): ParseResult<AuditDetailData> => {
  const parsed = AuditDetailDataSchema.safeParse(payload);

  if (!parsed.success) {
    return {
      ok: false,
      error: 'Invalid audit detail payload',
      issues: parsed.error.issues,
    };
  }

  return {
    ok: true,
    data: parsed.data,
  };
};
