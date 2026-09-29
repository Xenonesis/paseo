export interface OllamaModelTag {
  name: string;
  modified_at?: string;
  size?: number;
  digest?: string;
  details?: {
    format?: string;
    family?: string;
    families?: string[];
    parameter_size?: string;
    quantization_level?: string;
  };
}

export interface OllamaTagsResponse {
  models?: OllamaModelTag[];
}

export interface DiscoveredLocalModel {
  id: string;
  label: string;
  description: string;
  provider: "ollama";
  parameterSize?: string;
  family?: string;
}

/**
 * Probes the local Ollama instance (default: http://127.0.0.1:11434/api/tags)
 * and returns available local models with strict timeout.
 */
export async function discoverOllamaModels(
  endpoint = "http://127.0.0.1:11434",
  timeoutMs = 1500,
): Promise<DiscoveredLocalModel[]> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(`${endpoint.replace(/\/$/, "")}/api/tags`, {
      method: "GET",
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    clearTimeout(timer);

    if (!res.ok) {
      return [];
    }

    const data = (await res.json()) as OllamaTagsResponse;
    const models = Array.isArray(data?.models) ? data.models : [];

    return models.map((m) => {
      const paramSize = m.details?.parameter_size ? ` (${m.details.parameter_size})` : "";
      return {
        id: `ollama/${m.name}`,
        label: `${m.name}${paramSize}`,
        description: `Local Ollama model: ${m.name}`,
        provider: "ollama" as const,
        parameterSize: m.details?.parameter_size,
        family: m.details?.family,
      };
    });
  } catch {
    // If Ollama is not installed or not running, gracefully return empty
    return [];
  }
}
