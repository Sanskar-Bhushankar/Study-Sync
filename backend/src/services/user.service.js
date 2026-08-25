const { supabase } = require('../config/supabase');
const { NotFoundError } = require('../utils/errors');

async function getProfile(userId) {
  const { data, error } = await supabase.from('profiles').select('id, email, full_name, avatar_url, created_at').eq('id', userId);
  if (error) throw error;
  if (!data || data.length === 0) throw new NotFoundError('Profile not found');
  return data[0];
}

async function updateProfile(userId, updates) {
  const allowed = {};
  if (updates.full_name !== undefined) allowed.full_name = updates.full_name;
  if (updates.avatar_url !== undefined) allowed.avatar_url = updates.avatar_url;
  if (Object.keys(allowed).length === 0) return getProfile(userId);
  const { data, error } = await supabase.from('profiles').update(allowed).eq('id', userId).select();
  if (error) throw error;
  return data[0];
}

async function getPendingInvites(email) {
  const { data, error } = await supabase
    .from('project_invites')
    .select('id, project_id, invited_by, invited_email, created_at, projects(title)')
    .eq('invited_email', email)
    .eq('status', 'pending');
  if (error) throw error;
  return data || [];
}

/**
 * Get user's personal activity across all projects for profile page.
 * Returns: { heatmap: { [dateStr]: count }, completed: [...], byDate: { [dateStr]: [...] } }
 */
async function getProfileActivity(userId) {
  // 1. Subtopic completions
  const { data: subRows, error: subErr } = await supabase
    .from('subtopic_progress')
    .select('completed_at, subtopic_id, project_id')
    .eq('user_id', userId)
    .eq('is_completed', true)
    .not('completed_at', 'is', null);
  if (subErr) throw subErr;

  // 2. Topic completions (notes uploaded)
  const { data: topicRows, error: topicErr } = await supabase
    .from('topic_completions')
    .select('uploaded_at, topic_id, project_id')
    .eq('user_id', userId);
  if (topicErr) throw topicErr;

  // 3. Revisions
  const { data: revisionRows } = await supabase
    .from('topic_revisions')
    .select('revised_at, topic_id, project_id')
    .eq('user_id', userId);

  const subIds = [...new Set((subRows || []).map((r) => r.subtopic_id))];
  const topicIdsFromSubs = [];
  const topicIdsFromCompletions = [...new Set((topicRows || []).map((r) => r.topic_id))];
  const topicIdsFromRevisions = [...new Set((revisionRows || []).map((r) => r.topic_id))];
  const projectIds = [...new Set([
    ...(subRows || []).map((r) => r.project_id),
    ...(topicRows || []).map((r) => r.project_id),
    ...(revisionRows || []).map((r) => r.project_id),
  ])];

  let subtopicMeta = {};
  let topicMeta = {};
  let projectMeta = {};

  let subs = [];
  if (subIds.length > 0) {
    const r = await supabase.from('subtopics').select('id, title, topic_id').in('id', subIds);
    subs = r.data || [];
    subs.forEach((s) => { topicIdsFromSubs.push(s.topic_id); });
  }
  const allTopicIds = [...new Set([...topicIdsFromSubs, ...topicIdsFromCompletions, ...topicIdsFromRevisions])];
  if (allTopicIds.length > 0) {
    const { data: topics } = await supabase.from('topics').select('id, title, project_id').in('id', allTopicIds);
    (topics || []).forEach((t) => { topicMeta[t.id] = t.title; });
  }
  subs.forEach((s) => {
    subtopicMeta[s.id] = { title: s.title, topicTitle: topicMeta[s.topic_id] };
  });
  if (projectIds.length > 0) {
    const { data: projs } = await supabase.from('projects').select('id, title').in('id', projectIds);
    projectMeta = Object.fromEntries((projs || []).map((p) => [p.id, p.title]));
  }

  const completed = [];
  const heatmap = {};
  const byDate = {};

  function add(dateStr, item) {
    heatmap[dateStr] = (heatmap[dateStr] || 0) + 1;
    completed.push({ ...item, date: dateStr });
    if (!byDate[dateStr]) byDate[dateStr] = [];
    byDate[dateStr].push(item);
  }

  for (const r of subRows || []) {
    const d = r.completed_at ? r.completed_at.slice(0, 10) : null;
    if (!d) continue;
    const meta = subtopicMeta[r.subtopic_id];
    const topicTitle = meta?.topicTitle;
    const projTitle = projectMeta[r.project_id] || 'Unknown';
    add(d, { type: 'subtopic', project: projTitle, topic: topicTitle, subtopic: meta?.title, raw: r.completed_at });
  }
  for (const r of topicRows || []) {
    const d = r.uploaded_at ? r.uploaded_at.slice(0, 10) : null;
    if (!d) continue;
    const projTitle = projectMeta[r.project_id] || 'Unknown';
    const topicTitle = topicMeta[r.topic_id] || 'Unknown';
    add(d, { type: 'topic', project: projTitle, topic: topicTitle, subtopic: null, raw: r.uploaded_at });
  }
  for (const r of revisionRows || []) {
    const d = r.revised_at ? r.revised_at.slice(0, 10) : null;
    if (!d) continue;
    const projTitle = projectMeta[r.project_id] || 'Unknown';
    const topicTitle = topicMeta[r.topic_id] || 'Unknown';
    add(d, { type: 'revision', project: projTitle, topic: topicTitle, subtopic: null, raw: r.revised_at });
  }

  completed.sort((a, b) => (b.raw || '').localeCompare(a.raw || ''));

  const nextUp = await getNextUp(userId);
  const currentStreak = computeStreak(heatmap);

  // Update highest_streak if current exceeds stored value
  const { data: prof } = await supabase.from('profiles').select('highest_streak').eq('id', userId).single();
  const highestStreak = Math.max(currentStreak, prof?.highest_streak || 0);
  if (currentStreak > (prof?.highest_streak || 0)) {
    await supabase.from('profiles').update({ highest_streak: currentStreak }).eq('id', userId);
  }

  const recentTopicCompletion = getRecentTopicCompletion(userId, completed);

  // Weekly summary — no extra DB queries needed
  const todayStr = new Date().toISOString().slice(0, 10);
  const dow = new Date().getUTCDay();
  const weekStartDate = new Date(Date.now() - dow * 86400000);
  const weekStartStr = weekStartDate.toISOString().slice(0, 10);
  const thisWeekItems = completed.filter((c) => c.date >= weekStartStr && c.date <= todayStr);
  const weekly_summary = {
    week_start: weekStartStr,
    week_end: todayStr,
    subtopics_completed: thisWeekItems.filter((c) => c.type === 'subtopic').length,
    topics_done: thisWeekItems.filter((c) => c.type === 'topic').length,
    revisions: thisWeekItems.filter((c) => c.type === 'revision').length,
    active_days: new Set(thisWeekItems.map((c) => c.date)).size,
  };

  return { heatmap, completed, byDate, nextUp, streak: currentStreak, highest_streak: highestStreak, recentTopicCompletion, weekly_summary };
}

/**
 * Compute consecutive activity days. Streak is 0 if last activity was more than
 * 2 days ago (1 forgiveness gap allowed). Counts back from most recent active date.
 */
function computeStreak(heatmap) {
  if (!heatmap || Object.keys(heatmap).length === 0) return 0;
  const dates = Object.keys(heatmap).filter((d) => (heatmap[d] || 0) > 0);
  if (dates.length === 0) return 0;
  const mostRecent = dates.sort().reverse()[0];

  // Allow 1 forgiveness gap day: streak breaks only if last activity > 2 days ago
  const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10);
  if (mostRecent < twoDaysAgo) return 0;

  let streak = 0;
  let gapAllowed = 1;
  let d = new Date(mostRecent + 'T12:00:00Z');
  for (let i = 0; i < 365; i++) {
    const dateStr = d.toISOString().slice(0, 10);
    if ((heatmap[dateStr] || 0) > 0) {
      streak++;
      gapAllowed = 1; // reset forgiveness after an active day
    } else if (gapAllowed > 0) {
      gapAllowed--; // use up forgiveness day, no streak increment
    } else {
      break;
    }
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return streak;
}

/**
 * Get "next up" nudge: the topic closest to completion (most subtopics done, fewest remaining).
 * Returns { project, projectId, topic, topicId, remaining, done, total } or null.
 */
async function getNextUp(userId) {
  const projectService = require('./project.service');
  const topicService = require('./topic.service');
  const projects = await projectService.listByUser(userId);
  if (!projects?.length) return null;

  let best = null;

  for (const proj of projects) {
    const topics = await topicService.listByProject(proj.id);
    const { data: progressRows } = await supabase
      .from('subtopic_progress')
      .select('subtopic_id, is_completed')
      .eq('user_id', userId)
      .eq('project_id', proj.id)
      .eq('is_completed', true);

    const completedSubIds = new Set((progressRows || []).map((r) => r.subtopic_id));

    for (const topic of topics || []) {
      const subs = topic.subtopics || [];
      const total = subs.length;
      const done = subs.filter((s) => completedSubIds.has(s.id)).length;
      if (done > 0 && done < total) {
        const remaining = total - done;
        if (!best || remaining < best.remaining) {
          best = { project: proj.title, projectId: proj.id, topic: topic.title, topicId: topic.id, remaining, done, total };
        }
      }
    }
  }
  return best;
}

/**
 * Get most recent full-topic completion for appreciation. Returns { project, topic, date } from
 * the most recent topic completion (notes uploaded). Used when no nextUp in progress.
 */
function getRecentTopicCompletion(userId, completed) {
  const topicCompletions = (completed || []).filter((c) => c.type === 'topic');
  if (topicCompletions.length === 0) return null;
  return {
    project: topicCompletions[0].project,
    topic: topicCompletions[0].topic,
    date: topicCompletions[0].date,
  };
}

/**
 * Lightweight stats for navbar. Returns activityDates for client-side streak (timezone-safe).
 * Also includes revisions so they count toward streak.
 */
async function getStats(userId) {
  const dates = new Set();
  const { data: subRows } = await supabase
    .from('subtopic_progress')
    .select('completed_at')
    .eq('user_id', userId)
    .eq('is_completed', true)
    .not('completed_at', 'is', null);
  (subRows || []).forEach((r) => r.completed_at && dates.add(r.completed_at.slice(0, 10)));

  const { data: topicRows } = await supabase
    .from('topic_completions')
    .select('uploaded_at')
    .eq('user_id', userId);
  (topicRows || []).forEach((r) => r.uploaded_at && dates.add(r.uploaded_at.slice(0, 10)));

  const { data: revisionRows } = await supabase
    .from('topic_revisions')
    .select('revised_at')
    .eq('user_id', userId);
  (revisionRows || []).forEach((r) => r.revised_at && dates.add(r.revised_at.slice(0, 10)));

  const activityDates = [...dates];
  const heatmap = {};
  activityDates.forEach((d) => { heatmap[d] = 1; });
  const currentStreak = computeStreak(heatmap);

  // Update highest_streak if current exceeds stored value
  const { data: prof } = await supabase.from('profiles').select('highest_streak').eq('id', userId).single();
  const highestStreak = Math.max(currentStreak, prof?.highest_streak || 0);
  if (currentStreak > (prof?.highest_streak || 0)) {
    await supabase.from('profiles').update({ highest_streak: currentStreak }).eq('id', userId);
  }

  return { streak: currentStreak, highest_streak: highestStreak, activityDates };
}

module.exports = { getProfile, updateProfile, getPendingInvites, getProfileActivity, getStats };
