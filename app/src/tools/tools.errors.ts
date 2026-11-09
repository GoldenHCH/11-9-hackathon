export class ToolInputError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'ToolInputError';
  }
}

export class ToolForbiddenError extends Error {
  public readonly reason: string;

  public constructor(message: string, reason: string) {
    super(message);
    this.name = 'ToolForbiddenError';
    this.reason = reason;
  }
}

export class UnknownToolError extends Error {
  public constructor(toolName: string) {
    super(`There is no tool called "${toolName}".`);
    this.name = 'UnknownToolError';
  }
}
