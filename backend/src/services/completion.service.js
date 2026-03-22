const { supabase } = require('../config/supabase');
const storageService = require('./storage.service');
const { BadRequestError, ConflictError, NotFoundError } = require('../utils/errors');

async function completeTopic(projectId, topicId, userId, file) {
  const { data: topic } = await supabase.from('topics').select('id').eq('id', topicId).eq('project_id', projectId).single();
  if (!topic) throw new NotFoundError('Topic not found');

  const { data: subtopics } = await supabase.from('subtopics').select('id').eq('topic_id', topicId);
  const subIds = (subtopics || []).map((s) => s.id);
  if (subIds.length) {
    const { data: completed } = await supabase
      .from('subtopic_progress')
      .select('id')
      .eq('user_id', userId)
      .eq('project_id', projectId)
      .in('subtopic_id', subIds)
      .eq('is_completed', true);
    if ((completed?.length || 0) < subIds.length) {
      throw new BadRequestError('You must complete all subtopics before uploading notes', 'TOPIC_NOT_COMPLETE');
    }
  }

  const { data: existing } = await supabase.from('topic_completions').select('id').eq('topic_id', topicId).eq('user_id', userId).single();
  if (existing) throw new ConflictError('Topic already completed');

  // Upload file to storage
  console.log('[completeTopic] Uploading to storage, file:', file?.originalname, file?.mimetype, file?.buffer?.length);
  let storagePath, signedUrl, notesType;
  try {
    const result = await storageService.uploadNote(projectId, topicId, userId, file.buffer, file.mimetype, file.originalname);
    storagePath = result.storagePath;
    signedUrl = result.signedUrl;
    notesType = result.notesType;
  } catch (storageErr) {
    console.error('[completeTopic] Storage upload error:', JSON.stringify(storageErr), storageErr?.message);
    throw storageErr;
  }

  console.log('[completeTopic] Storage OK, inserting DB record...');
  const { data, error } = await supabase
    .from('topic_completions')
    .insert({ topic_id: topicId, user_id: userId, project_id: projectId, notes_url: storagePath, notes_type: notesType })
    .select()
    .single();
  if (error) {
    console.error('[completeTopic] DB insert error — code:', error.code, '| message:', error.message, '| hint:', error.hint, '| details:', error.details);
    // Surface a readable message: if it's an RLS error, give a clear hint
    const isRls = error.code === '42501' || (error.message || '').toLowerCase().includes('rls') || (error.message || '').toLowerCase().includes('policy');
    const msg = isRls
      ? `Database permission denied (RLS policy). Run the SQL fix in Supabase. Original: ${error.message}`
      : (error.message || JSON.stringify(error));
    throw new Error(msg);
  }
  return { ...data, signed_url: signedUrl };
}

async function listCompletions(projectId, topicId) {
  const { data: rows, error } = await supabase
    .from('topic_completions')
    .select('user_id, notes_url, notes_type, uploaded_at')
    .eq('project_id', projectId)
    .eq('topic_id', topicId);
  if (error) throw error;
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name')
    .in('id', (rows || []).map((r) => r.user_id));
  const profileMap = new Map((profiles || []).map((p) => [p.id, p.full_name]));
  return (rows || []).map((r) => ({
    ...r,
    full_name: profileMap.get(r.user_id),
    signed_url: storageService.getSignedUrl(r.notes_url),
  }));
}

// Single-call alternative used by the Notes tab — returns completions for ALL
// topics in the project grouped by topic_id, avoiding N parallel requests.
async function listAllCompletions(projectId) {
  const { data: rows, error } = await supabase
    .from('topic_completions')
    .select('topic_id, user_id, notes_url, notes_type, uploaded_at')
    .eq('project_id', projectId);
  if (error) throw error;
  if (!rows || rows.length === 0) return {};

  const userIds = [...new Set(rows.map((r) => r.user_id))];
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name')
    .in('id', userIds);
  const profileMap = new Map((profiles || []).map((p) => [p.id, p.full_name]));

  const grouped = {};
  for (const r of rows) {
    if (!grouped[r.topic_id]) grouped[r.topic_id] = [];
    grouped[r.topic_id].push({
      user_id: r.user_id,
      full_name: profileMap.get(r.user_id) || null,
      notes_url: r.notes_url,
      notes_type: r.notes_type,
      uploaded_at: r.uploaded_at,
      signed_url: storageService.getSignedUrl(r.notes_url),
    });
  }
  return grouped;
}

async function getNotesSignedUrl(projectId, topicId, userId) {
  const { data, error } = await supabase
    .from('topic_completions')
    .select('notes_url')
    .eq('project_id', projectId)
    .eq('topic_id', topicId)
    .eq('user_id', userId)
    .single();
  if (error || !data) throw new NotFoundError('Completion not found');
  return storageService.getSignedUrl(data.notes_url);
}

async function getMyCompletions(projectId, userId) {
  const { data, error } = await supabase
    .from('topic_completions')
    .select('topic_id, notes_url, notes_type, uploaded_at')
    .eq('project_id', projectId)
    .eq('user_id', userId);
  if (error) throw error;
  return (data || []).map((r) => ({
    ...r,
    signed_url: storageService.getSignedUrl(r.notes_url),
  }));
}

module.exports = { completeTopic, listCompletions, listAllCompletions, getNotesSignedUrl, getMyCompletions };
