import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AlertTriangle, CheckCircle, LogOut, Archive, RefreshCw } from 'lucide-react';

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
    backgroundColor: 'bg-red-50',
    confirmButtonClassName: 'bg-red-600 hover:bg-red-700',
  },
  warning: {
    icon: AlertTriangle,
    iconColor: 'text-orange-600',
    backgroundColor: 'bg-orange-50',
    confirmButtonClassName: 'bg-orange-600 hover:bg-orange-700',
  },
  info: {
    icon: Archive,
    iconColor: 'text-blue-600',
    backgroundColor: 'bg-blue-50',
    confirmButtonClassName: 'bg-blue-600 hover:bg-blue-700',
  },
  success: {
    icon: CheckCircle,
    iconColor: 'text-green-600',
    backgroundColor: 'bg-green-50',
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
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onCancel()}>
      <AlertDialogContent className="max-w-md">
        {/* Icon */}
        <div className={`flex justify-center p-3 rounded-lg ${config.backgroundColor} mb-4`}>
          <IconComponent className={`h-8 w-8 ${config.iconColor}`} />
        </div>

        {/* Content */}
        <AlertDialogHeader>
          <AlertDialogTitle className="text-lg font-semibold text-slate-900">
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-slate-600 mt-2">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {/* Footer */}
        <AlertDialogFooter className="gap-2 pt-4">
          <AlertDialogCancel
            onClick={onCancel}
            disabled={isLoading}
            className="text-slate-700 hover:bg-slate-100"
          >
            {cancelText}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={isLoading}
            className={`${config.confirmButtonClassName} text-white`}
          >
            {isLoading ? (
              <div className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4 animate-spin" />
                Processing...
              </div>
            ) : (
              confirmText
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
