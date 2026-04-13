import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface CheckItem {
  key: string;
  status: 'Pass' | 'Fail' | 'N/A' | 'NotTested';
}

interface AuditData {
  auditUrl: string;
  createdAt: string;
  // Flat structure (new backend format)
  checks?: CheckItem[];
  pageAudits?: Array<{ url: string }>;
  crawlSummary?: { pagesCrawled?: number };
  // Legacy nested structure (kept for backward compatibility)
  auditResults?: { checks?: CheckItem[] };
  // Metadata
  pst?: { found: boolean };
  transparencySeal?: { found: boolean };
  performance?: { loadTimeMs: number; pagesCrawled?: number };
  crawledPages?: Array<{ url: string }>;
  masthead?: { aboutUs?: boolean; contactUs?: boolean };
  citizensCharter?: { found?: boolean };
}

interface ComplianceData {
  webPresence?: {
    stage1: number;
    stage2: number;
    stage3: number;
    stage4: number;
  };
  webUsability?: {
    accessibility: number;
    identity: number;
    navigation: number;
    content: number;
  };
}

interface UIReportData {
  webPresence?: {
    stage1: number;
    stage2: number;
    stage3: number;
    stage4: number;
  };
  webUsability?: {
    accessibility: number;
    identity: number;
    navigation: number;
    content: number;
  };
  methodology?: { pagesCrawled: number };
}

interface AuditSummaryReportProps {
  audit: AuditData;
  compliance?: ComplianceData;
  uiReport?: UIReportData;
  onDownloadExcel?: () => void;
  onDownloadPdf?: () => void;
}

export function AuditSummaryReport({ 
  audit, 
  compliance,
  uiReport,
  onDownloadExcel,
  onDownloadPdf 
}: AuditSummaryReportProps) {
  // Backend now returns flat structure: checks at top level, not nested under auditResults
  const checks = audit.checks ?? audit.auditResults?.checks ?? [];
  const hasPass = (...keys: string[]) =>
    checks.some((c) => keys.includes(c.key) && c.status === 'Pass');

  const safePct = (value: number) =>
    Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;

  // Fallback computation when `compliance` is missing (common after DB cleanup)
  const stage1Fallback = (() => {
    const signals = [
      audit.pst?.found === true,
      audit.transparencySeal?.found === true,
      audit.masthead?.aboutUs === true,
      audit.masthead?.contactUs === true,
    ];
    const passed = signals.filter(Boolean).length;
    return safePct(Math.round((passed / signals.length) * 100));
  })();

  const stage2Fallback = (() => {
    const stage2Keys = [
      ['a11y.image_alt', 'accessibility.image_alt', 'accessibility.alt_text', 'image-alt'],
      ['a11y.color_contrast', 'accessibility.color_contrast', 'color-contrast'],
      ['a11y.form_labels', 'accessibility.form_labels', 'label'],
      ['performance.avg_load_time'],
      ['content.headings_descriptive', 'content.headings'],
      ['nav.has_breadcrumbs', 'navigation.breadcrumbs'],
      ['errors.custom_404', 'error.custom_404'],
    ];
    const passed = stage2Keys.filter((keyGroup) => hasPass(...keyGroup)).length;
    return safePct(Math.round((passed / stage2Keys.length) * 100));
  })();

  // Calculate Web Presence scores (use uiReport > compliance > fallbacks)
  const stage1 = safePct(uiReport?.webPresence?.stage1 ?? compliance?.webPresence?.stage1 ?? stage1Fallback);
  const stage2 = safePct(uiReport?.webPresence?.stage2 ?? compliance?.webPresence?.stage2 ?? stage2Fallback);
  const stage3 = safePct(uiReport?.webPresence?.stage3 ?? compliance?.webPresence?.stage3 ?? 0);
  const stage4 = safePct(uiReport?.webPresence?.stage4 ?? compliance?.webPresence?.stage4 ?? 0);
  const presenceAverage = safePct((stage1 + stage2 + stage3 + stage4) / 4);

  // Calculate Web Usability scores (use backend if present; else fall back)
  const usabilityA11yFallback = (() => {
    const groups = [
      ['a11y.image_alt', 'accessibility.image_alt', 'accessibility.alt_text', 'image-alt'],
      ['a11y.color_contrast', 'accessibility.color_contrast', 'color-contrast'],
      ['a11y.form_labels', 'accessibility.form_labels', 'label'],
      ['a11y.descriptive_links', 'accessibility.descriptive_links'],
    ];
    const passed = groups.filter((g) => hasPass(...g)).length;
    return safePct(Math.round((passed / groups.length) * 100));
  })();

  const usabilityIdentityFallback = (() => {
    const signals = [
      audit.masthead?.aboutUs === true,
      audit.masthead?.contactUs === true,
      audit.transparencySeal?.found === true,
    ];
    const passed = signals.filter(Boolean).length;
    return safePct(Math.round((passed / signals.length) * 100));
  })();

  const usabilityNavFallback = (() => {
    const groups = [
      ['nav.home_link', 'navigation.home_link'],
      ['nav.logo_links_home', 'navigation.logo_links_home'],
      ['nav.has_breadcrumbs', 'navigation.breadcrumbs'],
      ['nav.top_navigation', 'navigation.top_navigation'],
    ];
    const passed = groups.filter((g) => hasPass(...g)).length;
    return safePct(Math.round((passed / groups.length) * 100));
  })();

  const usabilityContentFallback = (() => {
    const groups = [
      ['content.readability', 'content.readable_text'],
      ['content.headings_descriptive', 'content.headings'],
      ['content.has_search', 'content.search'],
      ['content.updated_recently', 'content.freshness'],
    ];
    const passed = groups.filter((g) => hasPass(...g)).length;
    return safePct(Math.round((passed / groups.length) * 100));
  })();

  // These are the actual category scores (use uiReport > compliance > fallbacks)
  const accessibilityScore = safePct(uiReport?.webUsability?.accessibility ?? compliance?.webUsability?.accessibility ?? usabilityA11yFallback);
  const identityScore = safePct(uiReport?.webUsability?.identity ?? compliance?.webUsability?.identity ?? usabilityIdentityFallback);
  const navigationScore = safePct(uiReport?.webUsability?.navigation ?? compliance?.webUsability?.navigation ?? usabilityNavFallback);
  const contentScore = safePct(uiReport?.webUsability?.content ?? compliance?.webUsability?.content ?? usabilityContentFallback);

  const usabilityAverage = safePct(
    (accessibilityScore + identityScore + navigationScore + contentScore) / 4
  );

  // Calculate overall score as average of two dimensions
  const overallScore = safePct((presenceAverage + usabilityAverage) / 2);
  const isCompliant = overallScore >= 70;

  // Better “pages analyzed” display (avoid hardcoded 1)
  const pagesAnalyzed =    uiReport?.methodology?.pagesCrawled ??    audit.crawledPages?.length ??
    audit.performance?.pagesCrawled ??
    0;

  return (
    <Card className="border-blue-200 bg-gradient-to-r from-blue-50 to-cyan-50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl">Web Audit Summary Report</CardTitle>
            <CardDescription>Government Website Compliance Evaluation</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="secondary" 
              size="sm"
              onClick={onDownloadExcel}
            >
              📊 Download Excel
            </Button>
            <Button 
              variant="secondary" 
              size="sm"
              onClick={onDownloadPdf}
            >
              📄 Download PDF
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4 mb-6">
          {/* Web Presence Summary */}
          <div className="p-4 bg-white rounded-lg border border-blue-100">
            <p className="text-xs font-bold text-slate-600 mb-2 uppercase">Web Presence Evaluation</p>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs">Emerging (Stage 1)</span>
                <span className="text-sm font-bold text-blue-600">{stage1.toFixed(0)}%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs">Enhanced (Stage 2)</span>
                <span className="text-sm font-bold text-blue-600">{stage2.toFixed(0)}%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs">Transactional (Stage 3)</span>
                <span className="text-sm font-bold text-blue-600">{stage3.toFixed(0)}%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs">Connected (Stage 4)</span>
                <span className="text-sm font-bold text-blue-600">{stage4.toFixed(0)}%</span>
              </div>
              <div className="border-t pt-2 mt-2">
                <div className="flex justify-between items-center font-bold">
                  <span className="text-xs">Average</span>
                  <span className="text-sm text-blue-600">{presenceAverage.toFixed(0)}%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Web Usability Summary: keep JSX as-is, it now has the variables */}
          <div className="p-4 bg-white rounded-lg border border-green-100">
            <p className="text-xs font-bold text-slate-600 mb-2 uppercase">Web Usability Evaluation</p>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs">Accessibility</span>
                <span className="text-sm font-bold text-green-600">{accessibilityScore.toFixed(0)}%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs">Identity</span>
                <span className="text-sm font-bold text-green-600">{identityScore.toFixed(0)}%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs">Navigation</span>
                <span className="text-sm font-bold text-green-600">{navigationScore.toFixed(0)}%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs">Content</span>
                <span className="text-sm font-bold text-green-600">{contentScore.toFixed(0)}%</span>
              </div>
              <div className="border-t pt-2 mt-2">
                <div className="flex justify-between items-center font-bold">
                  <span className="text-xs">Average</span>
                  <span className="text-sm text-green-600">{usabilityAverage.toFixed(0)}%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Overall Assessment */}
          <div className="p-4 bg-white rounded-lg border border-purple-100">
            <p className="text-xs font-bold text-slate-600 mb-2 uppercase">Overall Assessment</p>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-slate-600 mb-1">Overall Score</p>
                <p className="text-2xl font-bold text-purple-600">
                  {overallScore.toFixed(0)}%
                </p>
              </div>
              <div className="text-xs text-slate-600 space-y-1">
                <div className="flex justify-between">
                  <span>Web Presence</span>
                  <span className="font-bold">{presenceAverage.toFixed(0)}%</span>
                </div>
                <div className="flex justify-between">
                  <span>Web Usability</span>
                  <span className="font-bold">{usabilityAverage.toFixed(0)}%</span>
                </div>
                <div className="border-t pt-2 flex justify-between">
                  <span className="font-semibold">Overall Score</span>
                  <span className="font-bold text-lg">{overallScore.toFixed(0)}%</span>
                </div>
              </div>
              <Badge className={`w-full text-center py-2 justify-center ${isCompliant ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'}`}>
                {isCompliant ? 'COMPLIANT' : 'NEEDS IMPROVEMENT'}
              </Badge>
            </div>
          </div>
        </div>

        {/* Key Findings */}
        <div className="bg-white p-4 rounded border border-slate-200">
          <h4 className="font-bold text-slate-800 mb-3">Key Findings</h4>
          <ul className="space-y-2 text-sm">
            <li className="flex gap-2 items-start">
              <span className={`mt-0.5 ${audit.pst?.found ? 'text-green-600' : 'text-red-600'}`}>●</span>
              <span>Philippine Standard Time (PST): <strong>{audit.pst?.found ? 'FOUND' : 'MISSING'}</strong></span>
            </li>
            <li className="flex gap-2 items-start">
              <span className={`mt-0.5 ${audit.transparencySeal?.found ? 'text-green-600' : 'text-red-600'}`}>●</span>
              <span>Transparency Seal: <strong>{audit.transparencySeal?.found ? 'FOUND' : 'MISSING'}</strong></span>
            </li>
            <li className="flex gap-2 items-start">
              <span className={`mt-0.5 ${(audit.performance?.loadTimeMs || 0) <= 10000 ? 'text-green-600' : 'text-red-600'}`}>●</span>
              <span>Page Load Time: <strong>{((audit.performance?.loadTimeMs || 0) / 1000).toFixed(2)}s</strong> {(audit.performance?.loadTimeMs || 0) <= 10000 ? '(PASS)' : '(SLOW)'}</span>
            </li>
            <li className="flex gap-2 items-start">

              <span className="text-blue-600 mt-0.5">●</span>
              <span>Pages Analyzed: <strong>{pagesAnalyzed} pages</strong></span>
            </li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
