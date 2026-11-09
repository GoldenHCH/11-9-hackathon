export interface IBulkDocument {
  id: string;
  body: object;
}

export interface IBulkResult {
  indexed: number;
  failed: number;
  firstError?: string;
}
