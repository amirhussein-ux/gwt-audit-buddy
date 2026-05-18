import { z } from 'zod';

export const DashboardStatusDistributionSchema = z.object({
  excellent: z.number(),
  good: z.number(),
  fair: z.number(),
  poor: z.number(),
  critical: z.number(),
});

export const DashboardStatsSchema = z.object({
  totalAgencies: z.number(),
  averageCompliance: z.number(),
  totalAudits: z.number(),
  statusDistribution: DashboardStatusDistributionSchema,
});

export type DashboardStats = z.infer<typeof DashboardStatsSchema>;
