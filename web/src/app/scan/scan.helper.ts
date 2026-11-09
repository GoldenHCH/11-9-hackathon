export const pendingScanStorageKey = 'kq.pendingScan';

const kubeQuestPathPattern = /^\/(r|h)\/[^/]+\/?$/;

export class ScanHelper {
  public static toInAppPath(rawValue: string): string | null {
    const value = rawValue.trim();
    if (!value) {
      return null;
    }

    let url: URL;
    try {
      url = new URL(value, 'https://kubequest.local');
    } catch {
      return null;
    }

    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      return null;
    }

    if (!kubeQuestPathPattern.test(url.pathname)) {
      return null;
    }

    return `${url.pathname.replace(/\/$/, '')}${url.search}`;
  }
}
