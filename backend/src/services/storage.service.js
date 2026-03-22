const { supabase } = require('../config/supabase');
const { supabaseUrl } = require('../config/env');

const BUCKET = 'study-notes';
const SIGNED_URL_EXPIRY = 60 * 60 * 24 * 7; // 7 days

function buildPath(projectId, topicId, userId, filename) {
  return `${projectId}/${topicId}/${userId}/${Date.now()}_${filename}`;
}

/**
 * Returns the public URL for a path in the public study-notes bucket.
 * This always works because the bucket is set to public.
 */
function getPublicUrl(storagePath) {
  return `${supabaseUrl}/storage/v1/object/public/${BUCKET}/${storagePath}`;
}

async function uploadNote(projectId, topicId, userId, buffer, mimetype, originalName) {
  const ext = mimetype === 'application/pdf' ? 'pdf' : mimetype === 'image/png' ? 'png' : 'jpg';
  const filename = (originalName || 'file').replace(/\s+/g, '_').replace(/[^a-zA-Z0-9._-]/g, '') || 'file';
  const fullName = `${filename}.${ext}`.replace(/\.{2,}/g, '.');
  const storagePath = buildPath(projectId, topicId, userId, fullName);

  console.log('[storage] Uploading to bucket:', BUCKET, 'path:', storagePath, 'size:', buffer?.length, 'mime:', mimetype);

  const { data: uploadData, error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, buffer, { contentType: mimetype, upsert: false });

  if (uploadError) {
    console.error('[storage] Upload error:', JSON.stringify(uploadError), uploadError?.message);
    throw new Error(`Storage upload failed: ${uploadError.message || JSON.stringify(uploadError)}`);
  }

  console.log('[storage] Upload success, path:', uploadData?.path || storagePath);

  // Bucket is public — use public URL directly, no extra round-trip needed
  return {
    storagePath,
    signedUrl: getPublicUrl(storagePath),
    notesType: ext === 'pdf' ? 'pdf' : 'image',
  };
}

// Bucket is public — derive URL from path with zero round-trips
function getSignedUrl(storagePath) {
  if (!storagePath) return null;
  return getPublicUrl(storagePath);
}

const REMOVE_BATCH_SIZE = 1000;

/**
 * Recursively list all file paths under a prefix. Returns paths like "projectId/topicId/userId/file.pdf".
 */
async function listAllPathsUnder(prefix) {
  const paths = [];
  const { data: items, error } = await supabase.storage.from(BUCKET).list(prefix, { limit: 1000 });
  if (error) throw error;
  if (!items || items.length === 0) return paths;
  for (const item of items) {
    const fullPath = prefix ? `${prefix}/${item.name}` : item.name;
    if (item.id != null) {
      paths.push(fullPath);
    } else {
      const nested = await listAllPathsUnder(fullPath);
      paths.push(...nested);
    }
  }
  return paths;
}

/**
 * Delete all storage objects under study-notes/{projectId}/.
 * Used when deleting a project. Service role bypasses RLS.
 */
async function deleteProjectStorage(projectId) {
  const paths = await listAllPathsUnder(projectId);
  if (paths.length === 0) return;
  for (let i = 0; i < paths.length; i += REMOVE_BATCH_SIZE) {
    const batch = paths.slice(i, i + REMOVE_BATCH_SIZE);
    const { error } = await supabase.storage.from(BUCKET).remove(batch);
    if (error) throw new Error(`Storage delete failed: ${error.message}`);
  }
}

module.exports = { uploadNote, getSignedUrl, getPublicUrl, deleteProjectStorage, BUCKET };
