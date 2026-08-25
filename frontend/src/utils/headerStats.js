/** Unwrap `/users/me/profile` JSON (`{ success, data }` or plain activity object). */
export function extractActivityPayload(r) {
  if (!r || typeof r !== 'object') return {};
  const inner = r.data !== undefined ? r.data : r;
  if (inner == null || typeof inner !== 'object' || Array.isArray(inner)) return {};
  return inner;
}

/** Match backend `computeStreak` (UTC) with 1 forgiveness gap day. */
export function computeStreakFromDates(activityDates) {
  if (!activityDates?.length) return 0;
  const set = new Set(activityDates);
  const sorted = [...set].sort().reverse();
  const mostRecent = sorted[0];
  const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10);
  if (mostRecent < twoDaysAgo) return 0;
  let streak = 0;
  let gapAllowed = 1;
  const d = new Date(mostRecent + 'T12:00:00Z');
  for (let i = 0; i < 365; i++) {
    const dateStr = d.toISOString().slice(0, 10);
    if (set.has(dateStr)) {
      streak++;
      gapAllowed = 1;
    } else if (gapAllowed > 0) {
      gapAllowed--;
    } else {
      break;
    }
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return streak;
}

export function streakFromPayload(payload) {
  let s = payload.streak;
  if (typeof s === 'string') {
    const n = parseInt(s, 10);
    s = Number.isNaN(n) ? undefined : n;
  }
  if (typeof s === 'number' && !Number.isNaN(s)) return Math.max(0, Math.floor(s));
  if (payload.heatmap && typeof payload.heatmap === 'object' && Object.keys(payload.heatmap).length > 0) {
    const activeDates = Object.keys(payload.heatmap).filter((d) => (payload.heatmap[d] || 0) > 0);
    return computeStreakFromDates(activeDates);
  }
  return 0;
}
