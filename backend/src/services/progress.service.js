const { supabase } = require('../config/supabase');
const topicService = require('./topic.service');
const storageService = require('./storage.service');

async function markComplete(projectId, subtopicId, userId) {
  const { data: sub } = await supabase.from('subtopics').select('id, topic_id').eq('id', subtopicId).single();
  if (!sub) return null;
  const { data: topic } = await supabase.from('topics').select('id').eq('id', sub.topic_id).eq('project_id', projectId).single();
  if (!topic) return null;
  const { data, error } = await supabase.from('subtopic_progress').upsert(
    { subtopic_id: subtopicId, user_id: userId, project_id: projectId, is_completed: true, completed_at: new Date().toISOString() },
    { onConflict: 'subtopic_id,user_id' }
  ).select().single();
  if (error) throw error;
  const googleCalendar = require('./googleCalendar.service');
  googleCalendar.safeSync(
    googleCalendar.onSubtopicComplete(userId, {
      projectId,
      topicId: sub.topic_id,
      completedAt: data.completed_at,
    })
  );
  const subtopics = await supabase.from('subtopics').select('id').eq('topic_id', sub.topic_id);
  const completed = await supabase.from('subtopic_progress').select('id').eq('user_id', userId).eq('project_id', projectId).in('subtopic_id', (subtopics.data || []).map((s) => s.id)).eq('is_completed', true);
  const allDone = (subtopics.data?.length || 0) === (completed.data?.length || 0);
  return { progress: data, all_subtopics_done: allDone };
}

async function markAllComplete(projectId, topicId, userId) {
  const { data: subtopics } = await supabase.from('subtopics').select('id').eq('topic_id', topicId);
  if (!subtopics?.length) return { all_subtopics_done: false, count: 0 };
  const rows = subtopics.map((s) => ({
    subtopic_id: s.id, user_id: userId, project_id: projectId,
    is_completed: true, completed_at: new Date().toISOString(),
  }));
  const { error } = await supabase.from('subtopic_progress').upsert(rows, { onConflict: 'subtopic_id,user_id' });
  if (error) throw error;
  return { all_subtopics_done: true, count: subtopics.length };
}

async function updatePersonalNote(projectId, subtopicId, userId, note) {
  const { data: sub } = await supabase.from('subtopics').select('topic_id').eq('id', subtopicId).single();
  if (!sub) return null;
  const { data: existing } = await supabase
    .from('subtopic_progress')
    .select('id, is_completed')
    .eq('subtopic_id', subtopicId)
    .eq('user_id', userId)
    .maybeSingle();
  if (existing) {
    const { data, error } = await supabase
      .from('subtopic_progress')
      .update({ personal_note: note || null })
      .eq('subtopic_id', subtopicId)
      .eq('user_id', userId)
      .select().single();
    if (error) throw error;
    return data;
  } else {
    const { data, error } = await supabase
      .from('subtopic_progress')
      .insert({ subtopic_id: subtopicId, user_id: userId, project_id: projectId, is_completed: false, personal_note: note || null })
      .select().single();
    if (error) throw error;
    return data;
  }
}

async function unmarkComplete(projectId, subtopicId, userId) {
  const { data: sub } = await supabase.from('subtopics').select('topic_id').eq('id', subtopicId).single();
  if (!sub) return null;
  const { data: tc } = await supabase.from('topic_completions').select('id').eq('topic_id', sub.topic_id).eq('user_id', userId).single();
  if (tc) throw new (require('../utils/errors').BadRequestError)('Cannot unmark: topic already completed with notes');
  const { data, error } = await supabase.from('subtopic_progress').update({ is_completed: false, completed_at: null }).eq('subtopic_id', subtopicId).eq('user_id', userId).eq('project_id', projectId).select().single();
  if (error) throw error;
  return data;
}

async function getProgressMatrix(projectId) {
  const topics = await topicService.listByProject(projectId);
  const { data: progressRows } = await supabase.from('subtopic_progress').select('subtopic_id, user_id, is_completed, completed_at, personal_note').eq('project_id', projectId);
  const { data: completionRows } = await supabase.from('topic_completions').select('topic_id, user_id, notes_url, notes_type, uploaded_at').eq('project_id', projectId);
  const progressMap = new Map();
  (progressRows || []).forEach((p) => {
    const key = `${p.subtopic_id}:${p.user_id}`;
    progressMap.set(key, { is_completed: p.is_completed, completed_at: p.completed_at, personal_note: p.personal_note || null });
  });
  const completionMap = new Map();
  (completionRows || []).forEach((c) => {
    completionMap.set(`${c.topic_id}:${c.user_id}`, c);
  });
  const userIds = [...new Set([...(progressRows || []).map((p) => p.user_id), ...(completionRows || []).map((c) => c.user_id)])];
  for (const topic of topics) {
    topic.subtopics = (topic.subtopics || []).map((st) => {
      const completions = {};
      userIds.forEach((uid) => {
        completions[uid] = progressMap.get(`${st.id}:${uid}`) || { is_completed: false, completed_at: null, personal_note: null };
      });
      return { ...st, completions };
    });
    topic.completions = {};
    userIds.forEach((uid) => {
      const c = completionMap.get(`${topic.id}:${uid}`);
      topic.completions[uid] = c ? { is_completed: true, notes_url: c.notes_url, notes_type: c.notes_type, uploaded_at: c.uploaded_at } : { is_completed: false };
    });
  }
  return { topics };
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

module.exports = { markComplete, markAllComplete, updatePersonalNote, unmarkComplete, getProgressMatrix, getProgressForUser };
