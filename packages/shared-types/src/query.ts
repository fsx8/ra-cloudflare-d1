export type SortOrder = "ASC" | "DESC";
export type SimpleRestSort = [string, SortOrder];
export type SimpleRestRange = [number, number];

export type SimpleRestFilter =
  | Record<string, unknown>
  | {
      q?: string;
      id?: Array<string | number>;
      _includeDeleted?: boolean;
      [key: string]: unknown;
    };

export interface ListQuery {
  sort?: string; // JSON encoded SimpleRestSort
  range?: string; // JSON encoded SimpleRestRange
  filter?: string; // JSON encoded SimpleRestFilter
}

export type FilterOperator =
  "gt" | "gte" | "lt" | "lte" | "contains" | "startsWith" | "endsWith";

export interface ParsedListQuery {
  sort: SimpleRestSort;
  range: SimpleRestRange;
  filter: SimpleRestFilter;
}
