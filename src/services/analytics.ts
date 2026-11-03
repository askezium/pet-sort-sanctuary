// Analytics seam. Events are logged locally; swap `sink` for a real SDK (Firebase, GameAnalytics...) later.
export type EventName =
  | 'tutorial_start' | 'tutorial_step_complete' | 'tutorial_complete' | 'first_level_complete' | 'first_session_end'
  | 'level_start' | 'level_complete' | 'level_fail' | 'level_retry' | 'level_quit' | 'moves_used'
  | 'booster_used' | 'hint_used' | 'undo_used' | 'rewarded_ad_offer_shown' | 'rewarded_ad_completed'
  | 'sanctuary_visit' | 'habitat_unlocked' | 'habitat_upgraded' | 'pet_collected' | 'egg_opened'
  | 'duplicate_pet_received' | 'decoration_placed' | 'daily_task_claimed' | 'daily_reward_claimed'
  | 'currency_earned' | 'currency_spent' | 'iap_offer_shown' | 'iap_purchase_started' | 'iap_purchase_completed';

export interface AnalyticsEvent {
  name: EventName;
  props: Record<string, string | number | boolean>;
  t: number;
}

const buffer: AnalyticsEvent[] = [];
let sink: ((e: AnalyticsEvent) => void) | null = null;

export function setAnalyticsSink(fn: ((e: AnalyticsEvent) => void) | null) {
  sink = fn;
}

export function track(name: EventName, props: AnalyticsEvent['props'] = {}) {
  const e = { name, props, t: Date.now() };
  buffer.push(e);
  if (buffer.length > 300) buffer.shift();
  if (__DEV__) console.log('[analytics]', name, JSON.stringify(props));
  sink?.(e);
}

export const recentEvents = () => buffer.slice();
