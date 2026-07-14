'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

// ─── Context ──────────────────────────────────────────────────────────────────
const TabsContext = React.createContext<{
  value: string;
  onChange: (v: string) => void;
}>({ value: '', onChange: () => {} });

// ─── Root ─────────────────────────────────────────────────────────────────────
interface TabsProps {
  value: string;
  onValueChange: (value: string) => void;
  children: React.ReactNode;
  className?: string;
}

function Tabs({ value, onValueChange, children, className }: TabsProps) {
  return (
    <TabsContext.Provider value={{ value, onChange: onValueChange }}>
      <div className={cn('flex flex-col gap-4', className)}>{children}</div>
    </TabsContext.Provider>
  );
}

// ─── List ─────────────────────────────────────────────────────────────────────
function TabsList({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      role="tablist"
      className={cn(
        'inline-flex items-center gap-0.5 rounded-lg bg-muted p-1 text-muted-foreground',
        className,
      )}
    >
      {children}
    </div>
  );
}

// ─── Trigger ──────────────────────────────────────────────────────────────────
function TabsTrigger({
  value,
  children,
  className,
}: {
  value: string;
  children: React.ReactNode;
  className?: string;
}) {
  const ctx = React.useContext(TabsContext);
  const active = ctx.value === value;

  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={() => ctx.onChange(value)}
      className={cn(
        'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5',
        'text-[0.8rem] font-medium transition-all duration-150 outline-none',
        'focus-visible:ring-2 focus-visible:ring-ring/40',
        active
          ? 'bg-background text-foreground shadow-sm'
          : 'hover:bg-background/50 hover:text-foreground',
        className,
      )}
    >
      {children}
    </button>
  );
}

// ─── Content ──────────────────────────────────────────────────────────────────
function TabsContent({
  value,
  children,
  className,
}: {
  value: string;
  children: React.ReactNode;
  className?: string;
}) {
  const ctx = React.useContext(TabsContext);
  if (ctx.value !== value) return null;
  return <div className={cn('outline-none', className)}>{children}</div>;
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
