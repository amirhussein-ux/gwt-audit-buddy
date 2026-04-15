import { CheckCircle2, Circle, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// Animation and visual configuration
const AUDIT_PROGRESS_CONFIG = {
  // Animation delays (in seconds)
  STEP_ANIMATION_DELAY: 0.05,
  ICON_SIZE: "h-5 w-5",
};

// Status icon configuration
const STATUS_ICONS = {
  done: CheckCircle2,
  running: Loader2,
  failed: Circle,
  pending: Circle,
};

// Status color configuration
const STATUS_COLORS = {
  done: "text-success",
  running: "text-primary animate-spin",
  failed: "text-destructive",
  pending: "text-muted-foreground/40",
};

// Status text color and font configuration
const STATUS_TEXT_CLASSES = {
  done: "text-card-foreground",
  running: "text-primary font-medium animate-scan-pulse",
  failed: "text-destructive",
  pending: "text-muted-foreground",
};

export interface AuditStep {
  id: string;
  label: string;
  status: "pending" | "running" | "done" | "failed";
}

interface AuditProgressProps {
  steps: AuditStep[];
  isVisible: boolean;
}

/**
 * Get icon component for audit step status
 * @param status - Step status
 * @returns React component for status icon
 */
const getStatusIcon = (status: AuditStep["status"]) => {
  return STATUS_ICONS[status];
};

/**
 * Get CSS classes for status icon
 * @param status - Step status
 * @returns CSS class string
 */
const getStatusIconClass = (status: AuditStep["status"]): string => {
  return `${AUDIT_PROGRESS_CONFIG.ICON_SIZE} ${STATUS_COLORS[status]} shrink-0`;
};

/**
 * Get CSS classes for status text
 * @param status - Step status
 * @returns CSS class string
 */
const getStatusTextClass = (status: AuditStep["status"]): string => {
  return `text-sm ${STATUS_TEXT_CLASSES[status]}`;
};

const AuditProgress = ({ steps, isVisible }: AuditProgressProps) => {
  if (!isVisible) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-card">
      <h3 className="font-display text-lg font-bold text-card-foreground mb-4">Audit Progress</h3>
      <div className="space-y-3">
        <AnimatePresence>
          {steps.map((step, i) => {
            const IconComponent = getStatusIcon(step.status);

            return (
              <motion.div
                key={step.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * AUDIT_PROGRESS_CONFIG.STEP_ANIMATION_DELAY }}
                className="flex items-center gap-3"
              >
                <IconComponent className={getStatusIconClass(step.status)} />
                <span className={getStatusTextClass(step.status)}>{step.label}</span>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default AuditProgress;
