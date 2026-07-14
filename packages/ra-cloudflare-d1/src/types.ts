import type { DataProvider } from "ra-core";

export interface D1ProviderOptions {
  apiUrl: string;
  apiKey: string;
  httpClient?: typeof fetch;
  useBulkOperations?: boolean;
  transforms?: {
    booleanFields?: Record<string, string[]>;
    dateFields?: Record<string, string[]>;
    jsonFields?: Record<string, string[]>;
  };
}

export type D1DataProvider = DataProvider & { supportAbortSignal?: boolean };
