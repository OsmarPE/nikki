import { forwardRef } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

// ─── FormField ────────────────────────────────────────────────────────────────
interface FormFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  error?: string;
  description?: string;
}

export const FormField = forwardRef<HTMLInputElement, FormFieldProps>(
  ({ label, hint, error, description, className, id, ...props }, ref) => {
    const fieldId = id ?? `field-${label.toLowerCase().replace(/\s+/g, '-')}`;
    return (
      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between">
          <Label htmlFor={fieldId} className="text-xs font-medium text-foreground">
            {label}
          </Label>
          {hint && (
            <span className="text-[11px] text-muted-foreground">{hint}</span>
          )}
        </div>
        <Input
          ref={ref}
          id={fieldId}
          className={cn(
            'h-8 text-sm',
            error && 'border-destructive focus-visible:ring-destructive/20',
            className,
          )}
          aria-invalid={!!error}
          aria-describedby={error ? `${fieldId}-error` : undefined}
          {...props}
        />
        {description && !error && (
          <p className="text-[11px] text-muted-foreground">{description}</p>
        )}
        {error && (
          <p id={`${fieldId}-error`} className="text-[11px] text-destructive">{error}</p>
        )}
      </div>
    );
  },
);
FormField.displayName = 'FormField';

// ─── TextareaField ────────────────────────────────────────────────────────────
interface TextareaFieldProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  hint?: string;
  error?: string;
  description?: string;
}

export const TextareaField = forwardRef<HTMLTextAreaElement, TextareaFieldProps>(
  ({ label, hint, error, description, className, id, ...props }, ref) => {
    const fieldId = id ?? `field-${label.toLowerCase().replace(/\s+/g, '-')}`;
    return (
      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between">
          <Label htmlFor={fieldId} className="text-xs font-medium text-foreground">
            {label}
          </Label>
          {hint && (
            <span className="text-[11px] text-muted-foreground">{hint}</span>
          )}
        </div>
        <Textarea
          ref={ref}
          id={fieldId}
          className={cn(
            'text-sm resize-none',
            error && 'border-destructive focus-visible:ring-destructive/20',
            className,
          )}
          aria-invalid={!!error}
          {...props}
        />
        {description && !error && (
          <p className="text-[11px] text-muted-foreground">{description}</p>
        )}
        {error && (
          <p className="text-[11px] text-destructive">{error}</p>
        )}
      </div>
    );
  },
);
TextareaField.displayName = 'TextareaField';

// ─── FieldGroup — agrupa campos con un separador visual tipo Notion ───────────
interface FieldGroupProps {
  label?: string;
  children: React.ReactNode;
  className?: string;
}

export function FieldGroup({ label, children, className }: FieldGroupProps) {
  return (
    <div className={cn('space-y-3', className)}>
      {label && (
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70 select-none">
          {label}
        </p>
      )}
      {children}
    </div>
  );
}
