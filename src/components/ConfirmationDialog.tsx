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
      <AlertDialogContent className="max-w-md border-purple-200 bg-black/80 shadow-lg text-white">
        {/* Content */}
        <AlertDialogHeader>
          <div className="flex items-center gap-2">
            <IconComponent className={`h-5 w-5 ${config.iconColor}`} />
            <AlertDialogTitle className="text-white font-semibold">
              {title}
            </AlertDialogTitle>
          </div>

          <AlertDialogDescription className="text-slate-300 mt-2">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {/* Footer */}
        <AlertDialogFooter className="gap-3 pt-4">
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={isLoading}
            className="flex-1 bg-red-600 hover:bg-red-700 text-white"
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

          <AlertDialogCancel
            onClick={onCancel}
            disabled={isLoading}
            className="flex-1 border border-slate-600 text-black hover:bg-slate-800 hover:text-white"
          >
            {cancelText}
          </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
