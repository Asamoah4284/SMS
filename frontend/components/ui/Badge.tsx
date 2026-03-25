'use client';

import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type BadgeVariant =
  | 'success'
  | 'error'
  | 'warning'
  | 'info'
  | 'default';

interface BadgeProps {
  variant?: BadgeVariant;
  children: ReactNode;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  success: 'bg-success-50 text-success-700 border-success-100',
  error: 'bg-danger-50 text-danger-700 border-danger-100',
  warning: 'bg-warning-50 text-warning-700 border-warning-100',
  info: 'bg-info-50 text-info-700 border-info-100',
  default: 'bg-gray-50 text-gray-700 border-gray-100',
};

export function Badge({
  variant = 'default',
  children,
  className,
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border',
        variantStyles[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
