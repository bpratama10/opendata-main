import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

// TODO: Regenerate Supabase types after migration
// Run: npx supabase gen types typescript --project-id YOUR_PROJECT_ID
// Then replace these table names with proper typed versions

export interface ApiKey {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  rate_limit_requests: number;
  rate_limit_window_minutes: number;
  is_active: boolean;
  expires_at?: string;
  last_used_at?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateApiKeyParams {
  name: string;
  description?: string;
  rate_limit_requests?: number;
  rate_limit_window_minutes?: number;
  expires_at?: string;
}

export interface ApiKeyUsage {
  id: string;
  api_key_id: string;
  method: string;
  endpoint: string;
  response_status?: number;
  requested_at: string;
  response_time_ms?: number;
  client_ip?: string;
  user_agent?: string;
}

const API_KEY_PREFIX = "sk_"; // Supabase-like key prefix

// Generate a cryptographically secure API key
function generateSecureApiKey(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);

  // Convert to base64url format (URL-safe base64)
  const base64 = btoa(String.fromCharCode(...array));
  const base64url = base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

  return API_KEY_PREFIX + base64url;
}

// Hash the API key for storage (we'll use SHA-256, which matches our DB function)
async function hashApiKey(apiKey: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(apiKey);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = new ArrayBuffer(hashBuffer.byteLength);
  new Uint8Array(hashArray).set(new Uint8Array(hashBuffer));
  return Array.from(new Uint8Array(hashArray))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export const useApiKeys = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch user's API keys
  const { data: apiKeys = [], isLoading, error } = useQuery({
    queryKey: ["apiKeys"],
    queryFn: async (): Promise<ApiKey[]> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("api_keys")
        .select("*")
        .eq("user_id", user?.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  // Create new API key
  const createApiKeyMutation = useMutation({
    mutationFn: async (params: CreateApiKeyParams): Promise<{ apiKey: string; apiKeyData: ApiKey }> => {
      // Generate secure API key client-side
      const secureApiKey = generateSecureApiKey();
      const hashedKey = await hashApiKey(secureApiKey);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("api_keys")
        .insert({
          user_id: user!.id,
          hashed_key: hashedKey,
          name: params.name,
          description: params.description || null,
          rate_limit_requests: params.rate_limit_requests || 1000,
          rate_limit_window_minutes: params.rate_limit_window_minutes || 60,
          expires_at: params.expires_at ? new Date(params.expires_at).toISOString() : null,
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;

      return {
        apiKey: secureApiKey, // Return the unhashed key to show to user
        apiKeyData: data,
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["apiKeys"] });
    },
  });

  // Update API key
  const updateApiKeyMutation = useMutation({
    mutationFn: async ({
      apiKeyId,
      updates
    }: {
      apiKeyId: string;
      updates: Partial<CreateApiKeyParams & { is_active: boolean }>
    }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("api_keys")
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq("id", apiKeyId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["apiKeys"] });
    },
  });

  // Delete API key
  const deleteApiKeyMutation = useMutation({
    mutationFn: async (apiKeyId: string) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from("api_keys")
        .delete()
        .eq("id", apiKeyId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["apiKeys"] });
    },
  });

  // Get API key usage - renamed to follow React hook naming convention
  const useApiKeyUsage = (apiKeyId: string) => {
    return useQuery({
      queryKey: ["apiKeyUsage", apiKeyId],
      queryFn: async (): Promise<ApiKeyUsage[]> => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase as any)
          .from("api_key_usage")
          .select("*")
          .eq("api_key_id", apiKeyId)
          .order("requested_at", { ascending: false })
          .limit(100);

        if (error) throw error;
        return data || [];
      },
      enabled: !!apiKeyId,
    });
  };

  return {
    apiKeys,
    isLoading,
    error,
    createApiKey: createApiKeyMutation.mutateAsync,
    updateApiKey: updateApiKeyMutation.mutateAsync,
    deleteApiKey: deleteApiKeyMutation.mutateAsync,
    isCreating: createApiKeyMutation.isPending,
    isUpdating: updateApiKeyMutation.isPending,
    isDeleting: deleteApiKeyMutation.isPending,
    useApiKeyUsage,
  };
};
