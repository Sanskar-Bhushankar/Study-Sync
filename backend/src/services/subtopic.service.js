const { supabase } = require('../config/supabase');
const { NotFoundError } = require('../utils/errors');

async function create(topicId, title, orderIndex, projectId) {
  if (projectId) {
    const { data: topic } = await supabase.from('topics').select('id').eq('id', topicId).eq('project_id', projectId).single();
    if (!topic) throw new NotFoundError('Topic not found');
  }
  let resolvedIndex = orderIndex;
  if (resolvedIndex === undefined || resolvedIndex === null) {
    const { data: rows, error: maxErr } = await supabase
      .from('subtopics')
      .select('order_index')
      .eq('topic_id', topicId)
      .order('order_index', { ascending: false })
      .limit(1);
    if (maxErr) throw maxErr;
    const max = rows?.[0]?.order_index;
    resolvedIndex = typeof max === 'number' && !Number.isNaN(max) ? max + 1 : 0;
  }
  const { data, error } = await supabase.from('subtopics').insert({ topic_id: topicId, title, order_index: resolvedIndex }).select().single();
  if (error) throw error;
  return data;
}

async function getById(subtopicId) {
  const { data, error } = await supabase.from('subtopics').select('*').eq('id', subtopicId).single();
  if (error || !data) throw new NotFoundError('Subtopic not found');
  return data;
}

async function update(subtopicId, updates) {
  const allowed = {};
  if (updates.title !== undefined) allowed.title = updates.title;
  if (updates.order_index !== undefined) allowed.order_index = updates.order_index;
  if (Object.keys(allowed).length === 0) return getById(subtopicId);
  const { data, error } = await supabase.from('subtopics').update(allowed).eq('id', subtopicId).select().single();
  if (error) throw error;
  return data;
}

async function remove(subtopicId) {
  const { error } = await supabase.from('subtopics').delete().eq('id', subtopicId);
  if (error) throw error;
}

async function reorder(topicId, orderMap) {
  for (const [id, order_index] of Object.entries(orderMap)) {
    await supabase.from('subtopics').update({ order_index }).eq('id', id).eq('topic_id', topicId);
  }
  const { data } = await supabase.from('subtopics').select('id, title, order_index').eq('topic_id', topicId).order('order_index');
  return data || [];
}

async function listByTopic(topicId) {
  const { data, error } = await supabase.from('subtopics').select('id, title, order_index').eq('topic_id', topicId).order('order_index');
  if (error) throw error;
  return data || [];
}

module.exports = { create, getById, update, remove, reorder, listByTopic };
