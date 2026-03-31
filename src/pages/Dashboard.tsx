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

interface CrawlOptions {
  maxPages: number;
  maxDepth: number;
  concurrency: number;
}

interface DownloadPayload {
  filename: string;
  mimeType: string;
  base64: string;
}

interface AuditApiResponse {
  auditResults?: {
    checks?: {
      key: string;
      category: string;
      item: string;
      status: "Pass" | "Fail" | "N/A";
      remarks: string;
    }[];
    crawlSummary?: {
      pagesCrawled?: number;
    };
    auditedAt?: string;
  };
  uiReport: AuditResultData;
  downloads: {
    xlsx: DownloadPayload;
    pdf: DownloadPayload;
  };
}

function inferFallbackForm(key: string, category: string): string {
  if (key.startsWith("a11y.") || key.startsWith("performance.")) {
    return "Web Accessibility Assessment Form - Web Usability";
  }

  if (category.toLowerCase().includes("accessibility")) {
    return "Web Accessibility Assessment Form - Web Usability";
  }

  return "Web Accessibility Assessment Form - Web Presence";
}

function inferFallbackSection(category: string): string {
  if (category === "Technical Accessibility") return "Accessibility";
  if (category === "Semantic Content") return "Content and Semantics";
  if (category === "Presence & Identity") return "Presence and Identity";
  return category || "General";
}

function inferFallbackStage(key: string): string {
  if (key.startsWith("presence.") || key.startsWith("navigation.")) {
    return "Stage 1 - Emerging Web Presence";
  }

  if (key.startsWith("semantic.") || key.startsWith("error.")) {
    return "Stage 2 - Enhanced Web Presence";
  }

  return "Usability";
}

function withTransparencyFallback(payload: AuditApiResponse): AuditResultData {
  const report = payload.uiReport;
  if (report.traceability && report.traceability.length > 0) {
    return report;
  }

  const checks = payload.auditResults?.checks || [];
  const traceability = checks.map((check, index) => ({
    rowNo: String(index + 1),
    key: check.key,
    guideline: check.item,
    category: check.category,
    assessmentForm: inferFallbackForm(check.key, check.category),
    assessmentStage: inferFallbackStage(check.key),
    assessmentSection: inferFallbackSection(check.category),
    automationMethod: "Legacy response fallback from audit checks",
    status: check.status,
    evidence: check.remarks || "No evidence text provided.",
  }));

  if (traceability.length === 0) {
    return report;
  }

  const evaluatedGuidelines = traceability.filter((row) => row.status !== "N/A").length;
  return {
    ...report,
    methodology: report.methodology || {
      mappedGuidelines: traceability.length,
      evaluatedGuidelines,
      coveragePercent: Math.round((evaluatedGuidelines / traceability.length) * 100),
      pagesCrawled: payload.auditResults?.crawlSummary?.pagesCrawled || 0,
      generatedAt: payload.auditResults?.auditedAt || new Date().toISOString(),
    },
    traceability,
  };
}

function getAuditApiBase() {
  return (import.meta.env.VITE_AUDIT_API_BASE as string | undefined) || "http://localhost:4000";
}

function downloadBlob(blob: Blob, filename: string) {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(objectUrl);
}

function decodeBase64(base64: string): Uint8Array {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function downloadBase64File(file: DownloadPayload) {
  const bytes = decodeBase64(file.base64);
  const blob = new Blob([bytes], { type: file.mimeType });
  downloadBlob(blob, file.filename);
}

const Dashboard = () => {
  const [activeTab, setActiveTab] = useState<"audit" | "history">("audit");
  const [isAuditing, setIsAuditing] = useState(false);
  const [steps, setSteps] = useState<AuditStep[]>([]);
  const [results, setResults] = useState<AuditResultData | null>(null);
  const [downloads, setDownloads] = useState<AuditApiResponse["downloads"] | null>(null);
  const [auditError, setAuditError] = useState<string | null>(null);

  const runAudit = useCallback(async (type: "url" | "file", data: string | File, options?: CrawlOptions) => {
    setIsAuditing(true);
    setResults(null);
    setDownloads(null);
    setAuditError(null);
    const initialSteps = AUDIT_STEPS.map((s) => ({ ...s, status: "pending" as const }));
    setSteps(initialSteps);

    let currentStep = 0;
    const interval = setInterval(() => {
      if (currentStep >= AUDIT_STEPS.length - 1) {
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

    try {
      if (type === "url" && typeof data === "string") {
        const response = await fetch(`${getAuditApiBase()}/api/audit`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            url: data,
            maxPages: options?.maxPages,
            maxDepth: options?.maxDepth,
            concurrency: options?.concurrency,
          }),
        });

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(payload?.error || "Audit request failed.");
        }

        const payload = (await response.json()) as AuditApiResponse;
        setResults(withTransparencyFallback(payload));
        setDownloads(payload.downloads);
      } else {
        throw new Error("HTML file audit is not enabled yet. Please run URL scan.");
      }

      clearInterval(interval);
      setSteps((prev) => prev.map((s) => ({ ...s, status: "done" as const })));
    } catch (error) {
      clearInterval(interval);
      setAuditError(error instanceof Error ? error.message : "Unexpected audit error.");
      setSteps((prev) => {
        const runningIndex = prev.findIndex((s) => s.status === "running");
        const failedIndex = runningIndex >= 0 ? runningIndex : 0;
        return prev.map((s, i) => ({
          ...s,
          status: i < failedIndex ? "done" : i === failedIndex ? "failed" : "pending",
        }));
      });
    } finally {
      setIsAuditing(false);
    }
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
              <AuditInput onStartAudit={runAudit} isAuditing={isAuditing} />
              <AuditProgress steps={steps} isVisible={steps.length > 0} />
            </div>
            <div>
              {results ? (
                <div className="space-y-4">
                  {downloads ? (
                    <div className="flex flex-wrap gap-3">
                      <Button variant="outline" onClick={() => downloadBase64File(downloads.xlsx)}>
                        Download XLSX Report
                      </Button>
                      <Button variant="outline" onClick={() => downloadBase64File(downloads.pdf)}>
                        Download PDF Report
                      </Button>
                    </div>
                  ) : null}
                  <AuditResults data={results} />
                </div>
              ) : auditError ? (
                <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
                  <p className="font-semibold">Audit failed</p>
                  <p className="mt-1">{auditError}</p>
                </div>
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
