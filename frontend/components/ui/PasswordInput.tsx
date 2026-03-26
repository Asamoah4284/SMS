'use client';

import { useMemo, useState } from 'react';
import type { InputHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Eye, EyeOff } from 'lucide-react';

export interface PasswordInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange'> {
  label?: string;
  error?: string;
  helperText?: string;
  icon?: ReactNode;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function PasswordInput({
  label,
  error,
  helperText,
  icon,
  className,
  value,
  onChange,
  disabled,
  placeholder,
  ...props
}: PasswordInputProps) {
  const [isVisible, setIsVisible] = useState(false);

  const ariaLabel = useMemo(() => {
    if (disabled) return 'Password visibility disabled';
    return isVisible ? 'Hide password' : 'Show password';
  }, [disabled, isVisible]);

  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-semibold text-gray-700 mb-1.5">
          {label}
        </label>
      )}

      <div className="relative">
        {icon && (
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
            {icon}
          </div>
        )}

        <input
          {...props}
          disabled={disabled}
          type={isVisible ? 'text' : 'password'}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            'w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-900 placeholder:text-gray-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all disabled:opacity-60 disabled:cursor-not-allowed',
            icon ? 'pl-10' : undefined,
            // Space for the eye icon button
            'pr-12',
            error && 'border-danger-500 focus:ring-danger-500',
            className
          )}
        />

        <button
          type="button"
          disabled={disabled}
          aria-label={ariaLabel}
          onClick={() => setIsVisible((v) => !v)}
          className={cn(
            'absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-500 rounded-md p-1 transition-colors disabled:opacity-60'
          )}
        >
          {isVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>

      {error && <p className="mt-1 text-xs font-medium text-danger-600">{error}</p>}
      {!error && helperText && <p className="mt-1 text-xs text-gray-500">{helperText}</p>}
    </div>
  );
}

