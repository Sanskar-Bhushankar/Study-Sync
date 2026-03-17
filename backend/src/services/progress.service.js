const { supabase } = require('../config/supabase');
const { NotFoundError, BadRequestError } = require('../utils/errors');

async function markComplete(projectId, subtopicId, userId) {
  // Validate subtopic belongs to project in one query
  const { data: sub } = await supabase
    .from('subtopics')
    .select('id, topic_id, topics!inner(project_id)')
    .eq('id', subtopicId)
    .eq('topics.project_id', projectId)
    .single();
  if (!sub) return null;

  // Upsert progress + check all-done in parallel
  const [{ data, error }, { data: subtopics }] = await Promise.all([
    supabase.from('subtopic_progress').upsert(
      { subtopic_id: subtopicId, user_id: userId, project_id: projectId, is_completed: true, completed_at: new Date().toISOString() },
      { onConflict: 'subtopic_id,user_id' }
    ).select().single(),
    supabase.from('subtopics').select('id').eq('topic_id', sub.topic_id),
  ]);
  if (error) throw error;

  const topicSubIds = (subtopics || []).map((s) => s.id);
  const { data: completed } = await supabase
    .from('subtopic_progress')
    .select('id')
    .eq('user_id', userId)
    .eq('project_id', projectId)
    .in('subtopic_id', topicSubIds)
    .eq('is_completed', true);

  const allDone = topicSubIds.length > 0 && topicSubIds.length === (completed?.length || 0);
  return { progress: data, all_subtopics_done: allDone };
}

async function unmarkComplete(projectId, subtopicId, userId) {
  const { data: sub } = await supabase.from('subtopics').select('topic_id').eq('id', subtopicId).single();
  if (!sub) return null;
  const { data: tc } = await supabase
    .from('topic_completions')
    .select('id')
    .eq('topic_id', sub.topic_id)
    .eq('user_id', userId)
    .single();
  if (tc) throw new BadRequestError('Cannot unmark: topic already completed with notes');
  const { data, error } = await supabase
    .from('subtopic_progress')
    .update({ is_completed: false, completed_at: null })
    .eq('subtopic_id', subtopicId)
    .eq('user_id', userId)
    .eq('project_id', projectId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function getProgressMatrix(projectId) {
  // Fetch topics + all subtopics for project in 2 queries (not N+1)
  const [{ data: topicsRaw, error }, { data: allSubtopics }, { data: progressRows }, { data: completionRows }] =
    await Promise.all([
      supabase.from('topics').select('id, title, order_index, created_at').eq('project_id', projectId).order('order_index'),
      supabase.from('subtopics').select('id, title, order_index, created_at, topic_id')
        .eq('topic_id', '__placeholder__'), // will be overridden below
      supabase.from('subtopic_progress').select('subtopic_id, user_id, is_completed, completed_at').eq('project_id', projectId),
      supabase.from('topic_completions').select('topic_id, user_id, notes_url, notes_type, uploaded_at').eq('project_id', projectId),
    ]);

  if (error) throw error;
  const topics = topicsRaw || [];
  if (topics.length === 0) return { topics: [] };

  const topicIds = topics.map((t) => t.id);

  // Now fetch all subtopics for all topics in one query
  const { data: subs } = await supabase
    .from('subtopics')
    .select('id, title, order_index, created_at, topic_id')
    .in('topic_id', topicIds)
    .order('order_index');

  const progressMap = new Map();
  (progressRows || []).forEach((p) => {
    progressMap.set(`${p.subtopic_id}:${p.user_id}`, { is_completed: p.is_completed, completed_at: p.completed_at });
  });

  const completionMap = new Map();
  (completionRows || []).forEach((c) => {
    completionMap.set(`${c.topic_id}:${c.user_id}`, c);
  });

  const userIds = [...new Set([
    ...(progressRows  || []).map((p) => p.user_id),
    ...(completionRows || []).map((c) => c.user_id),
  ])];

  const subsByTopic = {};
  (subs || []).forEach((s) => {
    if (!subsByTopic[s.topic_id]) subsByTopic[s.topic_id] = [];
    subsByTopic[s.topic_id].push(s);
  });

  const enrichedTopics = topics.map((t) => {
    const topicSubs = (subsByTopic[t.id] || []).map((st) => {
      const completions = {};
      userIds.forEach((uid) => {
        completions[uid] = progressMap.get(`${st.id}:${uid}`) || { is_completed: false, completed_at: null };
      });
      return { ...st, completions };
    });

    const completions = {};
    userIds.forEach((uid) => {
      const c = completionMap.get(`${t.id}:${uid}`);
      completions[uid] = c
        ? { is_completed: true, notes_url: c.notes_url, notes_type: c.notes_type, uploaded_at: c.uploaded_at }
        : { is_completed: false };
    });

    return { ...t, subtopics: topicSubs, completions };
  });

  return { topics: enrichedTopics };
}

async function getProgressForUser(projectId, userId) {
  const matrix = await getProgressMatrix(projectId);
  matrix.topics = matrix.topics.map((t) => ({
    ...t,
    subtopics: t.subtopics.map((st) => ({ ...st, completions: { [userId]: st.completions[userId] } })),
    completions: { [userId]: t.completions[userId] },
  }));
  return matrix;
}

module.exports = { markComplete, unmarkComplete, getProgressMatrix, getProgressForUser };
