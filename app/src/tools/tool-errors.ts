export class ToolError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly details?: unknown;

  public constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ToolError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export class NotImplementedError extends ToolError {
  public constructor(feature: string) {
    super(501, 'not_implemented', `${feature} is not built yet.`);
    this.name = 'NotImplementedError';
  }
}

export function isToolError(error: unknown): error is ToolError {
  return error instanceof ToolError;
}
