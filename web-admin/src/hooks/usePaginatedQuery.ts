/**
 * Hook genérico de paginación server-side con react-query.
 *
 * Encapsula: página actual, búsqueda, filtros dinámicos,
 * y la query react-query que los envía al backend DRF.
 *
 * Uso:
 *   const { data, page, setPage, search, setSearch, filters, setFilter, isLoading }
 *     = usePaginatedQuery({ queryKey: 'clientes', fetchFn: clientesService.list });
 */

import { useState, useCallback, useMemo } from 'react';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface UsePaginatedQueryOptions<T> {
  /** Clave base para react-query */
  queryKey: string;
  /** Función que recibe params y retorna la data paginada */
  fetchFn: (params: Record<string, string>) => Promise<PaginatedResponse<T>>;
  /** Tamaño de página (default: 20, coincide con PAGE_SIZE del backend) */
  pageSize?: number;
  /** Filtros iniciales opcionales */
  initialFilters?: Record<string, string>;
  /** Desactivar la query hasta que se active manualmente */
  enabled?: boolean;
  /** Tiempo de stale en ms (default: 30s) */
  staleTime?: number;
}

export interface UsePaginatedQueryReturn<T> {
  data: T[];
  totalCount: number;
  totalPages: number;
  page: number;
  setPage: (p: number) => void;
  search: string;
  setSearch: (s: string) => void;
  filters: Record<string, string>;
  setFilter: (key: string, value: string) => void;
  clearFilters: () => void;
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
  refetch: UseQueryResult['refetch'];
}

export function usePaginatedQuery<T>({
  queryKey,
  fetchFn,
  pageSize = 20,
  initialFilters = {},
  enabled = true,
  staleTime = 30_000,
}: UsePaginatedQueryOptions<T>): UsePaginatedQueryReturn<T> {
  const [page, setPage] = useState(1);
  const [search, setSearchRaw] = useState('');
  const [filters, setFilters] = useState<Record<string, string>>(initialFilters);

  // Al cambiar búsqueda o filtro, resetear a página 1
  const setSearch = useCallback((s: string) => {
    setSearchRaw(s);
    setPage(1);
  }, []);

  const setFilter = useCallback((key: string, value: string) => {
    setFilters((prev) => {
      const next = { ...prev };
      if (value === '') {
        delete next[key];
      } else {
        next[key] = value;
      }
      return next;
    });
    setPage(1);
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({});
    setSearchRaw('');
    setPage(1);
  }, []);

  // Parámetros que van al backend
  const params = useMemo(() => {
    const p: Record<string, string> = {
      page: String(page),
      page_size: String(pageSize),
      ...filters,
    };
    if (search.trim()) {
      p.search = search.trim();
    }
    return p;
  }, [page, pageSize, search, filters]);

  const query = useQuery<PaginatedResponse<T>, Error>({
    queryKey: [queryKey, params],
    queryFn: () => fetchFn(params),
    enabled,
    staleTime,
    placeholderData: (prev) => prev, // keep previous data while fetching
  });

  const totalCount = query.data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return {
    data: query.data?.results ?? [],
    totalCount,
    totalPages,
    page,
    setPage,
    search,
    setSearch,
    filters,
    setFilter,
    clearFilters,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
  };
}
