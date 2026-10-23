const key = (roomId: string) => `host-token:${roomId}`;

export function getHostToken(roomId: string): string | null {
  try {
    return localStorage.getItem(key(roomId));
  } catch {
    return null;
  }
}

export function saveHostToken(roomId: string, token: string): boolean {
  try {
    localStorage.setItem(key(roomId), token);
    return true;
  } catch {
    return false;
  }
}

export function clearHostToken(roomId: string): void {
  try {
    localStorage.removeItem(key(roomId));
  } catch {
    // Storage may be unavailable; nothing else to clean up.
  }
}
