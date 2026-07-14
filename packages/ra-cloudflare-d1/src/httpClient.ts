import { HttpError } from "ra-core";
import type { ApiErrorResponse } from "@ra-cloudflare-d1/types";

export interface HttpClientOptions {
  apiKey: string;
  fetchImpl?: typeof fetch;
}

export async function httpClient(
  url: string,
  init: RequestInit | undefined,
  options: HttpClientOptions,
): Promise<Response> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const headers = new Headers(init?.headers ?? {});
  headers.set("Authorization", `Bearer ${options.apiKey}`);
  if (!headers.has("Content-Type") && init?.body)
    headers.set("Content-Type", "application/json");

  const res = await fetchImpl(url, { ...init, headers });
  if (res.ok) return res;

  let message = res.statusText || "Request failed";
  let body: unknown = undefined;
  try {
    const parsed = (await res.clone().json()) as ApiErrorResponse;
    if (parsed?.error?.message) message = parsed.error.message;
    body = parsed;
  } catch {
    // ignore
  }
  throw new HttpError(message, res.status, body);
}
