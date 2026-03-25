'use client';

import { ReactNode } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  Info,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type AlertType = 'success' | 'error' | 'warning' | 'info';

interface AlertProps {
  type: AlertType;
  title?: string;
  message: string;
  dismissible?: boolean;
  onDismiss?: () => void;
  className?: string;
}

const typeStyles: Record<AlertType, { bg: string; border: string; icon: ReactNode }> = {
  success: {
    bg: 'bg-success-50',
    border: 'border-success-200 text-success-900',
    icon: <CheckCircle2 className="w-5 h-5" />,
  },
  error: {
    bg: 'bg-danger-50',
    border: 'border-danger-200 text-danger-900',
    icon: <AlertCircle className="w-5 h-5" />,
  },
  warning: {
    bg: 'bg-warning-50',
    border: 'border-warning-200 text-warning-900',
    icon: <AlertTriangle className="w-5 h-5" />,
  },
  info: {
    bg: 'bg-info-50',
    border: 'border-info-200 text-info-900',
    icon: <Info className="w-5 h-5" />,
  },
};

export function Alert({
  type,
  title,
  message,
  dismissible = true,
  onDismiss,
  className,
}: AlertProps) {
  const style = typeStyles[type];

  return (
    <div
      className={cn(
        `${style.bg} border ${style.border} rounded-lg p-4 flex gap-4 animate-slide-down`,
        className
      )}
    >
      <div className="flex-shrink-0 pt-0.5">{style.icon}</div>
      <div className="flex-grow">
        {title && <p className="font-semibold text-sm mb-1">{title}</p>}
        <p className="text-sm">{message}</p>
      </div>
      {dismissible && onDismiss && (
        <button
          onClick={onDismiss}
          className="flex-shrink-0 ml-2 hover:opacity-70 transition-opacity"
        >
          <X className="w-5 h-5" />
        </button>
      )}
    </div>
  );
}
