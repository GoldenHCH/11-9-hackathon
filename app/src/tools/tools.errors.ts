export class ToolInputError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'ToolInputError';
  }
}

export class UnknownToolError extends Error {
  public constructor(toolName: string) {
    super(`There is no tool called "${toolName}".`);
    this.name = 'UnknownToolError';
  }
}
