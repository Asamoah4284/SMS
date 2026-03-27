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

const typeStyles: Record<AlertType, { bg: string; text: string; icon: ReactNode }> = {
  success: {
    bg: 'bg-success-50',
    text: 'text-success-900',
    icon: <CheckCircle2 className="w-5 h-5" />,
  },
  error: {
    bg: 'bg-danger-50',
    text: 'text-danger-900',
    icon: <AlertCircle className="w-5 h-5" />,
  },
  warning: {
    bg: 'bg-warning-50',
    text: 'text-warning-900',
    icon: <AlertTriangle className="w-5 h-5" />,
  },
  info: {
    bg: 'bg-info-50',
    text: 'text-info-900',
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
        // Card surface
        'relative overflow-hidden rounded-2xl p-3 sm:p-4',
        'shadow-sm shadow-black/5',
        // Layout
        'flex gap-2.5 sm:gap-3.5',
        // Motion
        'animate-slide-down',
        // Type styles
        style.bg,
        style.text,
        className
      )}
    >
      {/* Left accent */}
      <div
        className={cn(
          'absolute left-0 top-0 h-full w-1.5',
          type === 'success' && 'bg-success-500/70',
          type === 'error' && 'bg-danger-500/70',
          type === 'warning' && 'bg-warning-500/70',
          type === 'info' && 'bg-info-500/70'
        )}
      />

      <div className="flex-shrink-0 pt-0.5">
        <div
          className={cn(
            'grid place-items-center rounded-full',
            'w-8 h-8 sm:w-9 sm:h-9',
            type === 'success' && 'bg-success-100 text-success-700',
            type === 'error' && 'bg-danger-100 text-danger-700',
            type === 'warning' && 'bg-warning-100 text-warning-700',
            type === 'info' && 'bg-info-100 text-info-700'
          )}
        >
          {style.icon}
        </div>
      </div>

      <div className="flex-grow min-w-0">
        {title && <p className="font-semibold text-sm sm:text-[15px] mb-0.5">{title}</p>}
        <p className="text-sm text-gray-700 leading-relaxed">{message}</p>
      </div>
      {dismissible && onDismiss && (
        <button
          onClick={onDismiss}
          aria-label="Dismiss"
          className={cn(
            'flex-shrink-0 ml-2',
            'rounded-full p-1.5',
            'text-gray-500 hover:text-gray-700',
            'hover:bg-black/5 transition-colors'
          )}
        >
          <X className="w-4.5 h-4.5" />
        </button>
      )}
    </div>
  );
}
