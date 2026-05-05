import { AlertTriangle, CheckCircle, Archive, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import ViewportModal from '@/components/ViewportModal';
import { cn } from '@/lib/utils';
import { brandColors } from '@/lib/brandColors';

export interface ConfirmationDialogProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info' | 'success';
  isLoading?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

const variantConfig = {
  danger: {
    icon: AlertTriangle,
    iconColor: 'text-red-600',
    borderColor: 'border-red-200',
    titleColor: 'text-red-600',
    confirmButtonClassName: 'bg-red-600 hover:bg-red-700',
  },
  warning: {
    icon: AlertTriangle,
    iconColor: 'text-orange-600',
    borderColor: 'border-orange-200',
    titleColor: 'text-orange-600',
    confirmButtonClassName: 'bg-orange-600 hover:bg-orange-700',
  },
  info: {
    icon: Archive,
    iconColor: 'text-blue-600',
    borderColor: 'border-blue-200',
    titleColor: 'text-blue-600',
    confirmButtonClassName: 'bg-blue-600 hover:bg-blue-700',
  },
  success: {
    icon: CheckCircle,
    iconColor: 'text-green-600',
    borderColor: 'border-green-200',
    titleColor: 'text-green-600',
    confirmButtonClassName: 'bg-green-600 hover:bg-green-700',
  },
};

export default function ConfirmationDialog({
  isOpen,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'warning',
  isLoading = false,
  onConfirm,
  onCancel,
}: ConfirmationDialogProps) {
  if (!isOpen) return null;

  const config = variantConfig[variant];
  const IconComponent = config.icon;

  const handleConfirm = async () => {
    try {
      await onConfirm();
    } catch (error) {
      console.error('Confirmation action error:', error);
    }
  };

  return (
    <ViewportModal>
      <Card className={cn('mx-4 w-full max-w-md shadow-lg border', config.borderColor, 'bg-slate-900', brandColors.surfaces.primaryCard)}>
        <CardHeader className={cn('border-b', config.borderColor)}>
          <div className="flex items-center gap-2">
            <IconComponent className={`h-6 w-6 ${config.iconColor}`} />
            <CardTitle className={config.titleColor}>
              {title}
            </CardTitle>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 py-6">
          <p className="text-slate-200">
            {description}
          </p>
          <div className="flex gap-3 pt-4">
            <Button
              onClick={handleConfirm}
              disabled={isLoading}
              className={`flex-1 text-white ${config.confirmButtonClassName}`}
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Processing...
                </div>
              ) : (
                confirmText
              )}
            </Button>

            <Button
              onClick={onCancel}
              disabled={isLoading}
              variant="outline"
              className="flex-1 bg-white text-slate-900 hover:bg-slate-100"
            >
              {cancelText}
            </Button>
          </div>
        </CardContent>
      </Card>
    </ViewportModal>
  );
}
