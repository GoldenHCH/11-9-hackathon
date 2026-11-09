import { readFileSync } from 'node:fs';
import path from 'node:path';
import { closeEsClient } from '../app/src/es/client';
import { ensureIndices } from '../app/src/es/indices';
import { patchAttendee } from '../app/src/profile/attendees';
import { publicIdFor } from '../app/src/profile/public-id';
import { signInTool } from '../app/src/tools/sign-in.tool';
import { signUpTool } from '../app/src/tools/sign-up.tool';
import { IGeoPoint } from '../app/src/types/kubequest.interfaces';

const demoAccount = { name: 'John Doe', email: 'johndoe@gmail.com' } as const;
const demoLocationId = 'campfire-community-hub';

const demoProfile = {
  workingOn: 'Running an internal developer platform with Argo CD and GitOps: golden paths, multi-cluster rollouts and progressive delivery',
  firstKubeCon: false,
  happyToWelcome: true,
  topics: ['platform engineering', 'gitops', 'argo cd', 'developer experience', 'observability'],
  meetingOn: true,
  spotMe: 'Grey KubeQuest hoodie, near the Community Hub',
} as const;

interface ILocationRecord {
  id: string;
  geo?: IGeoPoint;
}

function demoLocation(): ILocationRecord & { geo: IGeoPoint } {
  const raw: unknown = JSON.parse(readFileSync(path.resolve(__dirname, '..', 'resources', 'locations.json'), 'utf8'));
  const list = (Array.isArray(raw) ? raw : (raw as { locations?: unknown[] }).locations ?? []) as ILocationRecord[];
  const location = list.find((entry) => entry.id === demoLocationId);

  if (!location?.geo) {
    throw new Error(`Location ${demoLocationId} with geo not found in resources/locations.json`);
  }

  return { id: location.id, geo: location.geo };
}

async function main(): Promise<void> {
  const synced = await ensureIndices();
  const failed = synced.filter((result) => result.action === 'failed');

  if (failed.length > 0) {
    throw new Error(`Index sync failed: ${failed.map((result) => `${result.index} (${result.error ?? 'unknown'})`).join(', ')}`);
  }

  const signedIn = await signInTool.execute(demoAccount);
  const attendeeId = signedIn.attendee.attendee.id;
  const location = demoLocation();

  await patchAttendee(attendeeId, { lastLocationId: location.id, lastLocation: location.geo, lastSeenAt: new Date().toISOString(), visible: true });

  const onboarded = await signUpTool.execute({ attendeeId, ...demoProfile, topics: [...demoProfile.topics] });
  const again = await signInTool.execute(demoAccount);

  process.stdout.write(
    `${JSON.stringify(
      {
        handle: onboarded.profile.attendee.handle,
        publicId: publicIdFor(attendeeId),
        createdNow: signedIn.isNew,
        sameIdOnSignIn: again.attendee.attendee.id === attendeeId,
        needsOnboarding: again.needsOnboarding,
        lastLocationId: onboarded.profile.attendee.lastLocationId,
        topics: onboarded.profile.attendee.profile.topics,
        personalLink: onboarded.personalLink,
      },
      null,
      2,
    )}\n`,
  );
}

main()
  .catch((error: unknown) => {
    process.stderr.write(`seed-demo-login failed: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  })
  .finally(() => closeEsClient());
