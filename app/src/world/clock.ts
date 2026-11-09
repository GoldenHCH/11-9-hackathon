let offsetMs: number | undefined;

function demoOffsetMs(): number {
  if (offsetMs !== undefined) {
    return offsetMs;
  }

  const demoNow = process.env.DEMO_NOW;
  const parsed = demoNow ? Date.parse(demoNow) : Number.NaN;
  offsetMs = Number.isNaN(parsed) ? 0 : parsed - Date.now();

  return offsetMs;
}

export function worldNow(): Date {
  return new Date(Date.now() + demoOffsetMs());
}
