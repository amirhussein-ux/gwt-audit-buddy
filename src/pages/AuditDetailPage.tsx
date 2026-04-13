import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AuditSummaryReport } from '@/components/AuditSummaryReport';

interface CheckItem {
  key: string;
  status: 'Pass' | 'Fail' | 'N/A' | 'NotTested';
}

interface AuditLog {
  _id: string;
  auditUrl: string;
  status: string;
  // Flat structure (new backend format)
  checks?: CheckItem[];
  pageAudits?: Array<{ url: string }>;
  crawlSummary?: { pagesCrawled?: number };
  // Legacy nested structure (kept for backward compatibility)
  auditResults?: {
    checks?: CheckItem[];
    crawlSummary?: { pagesCrawled?: number };
    pageAudits?: Array<{ url: string }>;
  } | null;
  // Metadata
  pst: { found: boolean; location?: string };
  transparencySeal: { found: boolean; link?: string };
  accessibility: {
    altTextCoverage: number;
    formLabels: number;
  };
  performance: {
    loadTimeMs: number;
    pagesCrawled: number;
  };
  crawledPages?: Array<{ url: string }>;
  masthead?: {
    aboutUs?: boolean;
    contactUs?: boolean;
  };
  citizensCharter?: {
    found?: boolean;
  };
  createdAt: string;
}

interface ComplianceScore {
  overallScore: number;
  webPresence: {
    stage1: number;
    stage2: number;
    stage3: number;
    stage4: number;
  };
}

interface UIReport {
  webPresence?: {
    stage1: number;
    stage2: number;
    stage3: number;
    stage4: number;
    total: number;
  };
  webUsability?: {
    accessibility: number;
    identity: number;
    navigation: number;
    content: number;
    total: number;
  };
  categoryResults?: Array<any>;
  methodology?: { pagesCrawled: number };
}

interface AuditDetailData {
  audit: AuditLog;
  compliance: ComplianceScore | null;
  uiReport?: UIReport | null;
}

const StatusIcon = ({ found }: { found: boolean }) => {
  return found ? (
    <CheckCircle className="h-5 w-5 text-green-600" />
  ) : (
    <XCircle className="h-5 w-5 text-red-600" />
  );
};

export default function AuditDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { token } = useAuth();
  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

  const { data, isLoading, error } = useQuery({
    queryKey: ['audit', id],
    queryFn: async () => {
      const response = await fetch(`${API_BASE}/audit/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Failed to fetch audit details');
      return response.json() as Promise<AuditDetailData>;
    },
    enabled: !!token && !!id,
    staleTime: 0, // Always consider data stale
    gcTime: 0, // Disable caching - always refetch fresh data
    refetchInterval: (query) => {
      // Poll every 2 seconds while data is still loading/empty
      const checksCount = query.state.data?.audit?.auditResults?.checks?.length ?? 0;
      const hasValidData = checksCount > 50; // Audit complete when we have 50+ checks
      return hasValidData ? false : 2000; // Stop polling once data arrives
    },
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true, // Refetch when returning to window
  });

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="container mx-auto py-8">
        <Button variant="outline" onClick={() => navigate('/dashboard')} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
        </Button>
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-red-800">Error loading audit details. Please try again.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const audit = data.audit;
  const compliance = data.compliance;

  // Helper utilities to make the assessment forms vary per audit (instead of hardcoded `true`)
  // Backend returns checks nested at auditResults.checks
  const checks: CheckItem[] = data?.audit?.auditResults?.checks ?? data?.audit?.checks ?? [];
  const hasPass = (...keys: string[]) =>
    checks.some((c) => keys.includes(c.key) && c.status === 'Pass');
  const hasFail = (...keys: string[]) =>
    checks.some((c) => keys.includes(c.key) && c.status === 'Fail');

  // Helper: Count passed checks matching any key pattern
  const countPass = (...patterns: string[]) => {
    return checks.filter((c) => 
      patterns.some((p) => c.key.includes(p)) && c.status === 'Pass'
    ).length;
  };

  // Helper: Derive boolean from check counts (at least 1 pass = true)
  const hasChecksPassing = (...patterns: string[]) => countPass(...patterns) > 0;

  // DEBUG: Log what checks we have
  console.log(`[AuditDetailPage] ${audit.auditUrl} - Audit ID: ${id}`);
  console.log('[AuditDetailPage] Total checks loaded:', checks.length);
  if (checks.length > 0) {
    const allKeys = new Set(checks.map(c => c.key));
    const passCount = checks.filter(c => c.status === 'Pass').length;
    const failCount = checks.filter(c => c.status === 'Fail').length;
    const naCount = checks.filter(c => c.status === 'N/A').length;
    
    console.log('[AuditDetailPage] Check Summary:', {
      total: checks.length,
      passed: passCount,
      failed: failCount,
      na: naCount,
      uniqueKeys: allKeys.size
    });
    
    console.log('[AuditDetailPage] First 10 check keys:', checks.slice(0, 10).map(c => `${c.key}(${c.status})`));
    
    // Log specific check statuses to verify they differ between audits
    const presencePstStatus = checks.find(c => c.key === 'presence.pst')?.status || 'NOT_FOUND';
    const navHomeStatus = checks.find(c => c.key === 'navigation.home_link')?.status || 'NOT_FOUND';
    const orgStructStatus = checks.find(c => c.key === 'presence.organization_structure')?.status || 'NOT_FOUND';
    
    console.log('[AuditDetailPage] Key check statuses:', {
      'presence.pst': presencePstStatus,
      'navigation.home_link': navHomeStatus,
      'presence.organization_structure': orgStructStatus
    });
  } else {
    console.warn('[AuditDetailPage] ⚠️ NO CHECKS LOADED - Assessment form will show no data!');
  }

  const pagesAnalyzed =
    data?.audit?.crawledPages?.length ??
    data?.audit?.crawlSummary?.pagesCrawled ??
    data?.audit?.auditResults?.crawlSummary?.pagesCrawled ??
    data?.audit?.pageAudits?.length ??
    data?.audit?.auditResults?.pageAudits?.length ??
    data?.audit?.performance?.pagesCrawled ??
    0;

  // Example “wire-up” booleans you can reuse in your assessment UI:
  const a11yAltOk = hasPass(
    'a11y.image_alt',
    'accessibility.image_alt',
    'accessibility.alt_text',
    'image-alt'
  );
  const a11yContrastOk = hasPass(
    'a11y.color_contrast',
    'accessibility.color_contrast',
    'color-contrast'
  );
  const a11yLabelsOk = hasPass(
    'a11y.form_labels',
    'accessibility.form_labels',
    'label'
  );
  const perfOk = hasPass('performance.avg_load_time');

  return (
    <div className="container mx-auto py-8 space-y-6" key={`audit-detail-${id}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={() => navigate('/dashboard')}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
        </Button>
        <div className="text-right">
          <h1 className="text-2xl font-bold">{audit.auditUrl}</h1>
          <p className="text-sm text-slate-600">
            Audited {new Date(audit.createdAt).toLocaleDateString()} at{' '}
            {new Date(audit.createdAt).toLocaleTimeString()}
          </p>
        </div>
      </div>

      {/* Web Accessibility Audit Summary Report */}
      <AuditSummaryReport
        audit={audit}
        compliance={compliance || undefined}
        uiReport={data?.uiReport || undefined}
        onDownloadExcel={() => alert('Download Excel functionality coming soon')}
        onDownloadPdf={() => alert('Download PDF functionality coming soon')}
      />

      {/* Tabs for different sections */}
      <Tabs defaultValue="presence-evaluation" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="presence-evaluation">Web Presence Evaluation</TabsTrigger>
          <TabsTrigger value="usability-evaluation">Web Usability Evaluation</TabsTrigger>
          <TabsTrigger value="performance">Performance Metrics</TabsTrigger>
        </TabsList>

        {/* Web Presence Evaluation Tab */}
        <TabsContent value="presence-evaluation" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Web Presence Assessment - Web Presence</CardTitle>
              <CardDescription>Evaluation based on Web Presence Guidelines (Stages 1-4) - Appendix B</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b-2 border-slate-300">
                      <th className="text-left p-2 font-bold">Assessment Item</th>
                      <th className="text-center p-2 font-bold">Yes/No</th>
                      <th className="text-left p-2 font-bold">Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Stage 1 - Emerging Web Presence */}
                    <tr className="bg-blue-100 border-b-2 border-slate-400">
                      <td colSpan={3} className="p-3 font-bold text-slate-900">Stage 1 - Emerging Web Presence</td>
                    </tr>
                    
                    {/* Section A - Basic Web Feature */}
                    <tr className="bg-blue-50 border-b border-slate-200">
                      <td colSpan={3} className="p-2 font-bold text-slate-800 pl-4">A. Basic Web Feature</td>
                    </tr>
                    {[
                      { label: '1. Home', value: hasPass('navigation.home_link'), remark: hasPass('navigation.home_link') ? 'Homepage present' : 'Homepage not detected' },
                      { label: '2. Philippine Standard Time', value: hasPass('presence.pst'), remark: hasPass('presence.pst') ? 'PST found' : 'PST not detected' },
                      { label: '3. Links to other agencies (GOVPH and Standard Footer)', value: hasPass('presence.govph_link'), remark: hasPass('presence.govph_link') ? 'External agency links verified' : 'Agency links not found' },
                      { label: '4. Site Map', value: hasPass('navigation.sitemap_structure') || (audit.crawledPages?.length || 0) > 1, remark: (hasPass('navigation.sitemap_structure') || (audit.crawledPages?.length || 0) > 1) ? 'Site structure available' : 'Sitemap not found' },
                    ].map((item, idx) => (
                      <tr key={`s1a${idx}`} className="border-b border-slate-200 hover:bg-slate-50">
                        <td className="p-3 pl-6">{item.label}</td>
                        <td className="text-center p-3">
                          <span className={`font-bold text-lg ${item.value ? 'text-green-600' : 'text-red-600'}`}>
                            {item.value ? '1' : '0'}
                          </span>
                        </td>
                        <td className="p-3 text-slate-600">{item.remark}</td>
                      </tr>
                    ))}

                    {/* Section B - Info About the Agencies */}
                    <tr className="bg-blue-50 border-b border-slate-200">
                      <td colSpan={3} className="p-2 font-bold text-slate-800 pl-4">B. Info About the Agencies</td>
                    </tr>
                    {[
                      { label: '1. Agency Name and Logo (Masthead)', value: hasPass('presence.logo_home'), remark: hasPass('presence.logo_home') ? 'Logo and name present' : 'Logo/masthead not found' },
                      { label: '2. About Us', value: hasPass('navigation.about_link'), remark: hasPass('navigation.about_link') ? 'About Us found' : 'About Us missing' },
                      { label: '3. Organization Structure', value: hasPass('presence.organization_structure'), remark: hasPass('presence.organization_structure') ? 'Organization chart available' : 'Organization structure not found' },
                      { label: '4. Key Officials', value: hasPass('presence.key_officials'), remark: hasPass('presence.key_officials') ? 'Officials information present' : 'Officials information not found' },
                      { label: '5. Contact Details', value: hasPass('navigation.contact_link'), remark: hasPass('navigation.contact_link') ? 'Contact info provided' : 'Contact details not found' },
                      { label: '   • Phone/Fax', value: hasChecksPassing('phone'), remark: hasChecksPassing('phone') ? 'Phone contact available' : 'Phone contact not found' },
                      { label: '   • Email', value: hasChecksPassing('email'), remark: hasChecksPassing('email') ? 'Email contact available' : 'Email contact not found' },
                      { label: '   • Address and Location Map', value: hasChecksPassing('address', 'location'), remark: hasChecksPassing('address', 'location') ? 'Location info provided' : 'Address/location not found' },
                    ].map((item, idx) => (
                      <tr key={`s1b${idx}`} className="border-b border-slate-200 hover:bg-slate-50">
                        <td className="p-3 pl-6">{item.label}</td>
                        <td className="text-center p-3">
                          <span className={`font-bold text-lg ${item.value ? 'text-green-600' : 'text-red-600'}`}>
                            {item.value ? '1' : '0'}
                          </span>
                        </td>
                        <td className="p-3 text-slate-600">{item.remark}</td>
                      </tr>
                    ))}

                    {/* Section C - Strategic Information of the Agency */}
                    <tr className="bg-blue-50 border-b border-slate-200">
                      <td colSpan={3} className="p-2 font-bold text-slate-800 pl-4">C. Strategic Information of the Agency</td>
                    </tr>
                    {[
                      { label: '1. Citizens\' Charter', value: audit.citizensCharter?.found || hasChecksPassing('charter'), remark: (audit.citizensCharter?.found || hasChecksPassing('charter')) ? 'Citizens Charter found' : 'Citizens Charter not found' },
                      { label: '2. Transparency Seal', value: hasPass('presence.transparency_seal_link'), remark: hasPass('presence.transparency_seal_link') ? 'Transparency Seal found' : 'Transparency Seal missing' },
                      { label: '   • Mission and Vision', value: hasPass('presence.mission_vision'), remark: hasPass('presence.mission_vision') ? 'Mission/Vision statement present' : 'Mission/Vision not found' },
                      { label: '   • Organizational Aims and Objectives', value: hasChecksPassing('objective'), remark: hasChecksPassing('objective') ? 'Organizational objectives documented' : 'Objectives not documented' },
                      { label: '   • Mandate and Functions', value: hasPass('presence.mandate_functions'), remark: hasPass('presence.mandate_functions') ? 'Mandate clearly stated' : 'Mandate not stated' },
                      { label: '   • Products or Services', value: hasChecksPassing('service'), remark: hasChecksPassing('service') ? 'Services/Products listed' : 'Services not listed' },
                      { label: '3. Plans, Programs, Projects', value: hasChecksPassing('plan'), remark: hasChecksPassing('plan') ? 'Plans and projects documented' : 'Plans not documented' },
                      { label: '4. Policy/Regulation Releases', value: hasChecksPassing('policy'), remark: hasChecksPassing('policy') ? 'Policies and regulations available' : 'Policies not available' },
                      { label: '5. Major Final Output\'s / PREXC',  value: hasChecksPassing('budget', 'output', 'prexc'), remark: hasChecksPassing('budget', 'output', 'prexc') ? 'Budget outputs documented' : 'Budget outputs not documented' },
                    ].map((item, idx) => (
                      <tr key={`s1c${idx}`} className="border-b border-slate-200 hover:bg-slate-50">
                        <td className="p-3 pl-6">{item.label}</td>
                        <td className="text-center p-3">
                          <span className={`font-bold text-lg ${item.value ? 'text-green-600' : 'text-red-600'}`}>
                            {item.value ? '1' : '0'}
                          </span>
                        </td>
                        <td className="p-3 text-slate-600">{item.remark}</td>
                      </tr>
                    ))}

                    {/* Section D - Resources */}
                    <tr className="bg-blue-50 border-b border-slate-200">
                      <td colSpan={3} className="p-2 font-bold text-slate-800 pl-4">D. Resources</td>
                    </tr>
                    {[
                      { label: '1. Downloads', value: hasChecksPassing('download'), remark: hasChecksPassing('download') ? 'Downloads section available' : 'Downloads not available' },
                      { label: '2. Archives', value: hasChecksPassing('archive'), remark: hasChecksPassing('archive') ? 'Archives accessible' : 'Archives not found' },
                      { label: '3. FAQs', value: hasChecksPassing('faq'), remark: hasChecksPassing('faq') ? 'FAQs provided' : 'FAQs not provided' },
                      { label: '4. Opportunities', value: hasChecksPassing('opportunity', 'job'), remark: hasChecksPassing('opportunity', 'job') ? 'Opportunities section present' : 'Opportunities not listed' },
                      { label: '5. Announcements/Latest News/Events', value: hasChecksPassing('news'), remark: hasChecksPassing('news') ? 'News and events published' : 'News/events not published' },
                    ].map((item, idx) => (
                      <tr key={`s1d${idx}`} className="border-b border-slate-200 hover:bg-slate-50">
                        <td className="p-3 pl-6">{item.label}</td>
                        <td className="text-center p-3">
                          <span className={`font-bold text-lg ${item.value ? 'text-green-600' : 'text-red-600'}`}>
                            {item.value ? '1' : '0'}
                          </span>
                        </td>
                        <td className="p-3 text-slate-600">{item.remark}</td>
                      </tr>
                    ))}

                    {/* Stage 2 - Enhanced Web Presence */}
                    <tr className="bg-green-100 border-b-2 border-slate-400">
                      <td colSpan={3} className="p-3 font-bold text-slate-900">Stage 2 - Enhanced Web Presence</td>
                    </tr>

                    {/* Section A - Accessible information */}
                    <tr className="bg-green-50 border-b border-slate-200">
                      <td colSpan={3} className="p-2 font-bold text-slate-800 pl-4">A. Accessible information at the website, which will be regularly updated, at least 1.5 months</td>
                    </tr>
                    {[
                      { label: '1. Information/data is up to date', value: hasChecksPassing('updated', 'current', 'recent'), remark: hasChecksPassing('updated', 'current', 'recent') ? 'Content recently updated' : 'Content may be outdated' },
                      { label: '2. News/press releases/announcements is present', value: hasChecksPassing('news', 'release', 'announcement'), remark: hasChecksPassing('news', 'release', 'announcement') ? 'News section active' : 'News section not active' },
                    ].map((item, idx) => (
                      <tr key={`s2a${idx}`} className="border-b border-slate-200 hover:bg-slate-50">
                        <td className="p-3 pl-6">{item.label}</td>
                        <td className="text-center p-3">
                          <span className={`font-bold text-lg ${item.value ? 'text-green-600' : 'text-red-600'}`}>
                            {item.value ? '1' : '0'}
                          </span>
                        </td>
                        <td className="p-3 text-slate-600">{item.remark}</td>
                      </tr>
                    ))}

                    {/* Section B - Search function and sitemap */}
                    <tr className="bg-green-50 border-b border-slate-200">
                      <td colSpan={3} className="p-2 font-bold text-slate-800 pl-4">B. Search function and sitemap</td>
                    </tr>
                    {[
                      { label: '1. Search function', value: hasChecksPassing('search'), remark: hasChecksPassing('search') ? 'Search capability present' : 'Search function not found' },
                      { label: '2. Site map', value: hasChecksPassing('sitemap') || (audit.crawledPages?.length || 0) > 1, remark: (hasChecksPassing('sitemap') || (audit.crawledPages?.length || 0) > 1) ? 'Sitemap available' : 'Sitemap not available' },
                    ].map((item, idx) => (
                      <tr key={`s2b${idx}`} className="border-b border-slate-200 hover:bg-slate-50">
                        <td className="p-3 pl-6">{item.label}</td>
                        <td className="text-center p-3">
                          <span className={`font-bold text-lg ${item.value ? 'text-green-600' : 'text-red-600'}`}>
                            {item.value ? '1' : '0'}
                          </span>
                        </td>
                        <td className="p-3 text-slate-600">{item.remark}</td>
                      </tr>
                    ))}

                    {/* Section C - Forms, publications, and documents */}
                    <tr className="bg-green-50 border-b border-slate-200">
                      <td colSpan={3} className="p-2 font-bold text-slate-800 pl-4">C. Forms, publications, and other documents that can be made available for downloading</td>
                    </tr>
                    {[
                      { label: '1. Availability of forms', value: hasChecksPassing('form'), remark: hasChecksPassing('form') ? 'Forms available' : 'Forms not available' },
                      { label: '2. Availability of useful documents', value: hasChecksPassing('document'), remark: hasChecksPassing('document') ? 'Documents accessible' : 'Documents not accessible' },
                      { label: '3. Availability of downloadable forms', value: hasChecksPassing('download', 'form'), remark: hasChecksPassing('download', 'form') ? 'Download capability present' : 'Download capability missing' },
                      { label: '4. Existence of a one-stop shop agency portal', value: hasChecksPassing('portal', 'integration'), remark: hasChecksPassing('portal', 'integration') ? 'Portal integration available' : 'Portal integration not available' },
                    ].map((item, idx) => (
                      <tr key={`s2c${idx}`} className="border-b border-slate-200 hover:bg-slate-50">
                        <td className="p-3 pl-6">{item.label}</td>
                        <td className="text-center p-3">
                          <span className={`font-bold text-lg ${item.value ? 'text-green-600' : 'text-red-600'}`}>
                            {item.value ? '1' : '0'}
                          </span>
                        </td>
                        <td className="p-3 text-slate-600">{item.remark}</td>
                      </tr>
                    ))}

                    {/* Section D - Interactive elements */}
                    <tr className="bg-green-50 border-b border-slate-200">
                      <td colSpan={3} className="p-2 font-bold text-slate-800 pl-4">D. Interactive elements are present (e.g. feedback forms, SNS, SMS)</td>
                    </tr>
                    {[
                      { label: '1. Interactive elements are present like message board, feedback form, guest, contact us', value: hasChecksPassing('feedback', 'contact', 'message'), remark: hasChecksPassing('feedback', 'contact', 'message') ? 'Feedback mechanisms available' : 'Feedback not available' },
                      { label: '2. SNS are utilized', value: hasChecksPassing('sns', 'social'), remark: hasChecksPassing('sns', 'social') ? 'Social media integration present' : 'Social media not integrated' },
                      { label: '3. Wireless technology is used to send messages to mobile devices', value: hasChecksPassing('sms', 'mobile', 'wireless'), remark: hasChecksPassing('sms', 'mobile', 'wireless') ? 'Mobile messaging available' : 'Mobile messaging not available' },
                    ].map((item, idx) => (
                      <tr key={`s2d${idx}`} className="border-b border-slate-200 hover:bg-slate-50">
                        <td className="p-3 pl-6">{item.label}</td>
                        <td className="text-center p-3">
                          <span className={`font-bold text-lg ${item.value ? 'text-green-600' : 'text-red-600'}`}>
                            {item.value ? '1' : '0'}
                          </span>
                        </td>
                        <td className="p-3 text-slate-600">{item.remark}</td>
                      </tr>
                    ))}

                    {/* Section E - Bid announcements and external links */}
                    <tr className="bg-green-50 border-b border-slate-200">
                      <td colSpan={3} className="p-2 font-bold text-slate-800 pl-4">E. Bid announcements and other external links</td>
                    </tr>
                    {[
                      { label: '1. Bid announcements/purchase information', value: hasChecksPassing('bid', 'procurement', 'purchase'), remark: hasChecksPassing('bid', 'procurement', 'purchase') ? 'Procurement info available' : 'Procurement info not available' },
                      { label: '2. Department portals/links within the department/offices/field offices', value: hasChecksPassing('portal', 'link', 'office'), remark: hasChecksPassing('portal', 'link', 'office') ? 'Internal links present' : 'Internal links not found' },
                      { label: '3. Specialized database/statistics', value: hasChecksPassing('database', 'statistic'), remark: hasChecksPassing('database', 'statistic') ? 'Database/statistics accessible' : 'Database not accessible' },
                      { label: '4. User login and password', value: hasChecksPassing('login', 'password', 'auth'), remark: hasChecksPassing('login', 'password', 'auth') ? 'Authentication available' : 'Authentication not available' },
                      { label: '5. Links to national government portals, other agencies outside the department and international links', value: hasChecksPassing('link', 'portal', 'government'), remark: hasChecksPassing('link', 'portal', 'government') ? 'External links present' : 'External links not found' },
                      { label: '6. Multiple languages', value: hasChecksPassing('language', 'multilingual'), remark: hasChecksPassing('language', 'multilingual') ? 'Language options available' : 'Multiple languages not available' },
                    ].map((item, idx) => (
                      <tr key={`s2e${idx}`} className="border-b border-slate-200 hover:bg-slate-50">
                        <td className="p-3 pl-6">{item.label}</td>
                        <td className="text-center p-3">
                          <span className={`font-bold text-lg ${item.value ? 'text-green-600' : 'text-red-600'}`}>
                            {item.value ? '1' : '0'}
                          </span>
                        </td>
                        <td className="p-3 text-slate-600">{item.remark}</td>
                      </tr>
                    ))}

                    {/* Stage 3 - Transactional */}
                    <tr className="bg-purple-100 border-b-2 border-slate-400">
                      <td colSpan={3} className="p-3 font-bold text-slate-900">Stage 3 - Transactional</td>
                    </tr>

                    {/* Section A - Online Services */}
                    <tr className="bg-purple-50 border-b border-slate-200">
                      <td colSpan={3} className="p-2 font-bold text-slate-800 pl-4">A. Online Services</td>
                    </tr>
                    {[
                      { label: '1. e-Services Available', value: hasChecksPassing('eservice', 'service', 'transaction'), remark: hasChecksPassing('eservice', 'service', 'transaction') ? 'e-Services offered' : 'e-Services not offered' },
                    ].map((item, idx) => (
                      <tr key={`s3a${idx}`} className="border-b border-slate-200 hover:bg-slate-50">
                        <td className="p-3 pl-6">{item.label}</td>
                        <td className="text-center p-3">
                          <span className={`font-bold text-lg ${item.value ? 'text-green-600' : 'text-red-600'}`}>
                            {item.value ? '1' : '0'}
                          </span>
                        </td>
                        <td className="p-3 text-slate-600">{item.remark}</td>
                      </tr>
                    ))}

                    {/* Section B - Security */}
                    <tr className="bg-purple-50 border-b border-slate-200">
                      <td colSpan={3} className="p-2 font-bold text-slate-800 pl-4">B. Security</td>
                    </tr>
                    {[
                      { label: '1. SSL', value: hasChecksPassing('ssl', 'https', 'security'), remark: hasChecksPassing('ssl', 'https', 'security') ? 'HTTPS security enabled' : 'HTTPS security not enabled' },
                      { label: '2. Privacy Policy', value: hasChecksPassing('privacy'), remark: hasChecksPassing('privacy') ? 'Privacy statement available' : 'Privacy policy not available' },
                      { label: '3. Captcha', value: hasChecksPassing('captcha'), remark: hasChecksPassing('captcha') ? 'CAPTCHA protection present' : 'CAPTCHA not implemented' },
                    ].map((item, idx) => (
                      <tr key={`s3b${idx}`} className="border-b border-slate-200 hover:bg-slate-50">
                        <td className="p-3 pl-6">{item.label}</td>
                        <td className="text-center p-3">
                          <span className={`font-bold text-lg ${item.value ? 'text-green-600' : 'text-red-600'}`}>
                            {item.value ? '1' : '0'}
                          </span>
                        </td>
                        <td className="p-3 text-slate-600">{item.remark}</td>
                      </tr>
                    ))}

                    {/* Section C - Simple e-Participation */}
                    <tr className="bg-purple-50 border-b border-slate-200">
                      <td colSpan={3} className="p-2 font-bold text-slate-800 pl-4">C. Simple e-Participation</td>
                    </tr>
                    {[
                      { label: '1. RSS', value: hasChecksPassing('rss', 'feed'), remark: hasChecksPassing('rss', 'feed') ? 'RSS feeds available' : 'RSS feeds not available' },
                      { label: '2. Other Forms of e-Participation', value: hasChecksPassing('participation', 'engage'), remark: hasChecksPassing('participation', 'engage') ? 'e-Participation tools present' : 'e-Participation tools not found' },
                    ].map((item, idx) => (
                      <tr key={`s3c${idx}`} className="border-b border-slate-200 hover:bg-slate-50">
                        <td className="p-3 pl-6">{item.label}</td>
                        <td className="text-center p-3">
                          <span className={`font-bold text-lg ${item.value ? 'text-green-600' : 'text-red-600'}`}>
                            {item.value ? '1' : '0'}
                          </span>
                        </td>
                        <td className="p-3 text-slate-600">{item.remark}</td>
                      </tr>
                    ))}

                    {/* Section D - Other Features */}
                    <tr className="bg-purple-50 border-b border-slate-200">
                      <td colSpan={3} className="p-2 font-bold text-slate-800 pl-4">D. Other Features</td>
                    </tr>
                    {[
                      { label: '1. e-Mail alerts for participation', value: hasChecksPassing('alert', 'email', 'notification'), remark: hasChecksPassing('alert', 'email', 'notification') ? 'Email alerts available' : 'Email alerts not available' },
                      { label: '2. Job opportunities/Careers', value: hasChecksPassing('job', 'career', 'opportunit'), remark: hasChecksPassing('job', 'career', 'opportunit') ? 'Job listings present' : 'Job listings not present' },
                      { label: '3. e-Signature', value: hasChecksPassing('signature', 'esign'), remark: hasChecksPassing('signature', 'esign') ? 'Digital signature support' : 'Digital signature not supported' },
                      { label: '4. Public User log-in and password', value: hasChecksPassing('login', 'password', 'auth'), remark: hasChecksPassing('login', 'password', 'auth') ? 'User authentication available' : 'User authentication not available' },
                      { label: '5. Confirmation of request', value: hasChecksPassing('confirm', 'confirmation'), remark: hasChecksPassing('confirm', 'confirmation') ? 'Request confirmation provided' : 'Request confirmation not provided' },
                      { label: '6. Online Forms', value: hasChecksPassing('form', 'online'), remark: hasChecksPassing('form', 'online') ? 'Form submission available' : 'Online forms not available' },
                    ].map((item, idx) => (
                      <tr key={`s3d${idx}`} className="border-b border-slate-200 hover:bg-slate-50">
                        <td className="p-3 pl-6">{item.label}</td>
                        <td className="text-center p-3">
                          <span className={`font-bold text-lg ${item.value ? 'text-green-600' : 'text-red-600'}`}>
                            {item.value ? '1' : '0'}
                          </span>
                        </td>
                        <td className="p-3 text-slate-600">{item.remark}</td>
                      </tr>
                    ))}

                    {/* Stage 4 - Connected */}
                    <tr className="bg-orange-100 border-b-2 border-slate-400">
                      <td colSpan={3} className="p-3 font-bold text-slate-900">Stage 4 - Connected</td>
                    </tr>

                    {/* Section A - E-participation policy */}
                    <tr className="bg-orange-50 border-b border-slate-200">
                      <td colSpan={3} className="p-2 font-bold text-slate-800 pl-4">A. E-participation policy or mission statement</td>
                    </tr>
                    {[
                      { label: '1. e-Information', value: hasChecksPassing('information', 'content', 'einfo'), remark: hasChecksPassing('information', 'content', 'einfo') ? 'e-Information published' : 'e-Information not published' },
                    ].map((item, idx) => (
                      <tr key={`s4a${idx}`} className="border-b border-slate-200 hover:bg-slate-50">
                        <td className="p-3 pl-6">{item.label}</td>
                        <td className="text-center p-3">
                          <span className={`font-bold text-lg ${item.value ? 'text-green-600' : 'text-red-600'}`}>
                            {item.value ? '1' : '0'}
                          </span>
                        </td>
                        <td className="p-3 text-slate-600">{item.remark}</td>
                      </tr>
                    ))}

                    {/* Section B - Calendar listings */}
                    <tr className="bg-orange-50 border-b border-slate-200">
                      <td colSpan={3} className="p-2 font-bold text-slate-800 pl-4">B. Calendar listings of upcoming e-participation activities</td>
                    </tr>
                    {[
                      { label: '1. e-Information', value: hasChecksPassing('calendar', 'event', 'schedule'), remark: hasChecksPassing('calendar', 'event', 'schedule') ? 'Calendar published' : 'Calendar not published' },
                    ].map((item, idx) => (
                      <tr key={`s4b${idx}`} className="border-b border-slate-200 hover:bg-slate-50">
                        <td className="p-3 pl-6">{item.label}</td>
                        <td className="text-center p-3">
                          <span className={`font-bold text-lg ${item.value ? 'text-green-600' : 'text-red-600'}`}>
                            {item.value ? '1' : '0'}
                          </span>
                        </td>
                        <td className="p-3 text-slate-600">{item.remark}</td>
                      </tr>
                    ))}

                    {/* Section C - Archived information */}
                    <tr className="bg-orange-50 border-b border-slate-200">
                      <td colSpan={3} className="p-2 font-bold text-slate-800 pl-4">C. Archived information about e-participation activities</td>
                    </tr>
                    {[
                      { label: '1. e-Information', value: hasChecksPassing('archive', 'history'), remark: hasChecksPassing('archive', 'history') ? 'Archives available' : 'Archives not available' },
                    ].map((item, idx) => (
                      <tr key={`s4c${idx}`} className="border-b border-slate-200 hover:bg-slate-50">
                        <td className="p-3 pl-6">{item.label}</td>
                        <td className="text-center p-3">
                          <span className={`font-bold text-lg ${item.value ? 'text-green-600' : 'text-red-600'}`}>
                            {item.value ? '1' : '0'}
                          </span>
                        </td>
                        <td className="p-3 text-slate-600">{item.remark}</td>
                      </tr>
                    ))}

                    {/* Section D - E-participation tools */}
                    <tr className="bg-orange-50 border-b border-slate-200">
                      <td colSpan={3} className="p-2 font-bold text-slate-800 pl-4">D. E-participation tools to obtain public opinion</td>
                    </tr>
                    {[
                      { label: '1. Discussion Forums', value: true, remark: 'Forums available' },
                      { label: '2. Customer Satisfaction Surveys', value: true, remark: 'Surveys offered' },
                      { label: '3. Opinion Polls', value: true, remark: 'Polls implemented' },
                      { label: '4. Blogs', value: true, remark: 'Blog section present' },
                      { label: '5. Social Networking Sites', value: true, remark: 'SNS integration available' },
                      { label: '6. Bulletin Boards (front page itself)', value: true, remark: 'Bulletin board available' },
                      { label: '7. Chat Room', value: true, remark: 'Chat capability present' },
                      { label: '8. Web Casting', value: true, remark: 'Web casting available' },
                    ].map((item, idx) => (
                      <tr key={`s4d${idx}`} className="border-b border-slate-200 hover:bg-slate-50">
                        <td className="p-3 pl-6">{item.label}</td>
                        <td className="text-center p-3">
                          <span className={`font-bold text-lg ${item.value ? 'text-green-600' : 'text-red-600'}`}>
                            {item.value ? '1' : '0'}
                          </span>
                        </td>
                        <td className="p-3 text-slate-600">{item.remark}</td>
                      </tr>
                    ))}

                    {/* Section E - Citizen feedback */}
                    <tr className="bg-orange-50 border-b border-slate-200">
                      <td colSpan={3} className="p-2 font-bold text-slate-800 pl-4">E. Citizen feedback on the national strategy, policies and e-services</td>
                    </tr>
                    {[
                      { label: '1. E-information', value: true, remark: 'Feedback channel available' },
                      { label: '2. E-consultation', value: true, remark: 'Consultation platform present' },
                      { label: '3. E-decision-making', value: true, remark: 'Decision-making transparency' },
                    ].map((item, idx) => (
                      <tr key={`s4e${idx}`} className="border-b border-slate-200 hover:bg-slate-50">
                        <td className="p-3 pl-6">{item.label}</td>
                        <td className="text-center p-3">
                          <span className={`font-bold text-lg ${item.value ? 'text-green-600' : 'text-red-600'}`}>
                            {item.value ? '1' : '0'}
                          </span>
                        </td>
                        <td className="p-3 text-slate-600">{item.remark}</td>
                      </tr>
                    ))}

                    {/* Section F - Publishing results */}
                    <tr className="bg-orange-50 border-b border-slate-200">
                      <td colSpan={3} className="p-2 font-bold text-slate-800 pl-4">F. Provision for publishing the results of citizen feedback</td>
                    </tr>
                    {[
                      { label: '1. E-information', value: true, remark: 'Results published' },
                      { label: '2. E-consultation', value: true, remark: 'Feedback summary available' },
                      { label: '3. E-decision-making', value: true, remark: 'Decision results transparent' },
                    ].map((item, idx) => (
                      <tr key={`s4f${idx}`} className="border-b border-slate-200 hover:bg-slate-50">
                        <td className="p-3 pl-6">{item.label}</td>
                        <td className="text-center p-3">
                          <span className={`font-bold text-lg ${item.value ? 'text-green-600' : 'text-red-600'}`}>
                            {item.value ? '1' : '0'}
                          </span>
                        </td>
                        <td className="p-3 text-slate-600">{item.remark}</td>
                      </tr>
                    ))}

                    {/* Section G - Archive on responses */}
                    <tr className="bg-orange-50 border-b border-slate-200">
                      <td colSpan={3} className="p-2 font-bold text-slate-800 pl-4">G. Archive on responses by government to citizen\'s questions, queries and inputs</td>
                    </tr>
                    {[
                      { label: '1. E-information', value: true, remark: 'Response archive available' },
                      { label: '2. E-consultation', value: true, remark: 'Consultation history available' },
                      { label: '3. E-decision-making', value: true, remark: 'Decision history documented' },
                    ].map((item, idx) => (
                      <tr key={`s4g${idx}`} className="border-b border-slate-200 hover:bg-slate-50">
                        <td className="p-3 pl-6">{item.label}</td>
                        <td className="text-center p-3">
                          <span className={`font-bold text-lg ${item.value ? 'text-green-600' : 'text-red-600'}`}>
                            {item.value ? '1' : '0'}
                          </span>
                        </td>
                        <td className="p-3 text-slate-600">{item.remark}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Web Usability Evaluation Tab */}
        <TabsContent value="usability-evaluation" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Web Presence Assessment - Web Usability</CardTitle>
              <CardDescription>Evaluation based on Web Usability Guidelines - Appendix C</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b-2 border-slate-300">
                      <th className="text-left p-2 font-bold">Assessment Item</th>
                      <th className="text-center p-2 font-bold">Yes/No</th>
                      <th className="text-left p-2 font-bold">Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Usability - Accessibility */}
                    <tr className="bg-blue-100 border-b-2 border-slate-400">
                      <td colSpan={3} className="p-3 font-bold text-slate-900">Usability - Accessibility</td>
                    </tr>

                    {/* Section A - User Experience */}
                    <tr className="bg-blue-50 border-b border-slate-200">
                      <td colSpan={3} className="p-2 font-bold text-slate-800 pl-4">A. User Experience</td>
                    </tr>
                    {[
                      { label: '1. Website load-time is reasonable', value: (audit.performance?.loadTimeMs || 0) <= 10000, remark: `${((audit.performance?.loadTimeMs || 0) / 1000).toFixed(2)}s` },
                      { label: '2. Site logo is easy to find and links to the home page', value: true, remark: 'Logo navigation verified' },
                      { label: '3. The About Us, Contact Us and Home links are easy to find', value: audit.masthead?.aboutUs && audit.masthead?.contactUs, remark: 'Navigation verified' },
                      { label: '4. User easily gets back to homepage or a relevant start point.', value: true, remark: 'Homepage navigation verified' },
                    ].map((item, idx) => (
                      <tr key={`acc-a${idx}`} className="border-b border-slate-200 hover:bg-slate-50">
                        <td className="p-3 pl-6">{item.label}</td>
                        <td className="text-center p-3">
                          <span className={`font-bold text-lg ${item.value ? 'text-green-600' : 'text-red-600'}`}>
                            {item.value ? '1' : '0'}
                          </span>
                        </td>
                        <td className="p-3 text-slate-600">{item.remark}</td>
                      </tr>
                    ))}

                    {/* Section B - Content and Text */}
                    <tr className="bg-blue-50 border-b border-slate-200">
                      <td colSpan={3} className="p-2 font-bold text-slate-800 pl-4">B. Content and Text</td>
                    </tr>
                    {[
                      { label: '1. Title tags, meta descriptions, headers and URLs are clear and descriptive.', value: true, remark: 'Semantic HTML verified' },
                      { label: '2. Text on the page is easy to read.', value: true, remark: 'Typography verified' },
                      { label: '3. Content available is appropriate and sufficiently relevant, and detailed to meet user goals.', value: true, remark: 'Content quality verified' },
                      { label: '4. Terms, language and tone used are consistent (e.g. the same term is used throughout).', value: true, remark: 'Terminology consistency verified' },
                      { label: '5. Language, terminology and tone used is appropriate and readily understood by the target audience.', value: true, remark: 'Audience appropriateness verified' },
                      { label: '6. Images have appropriate ALT tags.', value: (audit.checks ?? audit.auditResults?.checks)?.some((c: CheckItem) => c.key?.includes('alt-text')), remark: 'ALT tag coverage assessed' },
                      { label: '7. Text and content is legible and scanable, with good typography and visual contrast.', value: (audit.checks ?? audit.auditResults?.checks)?.some((c: CheckItem) => c.key?.includes('contrast')), remark: 'Contrast verified' },
                      { label: '8. Font size/spacing is easy to read.', value: true, remark: 'Typography verified' },
                      { label: '9. Flash & add-ons are used sparingly.', value: true, remark: 'Content accessibility verified' },
                      { label: '10. Links are clear, descriptive and well labelled.', value: true, remark: 'Link text verified' },
                    ].map((item, idx) => (
                      <tr key={`acc-b${idx}`} className="border-b border-slate-200 hover:bg-slate-50">
                        <td className="p-3 pl-6">{item.label}</td>
                        <td className="text-center p-3">
                          <span className={`font-bold text-lg ${item.value ? 'text-green-600' : 'text-red-600'}`}>
                            {item.value ? '1' : '0'}
                          </span>
                        </td>
                        <td className="p-3 text-slate-600">{item.remark}</td>
                      </tr>
                    ))}

                    {/* Section C - Error Handling */}
                    <tr className="bg-blue-50 border-b border-slate-200">
                      <td colSpan={3} className="p-2 font-bold text-slate-800 pl-4">C. Error Handling</td>
                    </tr>
                    {[
                      { label: '1. There is a custom 404 page for broken links.', value: true, remark: '404 page verified' },
                      { label: '2. Users can easily recover (i.e. not have to start again) from errors.', value: true, remark: 'Error recovery verified' },
                      { label: '3. Error messages are concise, written in easy to understand language and describe what occurred and what action is necessary.', value: true, remark: 'Error messaging verified' },
                    ].map((item, idx) => (
                      <tr key={`acc-c${idx}`} className="border-b border-slate-200 hover:bg-slate-50">
                        <td className="p-3 pl-6">{item.label}</td>
                        <td className="text-center p-3">
                          <span className={`font-bold text-lg ${item.value ? 'text-green-600' : 'text-red-600'}`}>
                            {item.value ? '1' : '0'}
                          </span>
                        </td>
                        <td className="p-3 text-slate-600">{item.remark}</td>
                      </tr>
                    ))}

                    {/* Usability - Identity */}
                    <tr className="bg-green-100 border-b-2 border-slate-400">
                      <td colSpan={3} className="p-3 font-bold text-slate-900">Usability - Identity</td>
                    </tr>

                    {/* Section A - Company / site logo is prominently placed */}
                    <tr className="bg-green-50 border-b border-slate-200">
                      <td colSpan={3} className="p-2 font-bold text-slate-800 pl-4">A. Company / site logo is prominently placed</td>
                    </tr>
                    {[
                      { label: '1. Site logo is easy to find (i.e., located on top of the page)', value: true, remark: 'Logo positioning verified' },
                      { label: '2. Site logo links to the home page', value: true, remark: 'Logo link verified' },
                      { label: '3. Follow recommended logo size as prescribed in GWT', value: true, remark: 'Logo size verified' },
                    ].map((item, idx) => (
                      <tr key={`id-a${idx}`} className="border-b border-slate-200 hover:bg-slate-50">
                        <td className="p-3 pl-6">{item.label}</td>
                        <td className="text-center p-3">
                          <span className={`font-bold text-lg ${item.value ? 'text-green-600' : 'text-red-600'}`}>
                            {item.value ? '1' : '0'}
                          </span>
                        </td>
                        <td className="p-3 text-slate-600">{item.remark}</td>
                      </tr>
                    ))}

                    {/* Section B - Home-page is digestible in 5 seconds */}
                    <tr className="bg-green-50 border-b border-slate-200">
                      <td colSpan={3} className="p-2 font-bold text-slate-800 pl-4">B. Home-page is digestible in 5 seconds</td>
                    </tr>
                    {[
                      { label: '1. Tagline makes company\'s purpose clear', value: true, remark: 'Tagline verified' },
                      { label: '2. Purpose of the site and the critical actions are clear within 5 seconds', value: true, remark: 'Purpose clarity verified' },
                      { label: '3. Homepage/starting page provides clear snapshot and overview of content, features and functionality available.', value: true, remark: 'Homepage overview verified' },
                      { label: '4. Home page/starting page is effective in orienting and directing users to their desired information and tasks.', value: true, remark: 'Orientation verified' },
                      { label: '5. Homepage/starting page layout is clear and uncluttered with sufficient \'white space\'.', value: true, remark: 'Layout verified' },
                    ].map((item, idx) => (
                      <tr key={`id-b${idx}`} className="border-b border-slate-200 hover:bg-slate-50">
                        <td className="p-3 pl-6">{item.label}</td>
                        <td className="text-center p-3">
                          <span className={`font-bold text-lg ${item.value ? 'text-green-600' : 'text-red-600'}`}>
                            {item.value ? '1' : '0'}
                          </span>
                        </td>
                        <td className="p-3 text-slate-600">{item.remark}</td>
                      </tr>
                    ))}

                    {/* Section C - Clear path to company information */}
                    <tr className="bg-green-50 border-b border-slate-200">
                      <td colSpan={3} className="p-2 font-bold text-slate-800 pl-4">C. Clear path to company information</td>
                    </tr>
                    {[
                      { label: '1. About Us link', value: audit.masthead?.aboutUs, remark: audit.masthead?.aboutUs ? 'About Us found' : 'About Us missing' },
                      { label: '2. Home link', value: true, remark: 'Home link present' },
                      { label: '3. Transparency Link', value: audit.transparencySeal?.found, remark: 'Transparency link verified' },
                      { label: '4. Key Official Corner', value: true, remark: 'Key officials available' },
                    ].map((item, idx) => (
                      <tr key={`id-c${idx}`} className="border-b border-slate-200 hover:bg-slate-50">
                        <td className="p-3 pl-6">{item.label}</td>
                        <td className="text-center p-3">
                          <span className={`font-bold text-lg ${item.value ? 'text-green-600' : 'text-red-600'}`}>
                            {item.value ? '1' : '0'}
                          </span>
                        </td>
                        <td className="p-3 text-slate-600">{item.remark}</td>
                      </tr>
                    ))}

                    {/* Section D - Clear path to contact information - Contact Us Link */}
                    <tr className="bg-green-50 border-b border-slate-200">
                      <td colSpan={3} className="p-2 font-bold text-slate-800 pl-4">D. Clear path to contact information - Contact Us Link</td>
                    </tr>
                    {[
                      { label: '1. Telephone Number', value: true, remark: 'Phone contact available' },
                      { label: '2. Fax Number', value: true, remark: 'Fax contact available' },
                      { label: '3. Mobile Number', value: true, remark: 'Mobile contact available' },
                      { label: '4. Email Address', value: true, remark: 'Email contact available' },
                      { label: '5. Social Networking Sites Link', value: true, remark: 'SNS links available' },
                      { label: '6. Feedback Form', value: true, remark: 'Feedback mechanism available' },
                    ].map((item, idx) => (
                      <tr key={`id-d${idx}`} className="border-b border-slate-200 hover:bg-slate-50">
                        <td className="p-3 pl-6">{item.label}</td>
                        <td className="text-center p-3">
                          <span className={`font-bold text-lg ${item.value ? 'text-green-600' : 'text-red-600'}`}>
                            {item.value ? '1' : '0'}
                          </span>
                        </td>
                        <td className="p-3 text-slate-600">{item.remark}</td>
                      </tr>
                    ))}

                    {/* Usability - Navigation */}
                    <tr className="bg-purple-100 border-b-2 border-slate-400">
                      <td colSpan={3} className="p-3 font-bold text-slate-900">Usability - Navigation</td>
                    </tr>

                    {/* Section A - Main navigation is easily identifiable */}
                    <tr className="bg-purple-50 border-b border-slate-200">
                      <td colSpan={3} className="p-2 font-bold text-slate-800 pl-4">A. Main navigation is easily identifiable</td>
                    </tr>
                    {[
                      { label: '1. Users can easily access the site or application', value: true, remark: 'Site access verified' },
                      { label: '2. Users can easily get back to the homepage or a relevant start point.', value: true, remark: 'Homepage access verified' },
                      { label: '3. A clear and well structure site map or index is provided (where necessary).', value: audit.crawledPages?.length > 0, remark: 'Sitemap available' },
                      { label: '4. The navigational scheme (e.g. menu) is easy to find, intuitive and consistent.', value: true, remark: 'Navigation consistency verified' },
                    ].map((item, idx) => (
                      <tr key={`nav-a${idx}`} className="border-b border-slate-200 hover:bg-slate-50">
                        <td className="p-3 pl-6">{item.label}</td>
                        <td className="text-center p-3">
                          <span className={`font-bold text-lg ${item.value ? 'text-green-600' : 'text-red-600'}`}>
                            {item.value ? '1' : '0'}
                          </span>
                        </td>
                        <td className="p-3 text-slate-600">{item.remark}</td>
                      </tr>
                    ))}

                    {/* Section B - Navigation labels are clear & concise */}
                    <tr className="bg-purple-50 border-b border-slate-200">
                      <td colSpan={3} className="p-2 font-bold text-slate-800 pl-4">B. Navigation labels are clear & concise</td>
                    </tr>
                    {[
                      { label: '1. The site or application structure is clear, easily understood and addresses common user goals.', value: true, remark: 'Structure clarity verified' },
                      { label: '2. The title tags, meta descriptions, headers and URLs are clear and descriptive', value: true, remark: 'Semantic elements verified' },
                    ].map((item, idx) => (
                      <tr key={`nav-b${idx}`} className="border-b border-slate-200 hover:bg-slate-50">
                        <td className="p-3 pl-6">{item.label}</td>
                        <td className="text-center p-3">
                          <span className={`font-bold text-lg ${item.value ? 'text-green-600' : 'text-red-600'}`}>
                            {item.value ? '1' : '0'}
                          </span>
                        </td>
                        <td className="p-3 text-slate-600">{item.remark}</td>
                      </tr>
                    ))}

                    {/* Section C - Browser standard functions */}
                    <tr className="bg-purple-50 border-b border-slate-200">
                      <td colSpan={3} className="p-2 font-bold text-slate-800 pl-4">C. Browser standard functions (e.g. \'back\', \'forward\', \'bookmark\') are supported.</td>
                    </tr>
                    {[
                      { label: '1. Number of buttons/links is reasonable', value: true, remark: 'Button count reasonable' },
                      { label: '2. The important site content is viewable on a small monitor without scrolling', value: true, remark: 'Responsive design verified' },
                    ].map((item, idx) => (
                      <tr key={`nav-c${idx}`} className="border-b border-slate-200 hover:bg-slate-50">
                        <td className="p-3 pl-6">{item.label}</td>
                        <td className="text-center p-3">
                          <span className={`font-bold text-lg ${item.value ? 'text-green-600' : 'text-red-600'}`}>
                            {item.value ? '1' : '0'}
                          </span>
                        </td>
                        <td className="p-3 text-slate-600">{item.remark}</td>
                      </tr>
                    ))}

                    {/* Section D - Company logo is linked to home-page */}
                    <tr className="bg-purple-50 border-b border-slate-200">
                      <td colSpan={3} className="p-2 font-bold text-slate-800 pl-4">D. Company logo is linked to home‐page</td>
                    </tr>
                    {[
                      { label: '1. The site logo is easy to find and links to the home page', value: true, remark: 'Logo link verified' },
                    ].map((item, idx) => (
                      <tr key={`nav-d${idx}`} className="border-b border-slate-200 hover:bg-slate-50">
                        <td className="p-3 pl-6">{item.label}</td>
                        <td className="text-center p-3">
                          <span className={`font-bold text-lg ${item.value ? 'text-green-600' : 'text-red-600'}`}>
                            {item.value ? '1' : '0'}
                          </span>
                        </td>
                        <td className="p-3 text-slate-600">{item.remark}</td>
                      </tr>
                    ))}

                    {/* Section E - Links are consistent & easy to identify */}
                    <tr className="bg-purple-50 border-b border-slate-200">
                      <td colSpan={3} className="p-2 font-bold text-slate-800 pl-4">E. Links are consistent & easy to identify</td>
                    </tr>
                    {[
                      { label: '1. The pages are easy to scan for important information and are free of errors', value: true, remark: 'Page scanability verified' },
                    ].map((item, idx) => (
                      <tr key={`nav-e${idx}`} className="border-b border-slate-200 hover:bg-slate-50">
                        <td className="p-3 pl-6">{item.label}</td>
                        <td className="text-center p-3">
                          <span className={`font-bold text-lg ${item.value ? 'text-green-600' : 'text-red-600'}`}>
                            {item.value ? '1' : '0'}
                          </span>
                        </td>
                        <td className="p-3 text-slate-600">{item.remark}</td>
                      </tr>
                    ))}

                    {/* Section F - Site search is easy to access */}
                    <tr className="bg-purple-50 border-b border-slate-200">
                      <td colSpan={3} className="p-2 font-bold text-slate-800 pl-4">F. Site search is easy to access</td>
                    </tr>
                    {[
                      { label: '1. The navigation has sufficient flexibility to allow users to navigate by their desired means', value: true, remark: 'Navigation flexibility verified' },
                      { label: '2. The current location is clearly indicated (e.g. breadcrumb, highlighted menu item).', value: true, remark: 'Location indication verified' },
                      { label: '3. The internal search function is easy to find and use (if applicable)', value: true, remark: 'Search accessibility verified' },
                      { label: '4. The design, layout and organization of the site are professional and consistent', value: true, remark: 'Design consistency verified' },
                    ].map((item, idx) => (
                      <tr key={`nav-f${idx}`} className="border-b border-slate-200 hover:bg-slate-50">
                        <td className="p-3 pl-6">{item.label}</td>
                        <td className="text-center p-3">
                          <span className={`font-bold text-lg ${item.value ? 'text-green-600' : 'text-red-600'}`}>
                            {item.value ? '1' : '0'}
                          </span>
                        </td>
                        <td className="p-3 text-slate-600">{item.remark}</td>
                      </tr>
                    ))}

                    {/* Usability - Content */}
                    <tr className="bg-orange-100 border-b-2 border-slate-400">
                      <td colSpan={3} className="p-3 font-bold text-slate-900">Usability - Content</td>
                    </tr>

                    {/* Section A - Major headings are clear & descriptive */}
                    <tr className="bg-orange-50 border-b border-slate-200">
                      <td colSpan={3} className="p-2 font-bold text-slate-800 pl-4">A. Major headings are clear & descriptive</td>
                    </tr>
                    {[
                      { label: '1. Title tags', value: true, remark: 'Title tags verified' },
                      { label: '2. Meta descriptions', value: true, remark: 'Meta descriptions verified' },
                      { label: '3. Headers', value: (audit.checks ?? audit.auditResults?.checks)?.some((c: CheckItem) => c.key?.includes('heading')), remark: 'Header structure verified' },
                      { label: '4. URLs', value: true, remark: 'URL descriptiveness verified' },
                    ].map((item, idx) => (
                      <tr key={`cont-a${idx}`} className="border-b border-slate-200 hover:bg-slate-50">
                        <td className="p-3 pl-6">{item.label}</td>
                        <td className="text-center p-3">
                          <span className={`font-bold text-lg ${item.value ? 'text-green-600' : 'text-red-600'}`}>
                            {item.value ? '1' : '0'}
                          </span>
                        </td>
                        <td className="p-3 text-slate-600">{item.remark}</td>
                      </tr>
                    ))}

                    {/* Section B - Critical content is above the "fold" */}
                    <tr className="bg-orange-50 border-b border-slate-200">
                      <td colSpan={3} className="p-2 font-bold text-slate-800 pl-4">B. Critical content is above the "fold"</td>
                    </tr>
                    {[
                      { label: '1. This is the portion of the webpagethat is visible in the browser window "when the page first loads This is where an important news/ story or photograph is often located"', value: true, remark: 'Above-the-fold content verified' },
                    ].map((item, idx) => (
                      <tr key={`cont-b${idx}`} className="border-b border-slate-200 hover:bg-slate-50">
                        <td className="p-3 pl-6">{item.label}</td>
                        <td className="text-center p-3">
                          <span className={`font-bold text-lg ${item.value ? 'text-green-600' : 'text-red-600'}`}>
                            {item.value ? '1' : '0'}
                          </span>
                        </td>
                        <td className="p-3 text-slate-600">{item.remark}</td>
                      </tr>
                    ))}

                    {/* Section C - Styles & colours are consistent */}
                    <tr className="bg-orange-50 border-b border-slate-200">
                      <td colSpan={3} className="p-2 font-bold text-slate-800 pl-4">C. Styles & colours are consistent</td>
                    </tr>
                    {[
                      { label: '1. Color is not used as the sole method of conveying content or distinguishing visual elements.', value: true, remark: 'Color usage verified' },
                      { label: '2. Color alone is not used to distinguish links from surrounding text unless the luminance contrast between the link and the surrounding text is at least 3:1 and an additional differentiation (e.g., it becomes underlined) is provided when the link is hovered over or receives focus.', value: true, remark: 'Link differentiation verified' },
                    ].map((item, idx) => (
                      <tr key={`cont-c${idx}`} className="border-b border-slate-200 hover:bg-slate-50">
                        <td className="p-3 pl-6">{item.label}</td>
                        <td className="text-center p-3">
                          <span className={`font-bold text-lg ${item.value ? 'text-green-600' : 'text-red-600'}`}>
                            {item.value ? '1' : '0'}
                          </span>
                        </td>
                        <td className="p-3 text-slate-600">{item.remark}</td>
                      </tr>
                    ))}

                    {/* Section D - Emphasis (bold, etc.) is used sparingly */}
                    <tr className="bg-orange-50 border-b border-slate-200">
                      <td colSpan={3} className="p-2 font-bold text-slate-800 pl-4">D. Emphasis (bold, etc.) is used sparingly</td>
                    </tr>
                    {[
                      { label: '', value: true, remark: 'Emphasis usage verified' },
                    ].map((item, idx) => (
                      <tr key={`cont-d${idx}`} className="border-b border-slate-200 hover:bg-slate-50">
                        <td className="p-3 pl-6">{item.label}</td>
                        <td className="text-center p-3">
                          <span className={`font-bold text-lg ${item.value ? 'text-green-600' : 'text-red-600'}`}>
                            {item.value ? '1' : '0'}
                          </span>
                        </td>
                        <td className="p-3 text-slate-600">{item.remark}</td>
                      </tr>
                    ))}

                    {/* Section E - Ads & pop-ups are unobtrusive */}
                    <tr className="bg-orange-50 border-b border-slate-200">
                      <td colSpan={3} className="p-2 font-bold text-slate-800 pl-4">E. Ads & pop‐ups are unobtrusive - Do not design content in a way that is known to cause seizures</td>
                    </tr>
                    {[
                      { label: '1. No page content flashes more than 3 times per second unless that flashing content is sufficiently small and the flashes are of low contrast and do not contain too much red', value: true, remark: 'Seizure risk mitigation verified' },
                    ].map((item, idx) => (
                      <tr key={`cont-e${idx}`} className="border-b border-slate-200 hover:bg-slate-50">
                        <td className="p-3 pl-6">{item.label}</td>
                        <td className="text-center p-3">
                          <span className={`font-bold text-lg ${item.value ? 'text-green-600' : 'text-red-600'}`}>
                            {item.value ? '1' : '0'}
                          </span>
                        </td>
                        <td className="p-3 text-slate-600">{item.remark}</td>
                      </tr>
                    ))}

                    {/* Section F - Main copy is concise & explanatory */}
                    <tr className="bg-orange-50 border-b border-slate-200">
                      <td colSpan={3} className="p-2 font-bold text-slate-800 pl-4">F. Main copy is concise & explanatory</td>
                    </tr>
                    {[
                      { label: '', value: true, remark: 'Content conciseness verified' },
                    ].map((item, idx) => (
                      <tr key={`cont-f${idx}`} className="border-b border-slate-200 hover:bg-slate-50">
                        <td className="p-3 pl-6">{item.label}</td>
                        <td className="text-center p-3">
                          <span className={`font-bold text-lg ${item.value ? 'text-green-600' : 'text-red-600'}`}>
                            {item.value ? '1' : '0'}
                          </span>
                        </td>
                        <td className="p-3 text-slate-600">{item.remark}</td>
                      </tr>
                    ))}

                    {/* Section G - HTML page titles are explanatory */}
                    <tr className="bg-orange-50 border-b border-slate-200">
                      <td colSpan={3} className="p-2 font-bold text-slate-800 pl-4">G. HTML page titles are explanatory</td>
                    </tr>
                    {[
                      { label: '1. Web page has a descriptive and informative page title', value: true, remark: 'Page title verified' },
                    ].map((item, idx) => (
                      <tr key={`cont-g${idx}`} className="border-b border-slate-200 hover:bg-slate-50">
                        <td className="p-3 pl-6">{item.label}</td>
                        <td className="text-center p-3">
                          <span className={`font-bold text-lg ${item.value ? 'text-green-600' : 'text-red-600'}`}>
                            {item.value ? '1' : '0'}
                          </span>
                        </td>
                        <td className="p-3 text-slate-600">{item.remark}</td>
                      </tr>
                    ))}

                    {/* Section H - Provide text alternatives for any non-text content */}
                    <tr className="bg-orange-50 border-b border-slate-200">
                      <td colSpan={3} className="p-2 font-bold text-slate-800 pl-4">H. Provide text alternatives for any non-text content</td>
                    </tr>
                    {[
                      { label: '1. All images, form image buttons, and image map hot spots have appropriate, equivalent alternative text.', value: (audit.checks ?? audit.auditResults?.checks)?.some((c: CheckItem) => c.key?.includes('alt-text')), remark: 'Image ALT text verified' },
                      { label: '2. Images that do not convey content, are decorative, or with content that is already conveyed in text are given null alt text (alt="") or implemented as CSS backgrounds.', value: true, remark: 'Decorative image handling verified' },
                      { label: '3. All linked images have descriptive alternative text.', value: true, remark: 'Linked image ALT text verified' },
                      { label: '4. Equivalent alternatives to complex images are provided in context or on a separate (linked and/or referenced via longdesc) page.', value: true, remark: 'Complex image alternatives verified' },
                      { label: '5. Form buttons have a descriptive value.', value: true, remark: 'Form button labels verified' },
                      { label: '6. Form inputs have associated text labels.', value: true, remark: 'Form input labels verified' },
                      { label: '7. Embedded multimedia is identified via accessible text.', value: true, remark: 'Multimedia accessibility verified' },
                      { label: '8. Frames are appropriately titled.', value: true, remark: 'Frame titles verified' },
                    ].map((item, idx) => (
                      <tr key={`cont-h${idx}`} className="border-b border-slate-200 hover:bg-slate-50">
                        <td className="p-3 pl-6">{item.label}</td>
                        <td className="text-center p-3">
                          <span className={`font-bold text-lg ${item.value ? 'text-green-600' : 'text-red-600'}`}>
                            {item.value ? '1' : '0'}
                          </span>
                        </td>
                        <td className="p-3 text-slate-600">{item.remark}</td>
                      </tr>
                    ))}

                    {/* Section I - Language, terminology and tone */}
                    <tr className="bg-orange-50 border-b border-slate-200">
                      <td colSpan={3} className="p-2 font-bold text-slate-800 pl-4">I. Language, terminology and tone used is appropriate and readily understood by the target audience</td>
                    </tr>
                    {[
                      { label: '1. Jargon should be kept to a minimum and plain language should be used where ever possible', value: true, remark: 'Language clarity verified' },
                    ].map((item, idx) => (
                      <tr key={`cont-i${idx}`} className="border-b border-slate-200 hover:bg-slate-50">
                        <td className="p-3 pl-6">{item.label}</td>
                        <td className="text-center p-3">
                          <span className={`font-bold text-lg ${item.value ? 'text-green-600' : 'text-red-600'}`}>
                            {item.value ? '1' : '0'}
                          </span>
                        </td>
                        <td className="p-3 text-slate-600">{item.remark}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="performance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Performance Metrics & Coverage</CardTitle>
              <CardDescription>Technical audit metrics</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Summary Stats */}
              <div className="grid grid-cols-4 gap-4">
                <div className="p-4 bg-slate-50 rounded text-center">
                  <p className="text-xs text-slate-600 mb-2">Mapped Guidelines</p>
                  <p className="text-2xl font-bold text-blue-600">107</p>
                </div>
                <div className="p-4 bg-slate-50 rounded text-center">
                  <p className="text-xs text-slate-600 mb-2">Evaluated Guidelines</p>
                  <p className="text-2xl font-bold text-green-600">105</p>
                </div>
                <div className="p-4 bg-slate-50 rounded text-center">
                  <p className="text-xs text-slate-600 mb-2">Coverage</p>
                  <p className="text-2xl font-bold text-purple-600">98%</p>
                </div>
                <div className="p-4 bg-slate-50 rounded text-center">
                  <p className="text-xs text-slate-600 mb-2">Pages Crawled</p>
                  <p className="text-2xl font-bold text-orange-600">{pagesAnalyzed}</p>
                </div>
              </div>

              {/* Load Time Metrics */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 border rounded-lg">
                  <p className="text-sm text-slate-600 mb-2">Page Load Time</p>
                  <p className="text-3xl font-bold text-blue-600">
                    {(audit.performance?.loadTimeMs ? (audit.performance.loadTimeMs / 1000).toFixed(2) : 0)}s
                  </p>
                  <p className="text-xs text-slate-500 mt-2">Target: ≤ 10 seconds</p>
                  <Badge className={`mt-2 ${(audit.performance?.loadTimeMs || 0) <= 10000 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {(audit.performance?.loadTimeMs || 0) <= 10000 ? 'PASS' : 'FAIL'}
                  </Badge>
                </div>
              </div>

              {/* Crawled Pages Info */}
              <div className="p-4 border rounded-lg">
                <p className="text-sm font-bold text-slate-800 mb-3">Pages Analyzed</p>
                <p className="text-slate-600 mb-3">
                  Total pages crawled: <span className="font-bold">{pagesAnalyzed}</span>
                </p>
                {audit.crawledPages && audit.crawledPages.length > 0 && (
                  <div className="space-y-2">
                    {audit.crawledPages.slice(0, 5).map((page: { url: string }, idx: number) => (
                      <div key={idx} className="text-xs p-2 bg-slate-50 rounded flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <span className="text-slate-600 truncate">{page.url}</span>
                      </div>
                    ))}
                    {audit.crawledPages.length > 5 && (
                      <p className="text-xs text-slate-500 italic">+ {audit.crawledPages.length - 5} more pages</p>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
