import { useState, useCallback, type DragEventHandler } from "react";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Globe, Upload, FileText, X } from "lucide-react";

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
  const [url, setUrl] = useState("");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [activeTab, setActiveTab] = useState<"url" | "file">("url");
  const [maxPages, setMaxPages] = useState(20);
  const [maxDepth, setMaxDepth] = useState(3);
  const [concurrency, setConcurrency] = useState(3);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setUploadedFile(acceptedFiles[0]);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "text/html": [".html", ".htm"] },
    maxFiles: 1,
  });

  const handleSubmit = () => {
    if (activeTab === "url" && url.trim()) {
      onStartAudit("url", url.trim(), {
        maxPages: Math.max(1, maxPages),
        maxDepth: Math.max(0, maxDepth),
        concurrency: Math.max(1, concurrency),
      });
    } else if (activeTab === "file" && uploadedFile) {
      onStartAudit("file", uploadedFile);
    }
  };

  const handleUrlDrop: DragEventHandler<HTMLDivElement> = (event) => {
    event.preventDefault();
    const uriList = event.dataTransfer.getData("text/uri-list");
    const plainText = event.dataTransfer.getData("text/plain");
    const dropped = (uriList || plainText || "").trim();
    if (dropped) {
      setUrl(dropped);
    }
  };

  const handleUrlDragOver: DragEventHandler<HTMLDivElement> = (event) => {
    event.preventDefault();
  };

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-card">
      <h2 className="font-display text-xl font-bold text-card-foreground mb-4">New Audit</h2>

      {/* Tab switcher */}
      <div className="flex gap-1 rounded-lg bg-muted p-1 mb-6">
        <button
          onClick={() => setActiveTab("url")}
          className={`flex-1 flex items-center justify-center gap-2 rounded-md py-2 text-sm font-medium transition-colors ${
            activeTab === "url"
              ? "bg-card text-card-foreground shadow-sm"
              : "text-muted-foreground hover:text-card-foreground"
          }`}
        >
          <Globe className="h-4 w-4" />
          URL Scan
        </button>
        <button
          onClick={() => setActiveTab("file")}
          className={`flex-1 flex items-center justify-center gap-2 rounded-md py-2 text-sm font-medium transition-colors ${
            activeTab === "file"
              ? "bg-card text-card-foreground shadow-sm"
              : "text-muted-foreground hover:text-card-foreground"
          }`}
        >
          <Upload className="h-4 w-4" />
          File Upload
        </button>
      </div>

      {activeTab === "url" ? (
        <div className="space-y-4" onDrop={handleUrlDrop} onDragOver={handleUrlDragOver}>
          <div className="relative">
            <Globe className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="https://example.gov.ph"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
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
            disabled={!url.trim() || isAuditing}
            className="w-full"
            size="lg"
          >
            {isAuditing ? "Scanning..." : "Start Audit"}
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {uploadedFile ? (
            <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/50 p-4">
              <FileText className="h-8 w-8 text-primary" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-card-foreground truncate">{uploadedFile.name}</p>
                <p className="text-xs text-muted-foreground">
                  {(uploadedFile.size / 1024).toFixed(1)} KB
                </p>
              </div>
              <button
                onClick={() => setUploadedFile(null)}
                className="rounded-md p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div
              {...getRootProps()}
              className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors cursor-pointer ${
                isDragActive
                  ? "border-primary bg-accent"
                  : "border-border hover:border-primary/50 hover:bg-accent/50"
              }`}
            >
              <input {...getInputProps()} />
              <Upload className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-sm font-medium text-card-foreground">
                {isDragActive ? "Drop your HTML file here" : "Drag & drop an HTML file"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">or click to browse (.html, .htm)</p>
            </div>
          )}
          <Button
            onClick={handleSubmit}
            disabled={!uploadedFile || isAuditing}
            className="w-full"
            size="lg"
          >
            {isAuditing ? "Scanning..." : "Start Audit"}
          </Button>
        </div>
      )}
    </div>
  );
};

export default AuditInput;
