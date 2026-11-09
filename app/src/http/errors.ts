import { Response } from 'express';
import { logger } from '../observability/logger';
import { isToolError } from '../tools/tool-errors';
import { IApiError } from '../types/kubequest.interfaces';

export function sendError(response: Response, status: number, code: string, message: string, details?: unknown): void {
  const body: IApiError = { error: { code, message, ...(details === undefined ? {} : { details }) } };
  response.status(status).json(body);
}

export function sendToolFailure(response: Response, error: unknown): void {
  if (isToolError(error)) {
    sendError(response, error.status, error.code, error.message, error.details);

    return;
  }

  logger.error({ err: error }, 'tool failed');
  sendError(response, 500, 'internal_error', 'Something went wrong on our side. Try again in a moment.');
}
