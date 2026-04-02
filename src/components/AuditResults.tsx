import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";

export interface AuditCategory {
  name: string;
  items: AuditItem[];
}

export interface AuditItem {
  id: string;
  criterion: string;
  status: "Pass" | "Fail" | "N/A";
  remark: string;
}

export interface AuditResultData {
  url: string;
  date: string;
  webPresence: {
    stage1: number;
    stage2: number;
    stage3: number;
    stage4: number;
    // transmuted points (optional) used only for Web Presence UI
    stage1Point?: number;
    stage2Point?: number;
    stage3Point?: number;
    stage4Point?: number;
    legend?: Record<string, { label: string; color: string }>;
    total: number;
  };
  webUsability: {
    accessibility: number;
    identity: number;
    navigation: number;
    content: number;
    total: number;
  };
  categories: AuditCategory[];
  methodology?: {
    mappedGuidelines: number;
    evaluatedGuidelines: number;
    coveragePercent: number;
    pagesCrawled: number;
    generatedAt: string;
  };
  traceability?: {
    rowNo: string;
    key: string;
    guideline: string;
    category: string;
    assessmentForm: string;
    assessmentStage?: string;
    assessmentSection: string;
    automationMethod: string;
    status: "Pass" | "Fail" | "N/A";
    evidence: string;
  }[];
}

interface AuditResultsProps {
  data: AuditResultData | null;
}

const getStatusColor = (status: "Pass" | "Fail" | "N/A") => {
  switch (status) {
    case "Pass":
      return "bg-success/10 text-success border-success/20";
    case "Fail":
      return "bg-destructive/10 text-destructive border-destructive/20";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
};

const getRemarkClass = (pct: number) => {
  if (pct >= 80) return "text-success";
  if (pct >= 50) return "text-warning";
  return "text-destructive";
};

const getRemarkLabel = (pct: number) => {
  if (pct >= 80) return "Compliant";
  if (pct >= 50) return "Partial";
  return "Noncompliant";
};

// Fallback percent -> point mapping (same rules as backend)
function percentToPointClient(percent: number) {
  if (percent >= 90) return 1;
  if (percent >= 75) return 2;
  if (percent >= 50) return 3;
  return 0;
}

function statusToYesNo(status: "Pass" | "Fail" | "N/A") {
  if (status === "Pass") return "Yes";
  if (status === "Fail") return "No";
  return "N/A";
}

function buildTraceabilityByForm(
  rows: NonNullable<AuditResultData["traceability"]>
) {
  const forms = new Map<string, Map<string, Map<string, typeof rows>>>();

  for (const row of rows) {
    const form = row.assessmentForm || "Unspecified Assessment Form";
    const stage = row.assessmentStage || "General";
    const section = row.assessmentSection || "General";

    if (!forms.has(form)) {
      forms.set(form, new Map());
    }

    const stageMap = forms.get(form)!;
    if (!stageMap.has(stage)) {
      stageMap.set(stage, new Map());
    }

    const sectionMap = stageMap.get(stage)!;
    if (!sectionMap.has(section)) {
      sectionMap.set(section, []);
    }

    sectionMap.get(section)!.push(row);
  }

  return forms;
}

const AuditResults = ({ data }: AuditResultsProps) => {
  if (!data) return null;

  const traceability = data.traceability || [];
  const traceabilityByForm = buildTraceabilityByForm(traceability);
  const orderedForms = [
    "Web Accessibility Assessment Form - Web Usability",
    "Web Accessibility Assessment Form - Web Presence",
  ];
  const extraForms = Array.from(traceabilityByForm.keys()).filter((form) => !orderedForms.includes(form));
  const formsToRender = [...orderedForms, ...extraForms].filter((form) => traceabilityByForm.has(form));

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Scoreboards */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Web Presence Scoreboard */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-card">
          <h3 className="font-display text-lg font-bold text-card-foreground mb-4">
            Web Presence Scoreboard
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 text-muted-foreground font-medium">Stage</th>
                  <th className="text-right py-2 text-muted-foreground font-medium">Score</th>
                  <th className="text-right py-2 text-muted-foreground font-medium">Remark</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { label: "Stage 1 – Emerging", pct: data.webPresence.stage1, point: data.webPresence.stage1Point },
                  { label: "Stage 2 – Enhanced", pct: data.webPresence.stage2, point: data.webPresence.stage2Point },
                  { label: "Stage 3 – Transactional", pct: data.webPresence.stage3, point: data.webPresence.stage3Point },
                  { label: "Stage 4 – Connected", pct: data.webPresence.stage4, point: data.webPresence.stage4Point },
                ].map((row) => {
                  // derive legend entry from backend if available, else fallback
                  const legend = data.webPresence.legend || {
                    1: { label: 'With Web Presence', color: '#28a745' },
                    2: { label: 'Under Development', color: '#fd7e14' },
                    3: { label: 'Offline/Not Accessible', color: '#f8d7da' },
                    0: { label: 'Without Web Presence', color: '#dc3545' },
                  };

                  const point = typeof row.point === 'number' ? row.point : percentToPointClient(row.pct);
                  const remarkLabel = legend[point]?.label ?? getRemarkLabel(row.pct);
                  const bgColor = legend[point]?.color ?? '';

                  // compute contrasting text color for readability
                  function hexToRgb(hex: string) {
                    const clean = hex.replace('#', '');
                    const bigint = parseInt(clean, 16);
                    return {
                      r: (bigint >> 16) & 255,
                      g: (bigint >> 8) & 255,
                      b: bigint & 255,
                    };
                  }

                  function getContrastText(hex: string) {
                    try {
                      const { r, g, b } = hexToRgb(hex);
                      // relative luminance
                      const [rs, gs, bs] = [r, g, b].map((c) => {
                        const s = c / 255;
                        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
                      });
                      const luminance = 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
                      return luminance > 0.6 ? '#000000' : '#FFFFFF';
                    } catch (e) {
                      return '#000000';
                    }
                  }

                  const textColor = bgColor ? getContrastText(bgColor) : undefined;

                  return (
                    <tr key={row.label} className="border-b border-border/50">
                      <td className="py-2 text-card-foreground">{row.label}</td>
                      <td className="py-2 text-right font-medium text-card-foreground">
                        <span
                          className="font-semibold mr-2 inline-flex items-center justify-center px-2 py-0.5 rounded-md"
                          style={{ backgroundColor: bgColor, color: textColor }}
                        >
                          {point}
                        </span>
                        <span className="text-card-foreground">{row.pct.toFixed(0)}%</span>
                      </td>
                      <td className={`py-2 text-right font-medium`}>
                        <span
                          className="inline-flex items-center justify-center px-2 py-0.5 rounded-md"
                          style={{ backgroundColor: bgColor, color: textColor }}
                        >
                          {remarkLabel}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                <tr className="font-bold">
                  <td className="py-2 text-card-foreground">Total</td>
                  <td className="py-2 text-right text-card-foreground">
                    {(() => {
                      const legend = data.webPresence.legend || {
                        1: { label: 'With Web Presence', color: '#28a745' },
                        2: { label: 'Under Development', color: '#fd7e14' },
                        3: { label: 'Offline/Not Accessible', color: '#f8d7da' },
                        0: { label: 'Without Web Presence', color: '#dc3545' },
                      };
                      const totalPct = data.webPresence.total || 0;
                      const totalPoint = percentToPointClient(totalPct);
                      const bgColor = legend[totalPoint]?.color ?? '';
                      const textColor = bgColor ? (function(hex: string){ try { const c = hex.replace('#',''); const v = parseInt(c,16); const r=(v>>16)&255; const g=(v>>8)&255; const b=v&255; const [rs,gs,bs]=[r,g,b].map(c=>{const s=c/255; return s<=0.03928 ? s/12.92 : Math.pow((s+0.055)/1.055,2.4)}); const luminance=0.2126*rs+0.7152*gs+0.0722*bs; return luminance>0.6 ? '#000000':'#FFFFFF' } catch(e){return '#000000'} })(bgColor) : undefined;
                      return (
                        <>
                          <span className="font-semibold mr-2 inline-flex items-center justify-center px-2 py-0.5 rounded-md" style={{ backgroundColor: bgColor, color: textColor }}>{totalPoint}</span>
                          <span className="text-card-foreground">{totalPct.toFixed(0)}%</span>
                        </>
                      );
                    })()}
                  </td>
                  <td className={`py-2 text-right`}>
                    {(() => {
                      const legend = data.webPresence.legend || {
                        1: { label: 'With Web Presence', color: '#28a745' },
                        2: { label: 'Under Development', color: '#fd7e14' },
                        3: { label: 'Offline/Not Accessible', color: '#f8d7da' },
                        0: { label: 'Without Web Presence', color: '#dc3545' },
                      };
                      const totalPct = data.webPresence.total || 0;
                      const totalPoint = percentToPointClient(totalPct);
                      const bgColor = legend[totalPoint]?.color ?? '';
                      const textColor = bgColor ? (function(hex: string){ try { const c = hex.replace('#',''); const v = parseInt(c,16); const r=(v>>16)&255; const g=(v>>8)&255; const b=v&255; const [rs,gs,bs]=[r,g,b].map(c=>{const s=c/255; return s<=0.03928 ? s/12.92 : Math.pow((s+0.055)/1.055,2.4)}); const luminance=0.2126*rs+0.7152*gs+0.0722*bs; return luminance>0.6 ? '#000000':'#FFFFFF' } catch(e){return '#000000'} })(bgColor) : undefined;
                      return <span style={{ backgroundColor: bgColor, color: textColor }} className="inline-flex items-center justify-center px-2 py-0.5 rounded-md">{legend[totalPoint]?.label ?? getRemarkLabel(totalPct)}</span>;
                    })()}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Web Usability Scoreboard */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-card">
          <h3 className="font-display text-lg font-bold text-card-foreground mb-4">
            Web Usability Scoreboard
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 text-muted-foreground font-medium">Category</th>
                  <th className="text-right py-2 text-muted-foreground font-medium">Score</th>
                  <th className="text-right py-2 text-muted-foreground font-medium">Remark</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { label: "Accessibility", value: data.webUsability.accessibility },
                  { label: "Identity", value: data.webUsability.identity },
                  { label: "Navigation", value: data.webUsability.navigation },
                  { label: "Content", value: data.webUsability.content },
                ].map((row) => (
                  <tr key={row.label} className="border-b border-border/50">
                    <td className="py-2 text-card-foreground">{row.label}</td>
                    <td className="py-2 text-right font-medium text-card-foreground">{row.value.toFixed(0)}%</td>
                    <td className={`py-2 text-right font-medium ${getRemarkClass(row.value)}`}>
                      {getRemarkLabel(row.value)}
                    </td>
                  </tr>
                ))}
                <tr className="font-bold">
                  <td className="py-2 text-card-foreground">Total</td>
                  <td className="py-2 text-right text-card-foreground">{data.webUsability.total.toFixed(0)}%</td>
                  <td className={`py-2 text-right ${getRemarkClass(data.webUsability.total)}`}>
                    {getRemarkLabel(data.webUsability.total)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Transparency Panel */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-card">
        <h3 className="font-display text-lg font-bold text-card-foreground mb-4">
          Assessment Forms
        </h3>

        {data.methodology ? (
          <div className="grid gap-3 md:grid-cols-4 mb-5">
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">Mapped Guidelines</p>
              <p className="text-lg font-semibold text-card-foreground">{data.methodology.mappedGuidelines}</p>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">Evaluated Guidelines</p>
              <p className="text-lg font-semibold text-card-foreground">{data.methodology.evaluatedGuidelines}</p>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">Coverage</p>
              <p className="text-lg font-semibold text-card-foreground">{data.methodology.coveragePercent}%</p>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">Pages Crawled</p>
              <p className="text-lg font-semibold text-card-foreground">{data.methodology.pagesCrawled}</p>
            </div>
          </div>
        ) : null}

        {traceability.length > 0 ? (
          <div className="space-y-6">
            {formsToRender.map((formName) => {
              const stages = traceabilityByForm.get(formName);
              if (!stages) return null;

              return (
                <div key={formName} className="space-y-3">
                  <h4 className="font-semibold text-card-foreground">{formName}</h4>
                  {Array.from(stages.entries()).map(([stageName, sections]) => (
                    <div key={`${formName}-${stageName}`} className="space-y-3">
                      <div className="bg-muted/60 px-3 py-2 text-sm font-semibold text-card-foreground rounded-md">
                        {stageName}
                      </div>
                      {Array.from(sections.entries()).map(([sectionName, rows]) => (
                        <div key={`${formName}-${stageName}-${sectionName}`} className="rounded-lg border border-border overflow-hidden">
                          <div className="bg-muted/40 px-3 py-2 text-sm font-semibold text-card-foreground">
                            {sectionName}
                          </div>
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b border-border bg-muted/20">
                                  <th className="text-left py-2 px-3 text-muted-foreground font-medium w-12">No.</th>
                                  <th className="text-left py-2 px-3 text-muted-foreground font-medium">Assessment Item</th>
                                  <th className="text-center py-2 px-3 text-muted-foreground font-medium w-20">Yes/No</th>
                                  <th className="text-left py-2 px-3 text-muted-foreground font-medium">Remarks</th>
                                </tr>
                              </thead>
                              <tbody>
                                {rows.map((row) => (
                                  <tr key={`${formName}-${stageName}-${sectionName}-${row.key}`} className="border-b border-border/50 align-top">
                                    <td className="py-2 px-3 text-card-foreground">{row.rowNo}</td>
                                    <td className="py-2 px-3 text-card-foreground">{row.guideline}</td>
                                    <td className="py-2 px-3 text-center">
                                      <Badge variant="outline" className={`text-xs ${getStatusColor(row.status)}`}>
                                        {statusToYesNo(row.status)}
                                      </Badge>
                                    </td>
                                    <td className="py-2 px-3 text-muted-foreground text-xs">{row.evidence}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No traceability rows were generated.</p>
        )}
      </div>
    </motion.div>
  );
};

export default AuditResults;
