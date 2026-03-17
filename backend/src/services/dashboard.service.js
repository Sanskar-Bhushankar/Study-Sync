const { supabase } = require('../config/supabase');

async function getDashboard(projectId) {
  // Fire all independent queries in parallel — was 7 sequential round-trips
  const [
    { data: project },
    { data: topics },
    { data: members },
  ] = await Promise.all([
    supabase.from('projects').select('id, title').eq('id', projectId).single(),
    supabase.from('topics').select('id').eq('project_id', projectId),
    supabase.from('project_members').select('user_id').eq('project_id', projectId),
  ]);

  if (!project) return null;

  const topicIds = (topics || []).map((t) => t.id);
  const userIds  = (members || []).map((m) => m.user_id);

  // Second wave — depends on topicIds and userIds from first wave
  const [
    { data: subtopics },
    { data: profiles },
    { data: progress },
    { data: completions },
  ] = await Promise.all([
    topicIds.length
      ? supabase.from('subtopics').select('id, topic_id').in('topic_id', topicIds)
      : Promise.resolve({ data: [] }),
    userIds.length
      ? supabase.from('profiles').select('id, full_name').in('id', userIds)
      : Promise.resolve({ data: [] }),
    supabase.from('subtopic_progress')
      .select('user_id, subtopic_id, completed_at')
      .eq('project_id', projectId)
      .eq('is_completed', true),
    supabase.from('topic_completions')
      .select('user_id, topic_id, uploaded_at')
      .eq('project_id', projectId),
  ]);

  const totalTopics    = topicIds.length;
  const totalSubtopics = (subtopics || []).length;
  const profileMap     = new Map((profiles || []).map((p) => [p.id, p.full_name]));

  const memberStats = userIds.map((uid) => {
    const myProgress    = (progress    || []).filter((p) => p.user_id === uid);
    const myCompletions = (completions || []).filter((c) => c.user_id === uid);

    const subDone = myProgress.length;
    const topDone = myCompletions.length;

    const lastSub = myProgress.sort((a, b) => new Date(b.completed_at) - new Date(a.completed_at))[0];
    const lastTop = myCompletions.sort((a, b) => new Date(b.uploaded_at)  - new Date(a.uploaded_at))[0];
    const lastActivity = [lastSub?.completed_at, lastTop?.uploaded_at].filter(Boolean).sort().pop() || null;

    const pct = totalSubtopics ? (subDone / totalSubtopics) * 100 : 0;
    return {
      user_id: uid,
      full_name: profileMap.get(uid),
      subtopics_completed: subDone,
      subtopics_total: totalSubtopics,
      topics_completed: topDone,
      topics_total: totalTopics,
      completion_percentage: Math.round(pct * 100) / 100,
      last_activity: lastActivity,
    };
  });

  const leaderboard = [...memberStats]
    .sort((a, b) => b.completion_percentage - a.completion_percentage)
    .map((m, i) => ({ rank: i + 1, ...m }));

  // Build timeline
  const byUser = {};
  (progress || []).forEach((p) => {
    const d = p.completed_at?.slice(0, 10);
    if (!d) return;
    if (!byUser[p.user_id]) byUser[p.user_id] = {};
    byUser[p.user_id][d] = (byUser[p.user_id][d] || 0) + 1;
  });
  const timeline = {};
  Object.entries(byUser).forEach(([uid, dates]) => {
    let cum = 0;
    timeline[uid] = Object.entries(dates)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, count]) => { cum += count; return { date, cumulative_subtopics: cum }; });
  });

  return {
    project: { ...project, total_topics: totalTopics, total_subtopics: totalSubtopics },
    members: memberStats,
    leaderboard,
    timeline,
  };
}

async function getSummary(projectId) {
  const full = await getDashboard(projectId);
  if (!full) return null;
  return {
    total_topics: full.project.total_topics,
    total_subtopics: full.project.total_subtopics,
    members: full.members.map((m) => ({
      user_id: m.user_id,
      full_name: m.full_name,
      completion_percentage: m.completion_percentage,
    })),
    leading: full.leaderboard[0] || null,
  };
}

async function getTimeline(projectId) {
  const full = await getDashboard(projectId);
  return full ? full.timeline : {};
}

module.exports = { getDashboard, getSummary, getTimeline };
