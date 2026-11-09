const handshakePathPattern = /\/h\/([A-Za-z0-9._~-]+)/;

export class HandshakeHelper {
  public static tokenFromLink(link: string): string | null {
    const trimmed = link.trim();

    if (!trimmed) {
      return null;
    }

    const pathMatch = handshakePathPattern.exec(trimmed);

    if (pathMatch) {
      return decodeURIComponent(pathMatch[1]);
    }

    return trimmed.startsWith('h.') ? trimmed : null;
  }
}
