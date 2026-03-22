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

  const subIds = [...new Set((subRows || []).map((r) => r.subtopic_id))];
  const topicIdsFromSubs = [];
  const topicIdsFromCompletions = [...new Set((topicRows || []).map((r) => r.topic_id))];
  const projectIds = [...new Set([...(subRows || []).map((r) => r.project_id), ...(topicRows || []).map((r) => r.project_id)])];

  let subtopicMeta = {};
  let topicMeta = {};
  let projectMeta = {};

  let subs = [];
  if (subIds.length > 0) {
    const r = await supabase.from('subtopics').select('id, title, topic_id').in('id', subIds);
    subs = r.data || [];
    subs.forEach((s) => { topicIdsFromSubs.push(s.topic_id); });
  }
  const allTopicIds = [...new Set([...topicIdsFromSubs, ...topicIdsFromCompletions])];
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

  completed.sort((a, b) => (b.raw || '').localeCompare(a.raw || ''));

  const nextUp = await getNextUp(userId);
  const streak = computeStreak(heatmap);
  const recentTopicCompletion = getRecentTopicCompletion(userId, completed);

  return { heatmap, completed, byDate, nextUp, streak, recentTopicCompletion };
}

/**
 * Compute consecutive activity days. Uses the most recent activity date as the "end"
 * (avoids UTC vs local timezone mismatch). Streak = consecutive days from max activity date backwards.
 */
function computeStreak(heatmap) {
  if (!heatmap || Object.keys(heatmap).length === 0) return 0;
  const dates = Object.keys(heatmap).filter((d) => (heatmap[d] || 0) > 0);
  if (dates.length === 0) return 0;
  const mostRecent = dates.sort().reverse()[0];
  let streak = 0;
  let d = new Date(mostRecent + 'T12:00:00Z'); // noon UTC to avoid DST edge cases
  for (let i = 0; i < 365; i++) {
    const dateStr = d.toISOString().slice(0, 10);
    if ((heatmap[dateStr] || 0) > 0) streak++;
    else break;
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

  const activityDates = [...dates];
  const heatmap = {};
  activityDates.forEach((d) => { heatmap[d] = 1; });
  return { streak: computeStreak(heatmap), activityDates };
}

module.exports = { getProfile, updateProfile, getPendingInvites, getProfileActivity, getStats };
