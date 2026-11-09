import * as path from 'node:path';
import { configDefaults } from './config.constants';
import type { IAppConfig } from './config.interfaces';

export class ConfigHelper {
  public static repoRoot(): string {
    return path.resolve(__dirname, '..', '..', '..');
  }

  public static fromEnv(env: NodeJS.ProcessEnv): IAppConfig {
    const repoRoot = ConfigHelper.repoRoot();
    const parsedPort = Number(env.PORT);

    return {
      port: Number.isInteger(parsedPort) && parsedPort > 0 ? parsedPort : configDefaults.PORT,
      version: ConfigHelper.nonEmpty(env.APP_VERSION) ?? configDefaults.VERSION,
      seedNow: ConfigHelper.nonEmpty(env.SEED_NOW),
      elastic: {
        url: ConfigHelper.nonEmpty(env.ELASTIC_URL),
        apiKey: ConfigHelper.nonEmpty(env.ELASTIC_API_KEY),
        inferenceId: ConfigHelper.nonEmpty(env.ELASTIC_INFERENCE_ID) ?? configDefaults.INFERENCE_ID,
        requestTimeoutMs: configDefaults.REQUEST_TIMEOUT_MS,
      },
      resourcesDir: ConfigHelper.nonEmpty(env.RESOURCES_DIR) ?? path.join(repoRoot, 'resources'),
      publicDir: path.join(repoRoot, 'app', 'public'),
      webDistDirs: [path.join(repoRoot, 'web', 'dist', 'browser'), path.join(repoRoot, 'web', 'dist', 'web', 'browser')],
    };
  }

  public static nonEmpty(value: string | undefined): string | undefined {
    const trimmed = value?.trim();

    return trimmed ? trimmed : undefined;
  }
}
