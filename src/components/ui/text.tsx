import { cn } from '@/lib/utils';
import { type ElementType, type ComponentPropsWithoutRef } from 'react';

const VARIANTS = {
  title:       'text-xl font-semibold tracking-tight',
  description: 'text-sm text-zinc-500',
} as const;

type Variant = keyof typeof VARIANTS;

type TextProps<T extends ElementType> = {
  as?: T;
  variant?: Variant;
  className?: string;
} & Omit<ComponentPropsWithoutRef<T>, 'as' | 'variant' | 'className'>;

export function Text<T extends ElementType = 'p'>({
  as,
  variant,
  className,
  ...props
}: TextProps<T>) {
  const Tag = (as ?? 'p') as ElementType;
  return (
    <Tag
      className={cn(variant && VARIANTS[variant], className)}
      {...props}
    />
  );
}
