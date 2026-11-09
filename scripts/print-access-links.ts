import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { readQrSecret } from '../app/src/config';
import { adminAccessKey, buildAdminUrl, buildStaffUrl, exhibitorAccessKey } from '../app/src/security/tokens';

interface IOutpostRow {
  id: string;
  name: string;
  boothNumber?: string;
  sponsorTier?: string;
}

const locationsFile = path.resolve(__dirname, '..', 'resources', 'locations.json');

function isOutpostRow(value: unknown): value is IOutpostRow {
  return (
    typeof value === 'object' &&
    value !== null &&
    Reflect.get(value, 'kind') === 'outpost' &&
    typeof Reflect.get(value, 'id') === 'string' &&
    typeof Reflect.get(value, 'name') === 'string'
  );
}

function readOutposts(): IOutpostRow[] {
  if (!existsSync(locationsFile)) {
    return [];
  }

  const parsed: unknown = JSON.parse(readFileSync(locationsFile, 'utf8'));

  return Array.isArray(parsed) ? parsed.filter(isOutpostRow) : [];
}

function main(): void {
  if (readQrSecret() === '') {
    process.stderr.write('QR_SECRET is empty. Set it to the same value as the cluster before printing access links.\n');
    process.exitCode = 1;

    return;
  }

  const outposts = readOutposts().sort((left, right) => (left.boothNumber ?? '').localeCompare(right.boothNumber ?? '', 'en', { numeric: true }));

  process.stdout.write(`Organizer\t${buildAdminUrl(adminAccessKey())}\n\n`);
  process.stdout.write(`name\tbooth\ttier\tstaff link\n`);

  for (const outpost of outposts) {
    process.stdout.write(`${outpost.name}\t${outpost.boothNumber ?? ''}\t${outpost.sponsorTier ?? ''}\t${buildStaffUrl(outpost.id, exhibitorAccessKey(outpost.id))}\n`);
  }

  process.stderr.write(`${outposts.length} booths. These links open staff views: share each one only with that booth.\n`);
}

main();
