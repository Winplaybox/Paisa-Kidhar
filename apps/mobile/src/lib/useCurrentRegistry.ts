import { useRegistries, useRegistry } from './queries';

/** The couple's active registry (first non-archived). Most couples have exactly one. */
export function useCurrentRegistry() {
  const list = useRegistries();
  const id = list.data?.items[0]?.id;
  const detail = useRegistry(id);
  return {
    list,
    id,
    registry: detail.data,
    isLoading: list.isLoading || (!!id && detail.isLoading),
    error: list.error ?? detail.error,
    refetch: () => Promise.all([list.refetch(), detail.refetch()]),
    hasNone: list.isSuccess && !id,
  };
}
