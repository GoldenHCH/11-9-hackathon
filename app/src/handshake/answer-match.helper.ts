const LEADING_ARTICLE = /^(?:a|an|the)\s+/;
const FUZZY_SHARE = 0.2;
const TOKEN_OVERLAP_MIN = 0.6;
const FUZZY_TOKEN_MIN_LENGTH = 4;

export function normalizeAnswer(answer: string): string {
  return answer
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(LEADING_ARTICLE, '');
}

export function levenshtein(first: string, second: string): number {
  if (first === second) {
    return 0;
  }

  let previous = Array.from({ length: second.length + 1 }, (_value, index) => index);

  for (let i = 1; i <= first.length; i++) {
    const current = [i];

    for (let j = 1; j <= second.length; j++) {
      const substitution = (previous[j - 1] ?? 0) + (first[i - 1] === second[j - 1] ? 0 : 1);
      current.push(Math.min((previous[j] ?? 0) + 1, (current[j - 1] ?? 0) + 1, substitution));
    }

    previous = current;
  }

  return previous[second.length] ?? Math.max(first.length, second.length);
}

function closeEnough(first: string, second: string): boolean {
  const allowed = Math.max(1, Math.floor(FUZZY_SHARE * Math.max(first.length, second.length)));

  return levenshtein(first, second) <= allowed;
}

function sameToken(first: string, second: string): boolean {
  if (first === second) {
    return true;
  }

  return Math.min(first.length, second.length) >= FUZZY_TOKEN_MIN_LENGTH && levenshtein(first, second) <= 1;
}

function tokenOverlap(firstTokens: string[], secondTokens: string[]): number {
  const first = [...new Set(firstTokens)];
  const second = [...new Set(secondTokens)];
  const shared = first.filter((token) => second.some((other) => sameToken(token, other))).length;

  return shared / Math.max(first.length, second.length);
}

export function answersMatch(heard: string, actual: string): boolean {
  const normalizedHeard = normalizeAnswer(heard);
  const normalizedActual = normalizeAnswer(actual);

  if (normalizedHeard === '' || normalizedActual === '') {
    return false;
  }

  if (normalizedHeard === normalizedActual || closeEnough(normalizedHeard, normalizedActual)) {
    return true;
  }

  const heardTokens = normalizedHeard.split(' ');
  const actualTokens = normalizedActual.split(' ');

  if (heardTokens.length < 2 && actualTokens.length < 2) {
    return false;
  }

  return tokenOverlap(heardTokens, actualTokens) >= TOKEN_OVERLAP_MIN;
}
