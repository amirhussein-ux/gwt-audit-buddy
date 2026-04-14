import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Globe } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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
}

const AuditInput = ({ onStartAudit, isAuditing }: AuditInputProps) => {
  const { toast } = useToast();
  const [url, setUrl] = useState("");
  const [maxPages, setMaxPages] = useState(20);
  const [maxDepth, setMaxDepth] = useState(3);
  const [concurrency, setConcurrency] = useState(3);
  const [urlError, setUrlError] = useState<string | null>(null);

  // Validate gov.ph URL format
  const validateGovphUrl = (inputUrl: string): boolean => {
    if (!inputUrl.trim()) {
      const errorMsg = "Please enter a URL";
      setUrlError(errorMsg);
      toast({
        description: errorMsg,
        variant: "destructive",
      });
      return false;
    }

    try {
      // Check if URL has protocol, if not add https://
      let urlToCheck = inputUrl.trim();
      if (!urlToCheck.match(/^https?:\/\//i)) {
        urlToCheck = `https://${urlToCheck}`;
      }

      const parsedUrl = new URL(urlToCheck);
      const hostname = parsedUrl.hostname.toLowerCase();

      // Check if domain ends with .gov.ph
      if (!hostname.endsWith('.gov.ph') && hostname !== 'gov.ph') {
        const errorMsg = 'Please enter a valid Philippine government domain (e.g., https://www.psa.gov.ph)';
        setUrlError(errorMsg);
        toast({
          description: errorMsg,
          variant: "destructive",
        });
        return false;
      }

      // Check if URL has a path or just the domain
      if (parsedUrl.pathname === '/' || parsedUrl.pathname === '') {
        // Valid gov.ph domain with only root path
        setUrlError(null);
        return true;
      }

      // Valid gov.ph domain with additional path
      setUrlError(null);
      return true;
    } catch {
      const errorMsg = 'Please enter a valid URL (e.g., https://www.psa.gov.ph)';
      setUrlError(errorMsg);
      toast({
        description: errorMsg,
        variant: "destructive",
      });
      return false;
    }
  };

  const handleSubmit = () => {
    // Validate URL before submitting
    if (!validateGovphUrl(url)) {
      return; // Error message already set by validateGovphUrl
    }
    
    onStartAudit("url", url.trim(), {
      maxPages: Math.max(1, maxPages),
      maxDepth: Math.max(0, maxDepth),
      concurrency: Math.max(1, concurrency),
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
              // Clear error on input change to allow user to re-validate
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
              min={1}
              max={200}
              value={maxPages}
              onChange={(e) => setMaxPages(Number(e.target.value) || 1)}
              disabled={isAuditing}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Max Depth</label>
            <Input
              type="number"
              min={0}
              max={10}
              value={maxDepth}
              onChange={(e) => setMaxDepth(Number(e.target.value) || 0)}
              disabled={isAuditing}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Concurrency</label>
            <Input
              type="number"
              min={1}
              max={10}
              value={concurrency}
              onChange={(e) => setConcurrency(Number(e.target.value) || 1)}
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
      