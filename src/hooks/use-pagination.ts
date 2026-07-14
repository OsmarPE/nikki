import { useState, useMemo } from 'react';

interface UsePaginationOptions {
  pageSize?: number;
}

export function usePagination<T>(items: T[], { pageSize = 20 }: UsePaginationOptions = {}) {
  const [page, setPage] = useState(0);

  // Reset a página 0 si los items cambian (filtros)
  const totalPages = Math.ceil(items.length / pageSize);
  const safePage   = Math.min(page, Math.max(0, totalPages - 1));

  const paged = useMemo(
    () => items.slice(safePage * pageSize, safePage * pageSize + pageSize),
    [items, safePage, pageSize]
  );

  return {
    paged,
    page: safePage,
    totalPages,
    pageSize,
    total: items.length,
    hasPrev: safePage > 0,
    hasNext: safePage < totalPages - 1,
    goTo:   (n: number) => setPage(Math.max(0, Math.min(n, totalPages - 1))),
    prev:   () => setPage(p => Math.max(0, p - 1)),
    next:   () => setPage(p => Math.min(totalPages - 1, p + 1)),
    reset:  () => setPage(0),
  };
}
