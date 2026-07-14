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

export interface D1RestConfig {
  resources: Record<string, ResourceConfig>;
  apiKey: string;
  corsOrigins: string[] | "*";
  basePath?: string;
  enableSchemaEndpoint?: boolean;
  maxPerPage?: number;
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
