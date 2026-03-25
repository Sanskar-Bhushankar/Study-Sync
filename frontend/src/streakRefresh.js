/** Fired after activity that can change profile streak / heatmap (e.g. subtopic completion). */
export const STREAK_REFRESH_EVENT = 'studysync:streak-refresh';

export function notifyStreakMayHaveChanged() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(STREAK_REFRESH_EVENT));
}
