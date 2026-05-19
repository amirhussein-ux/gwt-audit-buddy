import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ReportProblemForm } from './ReportProblemForm';
import { MessageSquareWarning } from 'lucide-react';

interface ReportProblemModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  auditLogId?: string | null;
}

export const ReportProblemModal: React.FC<ReportProblemModalProps> = ({
  open,
  onOpenChange,
  auditLogId = null,
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <MessageSquareWarning className="h-5 w-5 text-slate-600" />
            <DialogTitle>Report a Problem</DialogTitle>
          </div>
          <DialogDescription>
            Help us improve by reporting issues or sharing feedback about the application
          </DialogDescription>
        </DialogHeader>

        <ReportProblemForm
          onClose={() => onOpenChange(false)}
          onSuccess={() => {
            setTimeout(() => {
              onOpenChange(false);
            }, 1500);
          }}
          auditLogId={auditLogId}
        />
      </DialogContent>
    </Dialog>
  );
};

export default ReportProblemModal;
