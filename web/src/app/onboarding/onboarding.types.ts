export type { IImportedProfile, ISignInInput, ISignInResult, ISignUpInput, ISignUpResult } from '../../../../app/src/types/kubequest.interfaces';

export type OnboardingStep = 'signin' | 'import' | 'goals' | 'handle' | 'about' | 'topics' | 'meeting' | 'links' | 'done';

export type ImportMode = 'choose' | 'paste' | 'loading' | 'review';

export type ImportListKey = 'skills' | 'offers' | 'asks';
