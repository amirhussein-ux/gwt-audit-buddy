import { CheckCircle } from 'lucide-react';

import ViewportModal from '@/components/ViewportModal';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { brandColors } from '@/lib/brandColors';
import { cn } from '@/lib/utils';

interface AuditCompletionModalProps {
  isOpen: boolean;
  onViewResults: () => void;
  onStayOnPage: () => void;
}

export default function AuditCompletionModal({
  isOpen,
  onViewResults,
  onStayOnPage,
}: AuditCompletionModalProps) {
  if (!isOpen) return null;

  return (
    <ViewportModal>
      <Card className={cn('w-full max-w-md border-green-200 bg-white shadow-lg', brandColors.surfaces.primaryCard)}>
        <CardHeader className="border-b border-green-200">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-6 w-6 text-green-600" />
            <CardTitle className="text-green-600">Audit Complete!</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 py-6">
          <p className="text-slate-700">
            Your audit has been successfully completed and the results are ready to view.
          </p>
          <div className="flex gap-3 pt-4">
            <Button onClick={onViewResults} className="flex-1 bg-green-600 hover:bg-green-700">
              View Results
            </Button>
            <Button onClick={onStayOnPage} variant="outline" className="flex-1">
              Stay on Page
            </Button>
          </div>
        </CardContent>
      </Card>
    </ViewportModal>
  );
}
