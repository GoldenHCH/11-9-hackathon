export const meetLivePollMs = 3000;

export const meetLiveTickMs = 250;

export const meetLiveWindowSeconds = 30;

export const meetLiveNoticeMs = 4000;

export const meetLiveHiddenRoutePrefixes = ['/screen/', '/onboarding', '/admin', '/exhibitor'] as const;

export const meetLiveVibrationPattern = [120, 80, 120];

export const meetLiveRingRadius = 44;

export const meetLiveChime = {
  FIRST_HZ: 660,
  SECOND_HZ: 880,
  NOTE_SECONDS: 0.16,
  PEAK_GAIN: 0.05,
} as const;

export const meetLiveCopy = {
  SAVED: 'Saved to your notifications',
  LAPSED: "They'll get back to you.",
} as const;
