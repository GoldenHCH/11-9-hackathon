import { Request, Response, Router } from 'express';
import { logger } from '../observability/logger';
import { finishGithubVerify, githubStateCookie, startGithubVerify } from '../profile/github-oauth';
import { isToolError } from '../tools/tool-errors';

const cookiePath = '/auth/github';

function cookieValue(request: Request, name: string): string {
  const header = request.get('cookie') ?? '';
  const match = header.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));

  return match ? decodeURIComponent(match.slice(name.length + 1)) : '';
}

function queryString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function backToProfile(response: Response, outcome: string): void {
  response.clearCookie(githubStateCookie, { path: cookiePath });
  response.redirect(302, `/profile?github=${outcome}`);
}

export function authRoutes(): Router {
  const router = Router();

  router.get('/auth/github/start', async (request, response) => {
    try {
      const { redirectUrl, nonce, maxAgeMs } = await startGithubVerify(queryString(request.query.attendeeId));
      response.cookie(githubStateCookie, nonce, { httpOnly: true, secure: request.secure, sameSite: 'lax', path: cookiePath, maxAge: maxAgeMs });
      response.redirect(302, redirectUrl);
    } catch (error) {
      logger.warn({ err: error }, 'github verify start failed');
      backToProfile(response, isToolError(error) && error.status === 404 ? 'off' : 'failed');
    }
  });

  router.get('/auth/github/callback', async (request, response) => {
    const code = queryString(request.query.code);
    const state = queryString(request.query.state);

    if (code === '' || state === '') {
      backToProfile(response, 'cancelled');
      return;
    }

    try {
      await finishGithubVerify(code, state, cookieValue(request, githubStateCookie));
      backToProfile(response, 'verified');
    } catch (error) {
      logger.warn({ err: error }, 'github verify callback failed');
      backToProfile(response, 'failed');
    }
  });

  return router;
}
