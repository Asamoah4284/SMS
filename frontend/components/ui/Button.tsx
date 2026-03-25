'use client';

import { ButtonHTMLAttributes, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: ReactNode;
  children: ReactNode;
}

const variantStyles = {
  primary:
    'bg-primary-600 text-white hover:bg-primary-700 focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
  secondary:
    'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 focus:ring-2 focus:ring-gray-300 focus:ring-offset-2',
  danger:
    'bg-danger-600 text-white hover:bg-danger-700 focus:ring-2 focus:ring-danger-500 focus:ring-offset-2',
  ghost:
    'bg-transparent text-gray-700 hover:bg-gray-100 focus:ring-2 focus:ring-gray-300 focus:ring-offset-2',
};

const sizeStyles = {
  sm: 'px-3 py-1.5 text-xs font-medium rounded-md',
  md: 'px-4 py-2.5 text-sm font-semibold rounded-lg',
  lg: 'px-6 py-3 text-base font-semibold rounded-lg',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  className,
  icon,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      disabled={loading || disabled}
      className={cn(
        'inline-flex items-center justify-center gap-2 font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed',
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : icon}
      {children}
    </button>
  );
}
