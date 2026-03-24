import { CheckCircle2, Circle, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export interface AuditStep {
  id: string;
  label: string;
  status: "pending" | "running" | "done" | "failed";
}

interface AuditProgressProps {
  steps: AuditStep[];
  isVisible: boolean;
}

const AuditProgress = ({ steps, isVisible }: AuditProgressProps) => {
  if (!isVisible) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-card">
      <h3 className="font-display text-lg font-bold text-card-foreground mb-4">Audit Progress</h3>
      <div className="space-y-3">
        <AnimatePresence>
          {steps.map((step, i) => (
            <motion.div
              key={step.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="flex items-center gap-3"
            >
              {step.status === "done" ? (
                <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
              ) : step.status === "running" ? (
                <Loader2 className="h-5 w-5 text-primary animate-spin shrink-0" />
              ) : step.status === "failed" ? (
                <Circle className="h-5 w-5 text-destructive shrink-0" />
              ) : (
                <Circle className="h-5 w-5 text-muted-foreground/40 shrink-0" />
              )}
              <span
                className={`text-sm ${
                  step.status === "done"
                    ? "text-card-foreground"
                    : step.status === "running"
                    ? "text-primary font-medium animate-scan-pulse"
                    : step.status === "failed"
                    ? "text-destructive"
                    : "text-muted-foreground"
                }`}
              >
                {step.label}
              </span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default AuditProgress;
