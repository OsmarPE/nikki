'use client';

import { useState } from 'react';
import { CheckIcon, ChevronsUpDownIcon, SearchIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// ─── Primitivos internos (sin depender de cmdk) ────────────────────────────────
// Implementamos Command sobre elementos nativos para no agregar dependencias

interface ComboboxOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
  count?: number;
}

interface ComboboxProps {
  options: ComboboxOption[];
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  className?: string;
  triggerClassName?: string;
}

export function Combobox({
  options,
  value,
  onValueChange,
  placeholder = 'Seleccionar…',
  searchPlaceholder = 'Buscar…',
  emptyText = 'Sin resultados.',
  triggerClassName,
}: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const selected = options.find(o => o.value === value);

  const filtered = options.filter(o =>
    o.label.toLowerCase().includes(search.toLowerCase())
  );

  function select(val: string) {
    onValueChange(val === value ? '' : val);
    setOpen(false);
    setSearch('');
  }

  return (
    <div className="relative">
      <Button
        type="button"
        variant="outline"
        role="combobox"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
        className={cn(
          'h-8 justify-between text-sm font-normal gap-1.5 px-2.5',
          !selected && 'text-muted-foreground',
          triggerClassName,
        )}
      >
        <span className="truncate">{selected ? selected.label : placeholder}</span>
        <ChevronsUpDownIcon className="size-3.5 shrink-0 opacity-50" />
      </Button>

      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => { setOpen(false); setSearch(''); }} />

          {/* Dropdown */}
          <div className="absolute left-0 top-full mt-1 z-50 w-52 rounded-lg border border-border bg-popover shadow-md overflow-hidden">
            {/* Search */}
            <div className="flex items-center border-b border-border px-2.5 py-1.5 gap-2">
              <SearchIcon className="size-3.5 text-muted-foreground shrink-0" />
              <input
                autoFocus
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={searchPlaceholder}
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>

            {/* Options */}
            <div className="max-h-52 overflow-y-auto py-1">
              {filtered.length === 0 ? (
                <p className="py-4 text-center text-xs text-muted-foreground">{emptyText}</p>
              ) : (
                filtered.map(option => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => select(option.value)}
                    className={cn(
                      'w-full flex items-center justify-between px-2.5 py-1.5 text-sm text-left',
                      'hover:bg-accent hover:text-accent-foreground transition-colors',
                      value === option.value && 'bg-accent/50',
                    )}
                  >
                    <span className="flex items-center gap-2 truncate">
                      {option.icon && <span className="shrink-0">{option.icon}</span>}
                      {option.label}
                    </span>
                    <span className="flex items-center gap-1.5 shrink-0">
                      {option.count !== undefined && (
                        <span className="text-[11px] tabular-nums text-muted-foreground">{option.count}</span>
                      )}
                      <CheckIcon
                        className={cn('size-3.5', value === option.value ? 'opacity-100' : 'opacity-0')}
                      />
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── FacetedFilter — múltiples valores seleccionables ─────────────────────────

interface FacetedFilterProps {
  title: string;
  options: ComboboxOption[];
  selected: Set<string>;
  onSelectionChange: (selected: Set<string>) => void;
  triggerClassName?: string;
}

export function FacetedFilter({
  title,
  options,
  selected,
  onSelectionChange,
  triggerClassName,
}: FacetedFilterProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = options.filter(o =>
    o.label.toLowerCase().includes(search.toLowerCase())
  );

  function toggle(value: string) {
    const next = new Set(selected);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    onSelectionChange(next);
  }

  function clearAll() {
    onSelectionChange(new Set());
  }

  const hasSelection = selected.size > 0;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={cn(
          'inline-flex items-center gap-1.5 h-8 rounded-md border border-dashed border-border',
          'px-2.5 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground',
          'transition-colors font-normal',
          hasSelection && 'border-solid border-primary/40 text-foreground bg-primary/5',
          triggerClassName,
        )}
      >
        {title}
        {hasSelection && (
          <>
            <span className="h-3.5 w-px bg-border/60" />
            {selected.size === 1 ? (
              <span className="text-xs font-medium">
                {options.find(o => selected.has(o.value))?.label}
              </span>
            ) : (
              <span className="inline-flex items-center justify-center rounded bg-primary/15 text-primary text-[11px] font-semibold px-1.5 min-w-[18px] h-4">
                {selected.size}
              </span>
            )}
          </>
        )}
        <ChevronsUpDownIcon className="size-3 opacity-40" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => { setOpen(false); setSearch(''); }} />

          <div className="absolute left-0 top-full mt-1 z-50 w-52 rounded-lg border border-border bg-popover shadow-md overflow-hidden">
            {/* Search */}
            <div className="flex items-center border-b border-border px-2.5 py-1.5 gap-2">
              <SearchIcon className="size-3.5 text-muted-foreground shrink-0" />
              <input
                autoFocus
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={`Filtrar ${title.toLowerCase()}…`}
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>

            {/* Options */}
            <div className="max-h-52 overflow-y-auto py-1">
              {filtered.length === 0 ? (
                <p className="py-4 text-center text-xs text-muted-foreground">Sin resultados.</p>
              ) : (
                filtered.map(option => {
                  const isSelected = selected.has(option.value);
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => toggle(option.value)}
                      className={cn(
                        'w-full flex items-center gap-2.5 px-2.5 py-1.5 text-sm text-left',
                        'hover:bg-accent hover:text-accent-foreground transition-colors',
                      )}
                    >
                      {/* Checkbox */}
                      <div className={cn(
                        'h-3.5 w-3.5 rounded-[3px] border shrink-0 flex items-center justify-center transition-colors',
                        isSelected
                          ? 'bg-primary border-primary'
                          : 'border-border bg-background',
                      )}>
                        {isSelected && <CheckIcon className="size-2.5 text-primary-foreground" strokeWidth={3} />}
                      </div>

                      <span className="flex items-center gap-1.5 flex-1 truncate">
                        {option.icon && <span className="shrink-0">{option.icon}</span>}
                        {option.label}
                      </span>

                      {option.count !== undefined && (
                        <span className="text-[11px] tabular-nums text-muted-foreground ml-auto">
                          {option.count}
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>

            {/* Clear */}
            {hasSelection && (
              <div className="border-t border-border p-1">
                <button
                  type="button"
                  onClick={clearAll}
                  className="w-full text-center text-xs text-muted-foreground hover:text-foreground py-1 hover:bg-accent rounded-md transition-colors"
                >
                  Limpiar filtros
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
