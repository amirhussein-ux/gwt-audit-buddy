import { z } from 'zod';

export const CheckItemSchema = z.object({
  key: z.string(),
  status: z.enum(['Pass', 'Fail', 'N/A', 'NotTested']),
});

export type CheckItem = z.infer<typeof CheckItemSchema>;

export const AuditCancellationSchema = z
  .object({
    requestedAt: z.string().nullable().optional(),
    completedAt: z.string().nullable().optional(),
  })
  .optional();

export const AuditLogSchema = z.object({
  _id: z.string().optional(),
  auditUrl: z.string().optional(),
  status: z.string().optional(),

  // Flat structure
  checks: z.array(CheckItemSchema).optional(),
  pageAudits: z.array(z.object({ url: z.string() })).optional(),
  crawlSummary: z
    .object({
      pagesCrawled: z.number().optional(),
    })
    .optional(),

  // Legacy nested structure
  auditResults: z
    .object({
      checks: z.array(CheckItemSchema).optional(),
      crawlSummary: z
        .object({
          pagesCrawled: z.number().optional(),
        })
        .optional(),
      pageAudits: z.array(z.object({ url: z.string() })).optional(),
    })
    .nullable()
    .optional(),

  // Metadata
  pst: z
    .object({
      found: z.boolean(),
      location: z.string().optional(),
    })
    .optional(),

  transparencySeal: z
    .object({
      found: z.boolean(),
      link: z.string().optional(),
    })
    .optional(),

  accessibility: z
    .object({
      altTextCoverage: z.number(),
      formLabels: z.number(),
    })
    .optional(),

  performance: z
    .object({
      loadTimeMs: z.number(),
      pagesCrawled: z.number().optional(),
    })
    .optional(),

  crawledPages: z.array(z.object({ url: z.string() })).optional(),
  masthead: z
    .object({
      aboutUs: z.boolean().optional(),
      contactUs: z.boolean().optional(),
    })
    .optional(),

  citizensCharter: z
    .object({
      found: z.boolean().optional(),
    })
    .optional(),

  createdAt: z.string().optional(),
});

export type AuditLog = z.infer<typeof AuditLogSchema>;

export const ComplianceScoreSchema = z
  .object({
    overallScore: z.number(),
    webPresence: z.object({
      stage1: z.number(),
      stage2: z.number(),
      stage3: z.number(),
      stage4: z.number(),
    }),
  })
  .nullable();

export type ComplianceScore = z.infer<typeof ComplianceScoreSchema>;

export const UIReportSchema = z
  .object({
    webPresence: z
      .object({
        stage1: z.number().optional(),
        stage2: z.number().optional(),
        stage3: z.number().optional(),
        stage4: z.number().optional(),
        total: z.number().optional(),
      })
      .optional(),
    webUsability: z
      .object({
        accessibility: z.number().optional(),
        identity: z.number().optional(),
        navigation: z.number().optional(),
        content: z.number().optional(),
        total: z.number().optional(),
      })
      .optional(),
    categoryResults: z.array(z.record(z.unknown())).optional(),
    methodology: z
      .object({
        pagesCrawled: z.number().optional(),
      })
      .optional(),
  })
  .optional();

export const AuditDetailDataSchema = z.object({
  audit: AuditLogSchema,
  compliance: ComplianceScoreSchema,
  uiReport: UIReportSchema.optional(),
});

export type AuditDetailData = z.infer<typeof AuditDetailDataSchema>;
