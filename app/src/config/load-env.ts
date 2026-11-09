import * as fs from 'node:fs';
import * as path from 'node:path';
import { ConfigHelper } from './config.helper';

const envFilePath = path.join(ConfigHelper.repoRoot(), '.env');

if (fs.existsSync(envFilePath)) {
  process.loadEnvFile(envFilePath);
}
