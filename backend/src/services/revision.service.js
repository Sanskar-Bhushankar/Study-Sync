const { supabase } = require('../config/supabase');
const { NotFoundError, BadRequestError } = require('../utils/errors');

async function logRevision(projectId, topicId, userId, note) {
  const { data: topic } = await supabase
    .from('topics')
    .select('id')
    .eq('id', topicId)
    .eq('project_id', projectId)
    .single();
  if (!topic) throw new NotFoundError('Topic not found');

  const { data: completion } = await supabase
    .from('topic_completions')
    .select('id')
    .eq('topic_id', topicId)
    .eq('user_id', userId)
    .single();
  if (!completion) throw new BadRequestError('Complete this topic before adding a revision', 'TOPIC_NOT_COMPLETE');

  if (note && note.length > 500) throw new BadRequestError('Note must be 500 characters or less');

  const { data, error } = await supabase
    .from('topic_revisions')
    .insert({ topic_id: topicId, user_id: userId, project_id: projectId, note: note || null })
    .select()
    .single();
  if (error) throw error;

  const googleCalendar = require('./googleCalendar.service');
  googleCalendar.safeSync(
    googleCalendar.createRevisionEvent(userId, {
      projectId,
      topicId,
      revisionId: data.id,
      note: data.note,
      revisedAt: data.revised_at,
      trigger: 'auto',
    })
  );
  return data;
}

async function listRevisions(projectId, topicId, userId) {
  const { data, error } = await supabase
    .from('topic_revisions')
    .select('id, note, revised_at')
    .eq('topic_id', topicId)
    .eq('user_id', userId)
    .eq('project_id', projectId)
    .order('revised_at', { ascending: false });
  if (error) throw error;
  const rows = data || [];
  return rows.map((r, i) => ({ ...r, revision_number: rows.length - i }));
}

async function listProjectRevisions(projectId, userId) {
  const { data, error } = await supabase
    .from('topic_revisions')
    .select('id, topic_id, note, revised_at, topics(title)')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .order('revised_at', { ascending: false });
  if (error) throw error;
  return (data || []).map((r) => ({
    id: r.id,
    topic_id: r.topic_id,
    topic_title: r.topics?.title || null,
    note: r.note,
    revised_at: r.revised_at,
  }));
}

async function deleteRevision(projectId, revisionId, userId) {
  const { data, error } = await supabase
    .from('topic_revisions')
    .delete()
    .eq('id', revisionId)
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .select()
    .single();
  if (error) throw error;
  if (!data) throw new NotFoundError('Revision not found');
  return data;
}

module.exports = { logRevision, listRevisions, listProjectRevisions, deleteRevision };
