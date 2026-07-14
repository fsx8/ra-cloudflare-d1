export interface CloudflareClientOptions {
  accountId: string;
  apiToken: string;
}

interface CloudflareApiResponse<T = unknown> {
  success?: boolean;
  errors?: Array<{ message?: string }>;
  result?: T;
}

const CF_API = "https://api.cloudflare.com/client/v4";

export class CloudflareApiClient {
  readonly accountId: string;
  readonly apiToken: string;

  constructor(opts: CloudflareClientOptions) {
    this.accountId = opts.accountId;
    this.apiToken = opts.apiToken;
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${CF_API}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.apiToken}`,
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
    const json = (await res
      .json()
      .catch(() => null)) as CloudflareApiResponse<T> | null;
    if (!res.ok || json?.success === false) {
      const message =
        json?.errors?.[0]?.message ??
        res.statusText ??
        "Cloudflare API request failed";
      throw new Error(message);
    }
    return (json?.result ?? json) as T;
  }

  async queryD1<T = unknown>(
    databaseId: string,
    sql: string,
    params?: unknown[],
  ): Promise<T[]> {
    const result = await this.request<{ results?: T[] }[]>(
      `/accounts/${this.accountId}/d1/database/${databaseId}/query`,
      { method: "POST", body: JSON.stringify({ sql, params }) },
    );
    return result?.[0]?.results ?? [];
  }
}
