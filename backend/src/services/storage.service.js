const { supabase } = require('../config/supabase');

const BUCKET = 'study-notes';
const SIGNED_URL_EXPIRY = 60 * 60 * 24 * 7;

function buildPath(projectId, topicId, userId, filename) {
  return `${projectId}/${topicId}/${userId}/${Date.now()}_${filename}`;
}

async function uploadNote(projectId, topicId, userId, buffer, mimetype, originalName) {
  const ext = mimetype === 'application/pdf' ? 'pdf' : mimetype === 'image/png' ? 'png' : 'jpg';
  const filename = (originalName || 'file').replace(/\s+/g, '_').replace(/[^a-zA-Z0-9._-]/g, '') || 'file';
  const fullName = `${filename}.${ext}`.replace(/\.{2,}/g, '.');
  const storagePath = buildPath(projectId, topicId, userId, fullName);
  const { error } = await supabase.storage.from(BUCKET).upload(storagePath, buffer, {
    contentType: mimetype,
    upsert: false,
  });
  if (error) throw error;
  const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, SIGNED_URL_EXPIRY);
  return { storagePath, signedUrl: signed?.signedUrl, notesType: ext === 'pdf' ? 'pdf' : 'image' };
}

async function getSignedUrl(storagePath) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, SIGNED_URL_EXPIRY);
  if (error) throw error;
  return data?.signedUrl;
}

module.exports = { uploadNote, getSignedUrl, BUCKET };
