import { DashboardStatsSchema } from '../validation/dashboardSchemas';
import type { DashboardStats } from '../validation/dashboardSchemas';

type ParseOk<T> = { ok: true; data: T };
type ParseErr = { ok: false; error: string; issues?: unknown };
export type ParseResult<T> = ParseOk<T> | ParseErr;

const normalizeFiniteNumber = (value: unknown, fallback = 0): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const parseDashboardSummary = (payload: unknown): ParseResult<DashboardStats> => {
  const candidate =
    payload && typeof payload === 'object'
      ? (payload as Record<string, unknown>)
      : null;

  if (!candidate) {
    return { ok: false, error: 'Invalid dashboard summary payload' };
  }

  const normalized = {
    totalAgencies: normalizeFiniteNumber(candidate.totalAgencies),
    averageCompliance: normalizeFiniteNumber(candidate.averageCompliance),
    totalAudits: normalizeFiniteNumber(candidate.totalAudits),
    statusDistribution:
      candidate.statusDistribution && typeof candidate.statusDistribution === 'object'
        ? {
            excellent: normalizeFiniteNumber((candidate.statusDistribution as Record<string, unknown>).excellent),
            good: normalizeFiniteNumber((candidate.statusDistribution as Record<string, unknown>).good),
            fair: normalizeFiniteNumber((candidate.statusDistribution as Record<string, unknown>).fair),
            poor: normalizeFiniteNumber((candidate.statusDistribution as Record<string, unknown>).poor),
            critical: normalizeFiniteNumber((candidate.statusDistribution as Record<string, unknown>).critical),
          }
        : { excellent: 0, good: 0, fair: 0, poor: 0, critical: 0 },
  };

  const parsed = DashboardStatsSchema.safeParse(normalized);
  if (!parsed.success) {
    return { ok: false, error: 'Invalid dashboard summary shape', issues: parsed.error.issues };
  }

  return { ok: true, data: parsed.data };
};
