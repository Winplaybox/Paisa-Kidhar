import { QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { t as tr } from '@/i18n';
import { api, ApiError, type ContributionStatus, type Goal, type GoalInput, type RegistryInput } from './api';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (n, e) => !(e instanceof ApiError && e.status >= 400 && e.status < 500) && n < 2,
      staleTime: 15_000,
    },
  },
});

export const useRegistries = () => useQuery({ queryKey: ['registries'], queryFn: api.registries });
export const useRegistry = (id?: string) => useQuery({ queryKey: ['registry', id], queryFn: () => api.registry(id!), enabled: !!id });
export const useInsights = (id?: string, f: { from?: string; to?: string; goal_id?: string } = {}) =>
  useQuery({ queryKey: ['insights', id, f], queryFn: () => api.insights(id!, f), enabled: !!id });
export const useContributions = (id?: string, f: { status?: ContributionStatus } = {}) =>
  useQuery({ queryKey: ['contributions', id, f], queryFn: () => api.contributions(id!, f), enabled: !!id });
export const usePlans = () => useQuery({ queryKey: ['plans'], queryFn: api.plans, staleTime: 300_000 });

function useInvalidate() {
  const qc = useQueryClient();
  return () => Promise.all(['registries', 'registry', 'insights', 'contributions'].map((k) => qc.invalidateQueries({ queryKey: [k] })));
}

export function useCreateRegistry() {
  const inv = useInvalidate();
  return useMutation({ mutationFn: (b: RegistryInput) => api.createRegistry(b), onSuccess: () => { api.track('registry_created'); return inv(); } });
}
export function useUpdateRegistry(id: string) {
  const inv = useInvalidate();
  return useMutation({ mutationFn: (b: RegistryInput) => api.updateRegistry(id, b), onSuccess: inv });
}
export function usePublish(id: string) {
  const inv = useInvalidate();
  return useMutation({ mutationFn: (publish: boolean) => (publish ? api.publish(id) : api.pause(id)), onSuccess: (_d, p) => { if (p) api.track('registry_published'); return inv(); } });
}
export function useSaveGoal(registryId: string) {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: ({ id, body }: { id?: string; body: GoalInput & { status?: Goal['status'] } }) => (id ? api.updateGoal(id, body) : api.createGoal(registryId, body)),
    onSuccess: (_d, v) => { if (!v.id) api.track('goal_created'); return inv(); },
  });
}
export function useDeleteGoal() {
  const inv = useInvalidate();
  return useMutation({ mutationFn: (id: string) => api.deleteGoal(id), onSuccess: inv });
}
export function useDecide() {
  const inv = useInvalidate();
  return useMutation({ mutationFn: ({ id, decision }: { id: string; decision: 'confirmed' | 'rejected' }) => api.decide(id, decision), onSuccess: inv });
}

/** User-facing text for any error. Known API codes are shown in the app language; unknown ones fall back to the server's message. */
export function errorMessage(e: unknown) {
  if (e instanceof ApiError) {
    const key = `err_${e.code}`;
    const local = tr(key);
    return local !== key ? local : e.message;
  }
  return e instanceof Error ? e.message : tr('cm_error');
}
