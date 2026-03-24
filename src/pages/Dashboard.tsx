import { useState, useCallback, useEffect } from "react";
import { Shield, LogOut, History, PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import AuditInput from "@/components/AuditInput";
import AuditProgress, { type AuditStep } from "@/components/AuditProgress";
import AuditResults, { type AuditResultData } from "@/components/AuditResults";

const AUDIT_STEPS: Omit<AuditStep, "status">[] = [
  { id: "fetch", label: "Fetching page content" },
  { id: "pst", label: "Checking Philippine Standard Time (PST)" },
  { id: "transparency", label: "Scanning for Transparency Seal" },
  { id: "citizens", label: "Checking Citizen's Charter" },
  { id: "masthead", label: "Verifying masthead links (About Us, Contact Us, Home)" },
  { id: "loadtime", label: "Measuring website load time" },
  { id: "alttags", label: "Inspecting image ALT tags" },
  { id: "urls", label: "Validating descriptive URLs" },
  { id: "fonts", label: "Checking font sizes (12pt–14pt)" },
  { id: "sns", label: "Validating Social Networking Site links" },
  { id: "presence", label: "Scoring Web Presence stages" },
  { id: "report", label: "Generating audit report" },
];

const mockAuditResult: AuditResultData = {
  url: "https://example.gov.ph",
  date: new Date().toLocaleDateString(),
  webPresence: { stage1: 75, stage2: 60, stage3: 30, stage4: 10, total: 44 },
  webUsability: { accessibility: 70, identity: 85, navigation: 65, content: 55, total: 69 },
  categories: [
    {
      name: "Web Presence – Stage 1 (Emerging)",
      items: [
        { id: "p1-1", criterion: "Home page present", status: "Pass", remark: "Homepage detected with working Home link." },
        { id: "p1-2", criterion: "Philippine Standard Time displayed", status: "Fail", remark: "No PST clock found in masthead or homepage." },
        { id: "p1-3", criterion: "Links to GOVPH and standard footer", status: "Pass", remark: "GOVPH link found in top navigation." },
        { id: "p1-4", criterion: "Site Map available", status: "Fail", remark: "No sitemap link found in footer." },
        { id: "p1-5", criterion: "Agency Name and Logo in masthead", status: "Pass", remark: "Agency logo detected in masthead." },
        { id: "p1-6", criterion: "About Us page", status: "Pass", remark: "About Us link found and accessible." },
        { id: "p1-7", criterion: "Transparency Seal", status: "Fail", remark: "Missing Transparency Seal on homepage." },
        { id: "p1-8", criterion: "Citizen's Charter", status: "Fail", remark: "No Citizen's Charter page found." },
      ],
    },
    {
      name: "Web Usability – Accessibility",
      items: [
        { id: "u1-1", criterion: "Website load time ≤ 10 seconds", status: "Pass", remark: "Load time: 3.2 seconds (avg of 3 trials)." },
        { id: "u1-2", criterion: "Site logo links to homepage", status: "Pass", remark: "Logo click redirects to homepage." },
        { id: "u1-3", criterion: "About Us, Contact Us, Home links in masthead", status: "Fail", remark: "Contact Us link not found in masthead." },
        { id: "u1-4", criterion: "Breadcrumbs or navigation menu present", status: "Pass", remark: "Navigation menu found on all pages." },
      ],
    },
    {
      name: "Web Usability – Content",
      items: [
        { id: "u2-1", criterion: "Descriptive title tags, headers, URLs", status: "Pass", remark: "URLs use descriptive slugs." },
        { id: "u2-2", criterion: "No blinking or moving text", status: "Pass", remark: "No blinking/moving text detected." },
        { id: "u2-3", criterion: "Images have ALT tags", status: "Fail", remark: "4 of 12 images missing ALT attributes." },
        { id: "u2-4", criterion: "Font size 12pt–14pt", status: "Pass", remark: "Body font size is 14px (~10.5pt). Within acceptable range." },
        { id: "u2-5", criterion: "Links are descriptive (no 'Click Here')", status: "Pass", remark: "All links use descriptive text." },
      ],
    },
    {
      name: "Web Presence – Stage 2 (Enhanced)",
      items: [
        { id: "p2-1", criterion: "Information/data is up to date", status: "N/A", remark: "Requires manual verification of content dates." },
        { id: "p2-2", criterion: "Search function available", status: "Pass", remark: "Search bar found in header." },
        { id: "p2-3", criterion: "SNS links present and working", status: "Fail", remark: "Facebook link returns 404 error." },
      ],
    },
  ],
};

const Dashboard = () => {
  const [activeTab, setActiveTab] = useState<"audit" | "history">("audit");
  const [isAuditing, setIsAuditing] = useState(false);
  const [steps, setSteps] = useState<AuditStep[]>([]);
  const [results, setResults] = useState<AuditResultData | null>(null);

  const runMockAudit = useCallback((_type: "url" | "file", _data: string | File) => {
    setIsAuditing(true);
    setResults(null);
    const initialSteps = AUDIT_STEPS.map((s) => ({ ...s, status: "pending" as const }));
    setSteps(initialSteps);

    let currentStep = 0;
    const interval = setInterval(() => {
      if (currentStep >= AUDIT_STEPS.length) {
        clearInterval(interval);
        setIsAuditing(false);
        setResults(mockAuditResult);
        return;
      }
      setSteps((prev) =>
        prev.map((s, i) => ({
          ...s,
          status: i < currentStep ? "done" : i === currentStep ? "running" : "pending",
        }))
      );
      currentStep++;
    }, 600);
  }, []);

  // Mark all as done when audit finishes
  useEffect(() => {
    if (!isAuditing && results) {
      setSteps((prev) => prev.map((s) => ({ ...s, status: "done" as const })));
    }
  }, [isAuditing, results]);

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <nav className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-md">
        <div className="container mx-auto flex h-14 items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            <span className="font-display text-lg font-bold text-foreground">GWT Auditor</span>
          </Link>
          <Link to="/">
            <Button variant="ghost" size="sm" className="gap-2">
              <LogOut className="h-4 w-4" />
              Sign Out
            </Button>
          </Link>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8">
        {/* Tab header */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => setActiveTab("audit")}
            className={`flex items-center gap-2 pb-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "audit"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <PlusCircle className="h-4 w-4" />
            New Audit
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`flex items-center gap-2 pb-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "history"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <History className="h-4 w-4" />
            History
          </button>
        </div>

        {activeTab === "audit" ? (
          <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
            <div className="space-y-6">
              <AuditInput onStartAudit={runMockAudit} isAuditing={isAuditing} />
              <AuditProgress steps={steps} isVisible={steps.length > 0} />
            </div>
            <div>
              {results ? (
                <AuditResults data={results} />
              ) : !isAuditing ? (
                <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border py-20 text-center">
                  <Shield className="h-12 w-12 text-muted-foreground/30 mb-4" />
                  <h3 className="font-display text-lg font-semibold text-muted-foreground">No audit yet</h3>
                  <p className="mt-1 text-sm text-muted-foreground/70">
                    Enter a URL or upload an HTML file to start scanning.
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card p-8 shadow-card text-center">
            <History className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
            <h3 className="font-display text-lg font-semibold text-muted-foreground">No audit history</h3>
            <p className="mt-1 text-sm text-muted-foreground/70">
              Your previous audit results and reports will appear here once Lovable Cloud is enabled.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
