export interface ResourceFieldTransformConfig {
  booleans?: string[];
  dates?: string[];
  json?: string[];
}

export interface SoftDeleteConfig {
  field: string;
  type: "timestamp" | "boolean";
}

export interface ResourceConfig {
  tableName: string;
  idField: string;
  selectableFields: string[];
  sortableFields: string[];
  filterableFields: string[];
  searchableFields: string[];
  softDelete?: SoftDeleteConfig;
  transforms?: ResourceFieldTransformConfig;
}

export interface RateLimitBinding {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

export interface RateLimitConfig {
  binding: RateLimitBinding;
  key?: (request: Request) => string;
}

export interface RestWorkerConfig {
  resources: Record<string, ResourceConfig>;
  /**
   * Bearer token checked against the request's `Authorization` header.
   * Required when `requireApiKey` is not `false` (the default); ignored when
   * `requireApiKey: false`.
   */
  apiKey?: string;
  /**
   * Defaults to `true` (bearer-token auth enforced). Set to `false` to skip
   * application-level auth entirely — only safe when the worker is fronted by
   * a trusted authenticating proxy (Cloudflare Access, an API gateway, etc.).
   */
  requireApiKey?: boolean;
  corsOrigins: string[] | "*";
  basePath?: string;
  enableSchemaEndpoint?: boolean;
  maxPerPage?: number;
  rateLimit?: RateLimitConfig;
}

export interface SchemaFieldInfo {
  name: string;
  type: string;
  nullable: boolean;
  primaryKey: boolean;
  defaultValue?: string | null;
  transform?: "boolean" | "date" | "json";
}

export interface SchemaResourceInfo {
  fields: SchemaFieldInfo[];
  filterable: string[];
  sortable: string[];
  searchable: string[];
}

export interface SchemaResponse {
  resources: Record<string, SchemaResourceInfo>;
}
