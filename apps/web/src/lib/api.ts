import { healthResponse } from '@app/shared';

export async function isApiHealthy(): Promise<boolean> {
  try {
    const res = await fetch('/api/health');
    if (!res.ok) return false;
    return healthResponse.safeParse(await res.json()).success;
  } catch {
    return false;
  }
}
