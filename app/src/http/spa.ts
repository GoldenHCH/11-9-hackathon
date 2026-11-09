import fs from 'node:fs';
import path from 'node:path';
import { appConfig } from '../config';

export function spaIndexPath(): string {
  return path.join(appConfig.publicDir, 'index.html');
}

export function hasSpaBuild(): boolean {
  return fs.existsSync(spaIndexPath());
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => `&#${character.charCodeAt(0)};`);
}

export function placeholderPage(): string {
  const version = escapeHtml(appConfig.appVersion);

  return [
    '<!doctype html>',
    '<html lang="en">',
    '<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>KubeQuest</title></head>',
    '<body style="font-family: system-ui, sans-serif; max-width: 40rem; margin: 2rem auto; padding: 0 1rem;">',
    '<h1>KubeQuest</h1>',
    `<p>API version <strong>${version}</strong>. The game UI is on its way.</p>`,
    '<p>Tools: <a href="/api/tools">/api/tools</a> &middot; Health: <a href="/readyz">/readyz</a></p>',
    '</body>',
    '</html>',
  ].join('');
}

export function landingIndexPath(): string {
  return path.join(appConfig.publicDir, 'landing', 'index.html');
}

export function hasLandingBuild(): boolean {
  return fs.existsSync(landingIndexPath());
}
