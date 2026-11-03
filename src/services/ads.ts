// Ad seam. The app registers a host (a simulated ad screen for now); a real SDK replaces it later.
import { track } from './analytics';

type Host = (placement: string) => Promise<boolean>;
let host: Host | null = null;

export function registerAdHost(h: Host | null) {
  host = h;
}

/** Shows a rewarded ad. Resolves true if the player earned the reward. */
export async function showRewarded(placement: string): Promise<boolean> {
  track('rewarded_ad_offer_shown', { placement });
  const ok = host ? await host(placement) : true;
  if (ok) track('rewarded_ad_completed', { placement });
  return ok;
}
