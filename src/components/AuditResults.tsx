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

const AuditResults = ({ data }: AuditResultsProps) => {
  if (!data) return null;

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
                  { label: "Stage 1 – Emerging", value: data.webPresence.stage1 },
                  { label: "Stage 2 – Enhanced", value: data.webPresence.stage2 },
                  { label: "Stage 3 – Transactional", value: data.webPresence.stage3 },
                  { label: "Stage 4 – Connected", value: data.webPresence.stage4 },
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
                  <td className="py-2 text-right text-card-foreground">{data.webPresence.total.toFixed(0)}%</td>
                  <td className={`py-2 text-right ${getRemarkClass(data.webPresence.total)}`}>
                    {getRemarkLabel(data.webPresence.total)}
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

      {/* Detailed Results */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-card">
        <h3 className="font-display text-lg font-bold text-card-foreground mb-4">
          Detailed Assessment
        </h3>
        <div className="space-y-6">
          {data.categories.map((category) => (
            <div key={category.name}>
              <h4 className="font-semibold text-card-foreground text-sm uppercase tracking-wider mb-3">
                {category.name}
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 text-muted-foreground font-medium">Criterion</th>
                      <th className="text-center py-2 text-muted-foreground font-medium w-20">Status</th>
                      <th className="text-left py-2 text-muted-foreground font-medium">Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {category.items.map((item) => (
                      <tr key={item.id} className="border-b border-border/50">
                        <td className="py-2 text-card-foreground">{item.criterion}</td>
                        <td className="py-2 text-center">
                          <Badge variant="outline" className={`text-xs ${getStatusColor(item.status)}`}>
                            {item.status}
                          </Badge>
                        </td>
                        <td className="py-2 text-muted-foreground text-xs">{item.remark}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
};

export default AuditResults;
