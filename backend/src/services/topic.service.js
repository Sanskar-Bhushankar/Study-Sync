const { supabase } = require('../config/supabase');
const { NotFoundError } = require('../utils/errors');

async function create(projectId, title, orderIndex) {
  const { data, error } = await supabase.from('topics').insert({ project_id: projectId, title, order_index: orderIndex ?? 0 }).select().single();
  if (error) throw error;
  return data;
}

async function listByProject(projectId) {
  const { data, error } = await supabase.from('topics').select('id, title, order_index, created_at').eq('project_id', projectId).order('order_index');
  if (error) throw error;
  const topics = data || [];
  for (const t of topics) {
    const { data: subs } = await supabase.from('subtopics').select('id, title, order_index, created_at').eq('topic_id', t.id).order('order_index');
    t.subtopics = subs || [];
  }
  return topics;
}

async function getById(topicId) {
  const { data, error } = await supabase.from('topics').select('*').eq('id', topicId).single();
  if (error || !data) throw new NotFoundError('Topic not found');
  return data;
}

async function update(topicId, updates) {
  const allowed = {};
  if (updates.title !== undefined) allowed.title = updates.title;
  if (updates.order_index !== undefined) allowed.order_index = updates.order_index;
  if (Object.keys(allowed).length === 0) return getById(topicId);
  const { data, error } = await supabase.from('topics').update(allowed).eq('id', topicId).select().single();
  if (error) throw error;
  return data;
}

async function remove(topicId) {
  const { error } = await supabase.from('topics').delete().eq('id', topicId);
  if (error) throw error;
}

async function reorder(projectId, orderMap) {
  for (const [id, order_index] of Object.entries(orderMap)) {
    await supabase.from('topics').update({ order_index }).eq('id', id).eq('project_id', projectId);
  }
  return listByProject(projectId);
}

module.exports = { create, listByProject, getById, update, remove, reorder };
