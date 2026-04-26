import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Globe } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// Audit input configuration constants
const AUDIT_INPUT_CONFIG = {
  // URL validation
  GOVPH_DOMAIN_SUFFIX: '.gov.ph',
  DEFAULT_PROTOCOL: 'https://',
  ALLOWED_PROTOCOLS: ['http://', 'https://'],
  
  // Crawl options constraints
  MAX_PAGES_MIN: 1,
  MAX_PAGES_MAX: 200,
  MAX_PAGES_DEFAULT: 20,
  
  MAX_DEPTH_MIN: 0,
  MAX_DEPTH_MAX: 10,
  MAX_DEPTH_DEFAULT: 3,
  
  CONCURRENCY_MIN: 1,
  CONCURRENCY_MAX: 10,
  CONCURRENCY_DEFAULT: 3,
};

// URL validation error messages
const URL_VALIDATION_ERRORS = {
  EMPTY: "Please enter a URL",
  INVALID_FORMAT: "Please enter a valid URL (e.g., https://www.psa.gov.ph)",
  INVALID_DOMAIN: "Please enter a valid Philippine government domain (e.g., https://www.psa.gov.ph)",
};

interface AuditInputProps {
  onStartAudit: (
    type: "url" | "file",
    data: string | File,
    options?: {
      maxPages: number;
      maxDepth: number;
      concurrency: number;
    }
  ) => void;
  isAuditing: boolean;
  initialOptions?: {
    maxPages: number;
    maxDepth: number;
    concurrency: number;
  };
}

/**
 * Normalize URL by adding protocol if missing
 * @param url - Raw URL input
 * @returns Normalized URL with protocol
 */
const normalizeUrl = (url: string): string => {
  const trimmed = url.trim();
  if (!trimmed.match(/^https?:\/\//i)) {
    return `${AUDIT_INPUT_CONFIG.DEFAULT_PROTOCOL}${trimmed}`;
  }
  return trimmed;
};

/**
 * Check if URL is a valid Philippine government domain
 * @param hostname - Domain hostname
 * @returns true if domain is .gov.ph
 */
const isGovPhDomain = (hostname: string): boolean => {
  const lower = hostname.toLowerCase();
  return lower.endsWith(AUDIT_INPUT_CONFIG.GOVPH_DOMAIN_SUFFIX) || lower === 'gov.ph';
};

/**
 * Validate Philippine government URL
 * @param inputUrl - URL to validate
 * @returns Validation result with error message if invalid
 */
const validateGovphUrl = (
  inputUrl: string
): { valid: boolean; error?: string; normalizedUrl?: string } => {
  if (!inputUrl.trim()) {
    return { valid: false, error: URL_VALIDATION_ERRORS.EMPTY };
  }

  try {
    const normalizedUrl = normalizeUrl(inputUrl);
    const parsedUrl = new URL(normalizedUrl);

    if (!isGovPhDomain(parsedUrl.hostname)) {
      return { valid: false, error: URL_VALIDATION_ERRORS.INVALID_DOMAIN };
    }

    return { valid: true, normalizedUrl };
  } catch {
    return { valid: false, error: URL_VALIDATION_ERRORS.INVALID_FORMAT };
  }
};

/**
 * Clamp numeric value between min and max
 * @param value - Value to clamp
 * @param min - Minimum value
 * @param max - Maximum value
 * @returns Clamped value
 */
const clampValue = (value: number, min: number, max: number): number => {
  return Math.max(min, Math.min(max, value));
};

const AuditInput = ({ onStartAudit, isAuditing, initialOptions }: AuditInputProps) => {
  const { toast } = useToast();
  const [url, setUrl] = useState("");
  const [maxPages, setMaxPages] = useState(initialOptions?.maxPages ?? AUDIT_INPUT_CONFIG.MAX_PAGES_DEFAULT);
  const [maxDepth, setMaxDepth] = useState(initialOptions?.maxDepth ?? AUDIT_INPUT_CONFIG.MAX_DEPTH_DEFAULT);
  const [concurrency, setConcurrency] = useState(initialOptions?.concurrency ?? AUDIT_INPUT_CONFIG.CONCURRENCY_DEFAULT);
  const [urlError, setUrlError] = useState<string | null>(null);

  useEffect(() => {
    if (!initialOptions) return;
    setMaxPages(initialOptions.maxPages);
    setMaxDepth(initialOptions.maxDepth);
    setConcurrency(initialOptions.concurrency);
  }, [initialOptions]);

  const handleSubmit = () => {
    const validation = validateGovphUrl(url);

    if (!validation.valid) {
      setUrlError(validation.error || "Invalid URL");
      toast({
        description: validation.error,
        variant: "destructive",
      });
      return;
    }

    setUrlError(null);
    onStartAudit("url", url.trim(), {
      maxPages: clampValue(maxPages, AUDIT_INPUT_CONFIG.MAX_PAGES_MIN, AUDIT_INPUT_CONFIG.MAX_PAGES_MAX),
      maxDepth: clampValue(maxDepth, AUDIT_INPUT_CONFIG.MAX_DEPTH_MIN, AUDIT_INPUT_CONFIG.MAX_DEPTH_MAX),
      concurrency: clampValue(concurrency, AUDIT_INPUT_CONFIG.CONCURRENCY_MIN, AUDIT_INPUT_CONFIG.CONCURRENCY_MAX),
    });
  };

  const handleUrlDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const uriList = event.dataTransfer.getData("text/uri-list");
    const plainText = event.dataTransfer.getData("text/plain");
    const dropped = (uriList || plainText || "").trim();
    if (dropped) {
      setUrl(dropped);
    }
  };

  const handleUrlDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-card">
      <h2 className="font-display text-xl font-bold text-card-foreground mb-4">New Audit</h2>

      <div className="space-y-4" onDrop={handleUrlDrop} onDragOver={handleUrlDragOver}>
        <div className="relative">
          <Globe className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="https://example.gov.ph"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              if (urlError) setUrlError(null);
            }}
            className="pl-10"
            disabled={isAuditing}
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Max Pages</label>
            <Input
              type="number"
              min={AUDIT_INPUT_CONFIG.MAX_PAGES_MIN}
              max={AUDIT_INPUT_CONFIG.MAX_PAGES_MAX}
              value={maxPages}
              onChange={(e) => setMaxPages(Number(e.target.value) || AUDIT_INPUT_CONFIG.MAX_PAGES_MIN)}
              disabled={isAuditing}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Max Depth</label>
            <Input
              type="number"
              min={AUDIT_INPUT_CONFIG.MAX_DEPTH_MIN}
              max={AUDIT_INPUT_CONFIG.MAX_DEPTH_MAX}
              value={maxDepth}
              onChange={(e) => setMaxDepth(Number(e.target.value) || AUDIT_INPUT_CONFIG.MAX_DEPTH_MIN)}
              disabled={isAuditing}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Concurrency</label>
            <Input
              type="number"
              min={AUDIT_INPUT_CONFIG.CONCURRENCY_MIN}
              max={AUDIT_INPUT_CONFIG.CONCURRENCY_MAX}
              value={concurrency}
              onChange={(e) => setConcurrency(Number(e.target.value) || AUDIT_INPUT_CONFIG.CONCURRENCY_MIN)}
              disabled={isAuditing}
            />
          </div>
        </div>

        <Button
          onClick={handleSubmit}
          disabled={!url.trim() || isAuditing || !!urlError}
          className="w-full"
          size="lg"
        >
          {isAuditing ? "Scanning..." : "Start Audit"}
        </Button>
      </div>
    </div>
  );
};

export default AuditInput;
      
