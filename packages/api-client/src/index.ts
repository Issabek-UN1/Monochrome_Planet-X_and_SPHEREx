import type { components } from "./schema";

export type Observation = components["schemas"]["Observation"];
export type SkySearch = components["schemas"]["SkySearch"];
export type SearchResult = components["schemas"]["SearchResult"];
export type JobRequest = components["schemas"]["JobRequest"];
export type Job = components["schemas"]["Job"];
export type Artifact = components["schemas"]["Artifact"];
export type Capabilities = components["schemas"]["Capabilities"];

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
    public readonly requestId?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Pass the backend origin, e.g. http://localhost:8000. No runtime dependencies. */
export function createSpherexClient(baseUrl: string) {
  const base = baseUrl.replace(/\/+$/, "");

  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(base + path, init);
    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      throw new ApiError(
        payload?.error?.message ?? `API request failed (${response.status})`,
        response.status,
        payload?.error?.code,
        payload?.error?.request_id ?? response.headers.get("X-Request-ID") ?? undefined,
      );
    }
    return response.json() as Promise<T>;
  }

  return {
    capabilities(signal?: AbortSignal): Promise<Capabilities> {
      return request("/api/v1/capabilities", { signal });
    },
    search(query: SkySearch, signal?: AbortSignal): Promise<SearchResult> {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined && value !== null) params.set(key, String(value));
      }
      return request(`/api/v1/observations?${params}`, { signal });
    },
    getObservation(id: string, signal?: AbortSignal): Promise<Observation> {
      return request(`/api/v1/observations/${encodeURIComponent(id)}`, { signal });
    },
    createJob(body: JobRequest, signal?: AbortSignal): Promise<Job> {
      return request("/api/v1/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal,
      });
    },
    getJob(id: string, signal?: AbortSignal): Promise<Job> {
      return request(`/api/v1/jobs/${encodeURIComponent(id)}`, { signal });
    },
    /** Artifact URLs are relative to the backend; do not resolve against the frontend. */
    artifactUrl(artifact: Artifact): string {
      return base + artifact.url;
    },
  };
}
