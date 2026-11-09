import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

function findRepositoryRoot(startDirectory: string): string {
  let current = startDirectory;
  while (!existsSync(resolve(current, 'AGENTS.md'))) {
    const parent = dirname(current);
    if (parent === current) {
      return startDirectory;
    }
    current = parent;
  }

  return current;
}

const repositoryRoot = findRepositoryRoot(process.cwd());

export function resourcePath(...segments: string[]): string {
  return resolve(repositoryRoot, 'resources', ...segments);
}

export function scriptDataPath(...segments: string[]): string {
  return resolve(repositoryRoot, 'scripts', 'data', ...segments);
}

export function readJsonFile<T>(absolutePath: string): T {
  return JSON.parse(readFileSync(absolutePath, 'utf8')) as T;
}

export function writeJsonFile(absolutePath: string, value: unknown): void {
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}
