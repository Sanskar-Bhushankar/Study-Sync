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

  // Try signed URL first, fall back to public URL (bucket is public)
  let signedUrl = null;
  try {
    const { data: signed, error: signErr } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(storagePath, SIGNED_URL_EXPIRY);
    if (signErr) {
      console.warn('[storage] Signed URL error (using public URL fallback):', signErr.message);
    } else {
      signedUrl = signed?.signedUrl;
    }
  } catch (e) {
    console.warn('[storage] Signed URL exception, using public URL fallback:', e.message);
  }

  // Always have a usable URL since the bucket is public
  const publicUrl = getPublicUrl(storagePath);
  return {
    storagePath,
    signedUrl: signedUrl || publicUrl,
    notesType: ext === 'pdf' ? 'pdf' : 'image',
  };
}

async function getSignedUrl(storagePath) {
  if (!storagePath) return null;
  try {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(storagePath, SIGNED_URL_EXPIRY);
    if (error) {
      // Fall back to public URL since bucket is public
      console.warn('[storage] getSignedUrl error, using public URL:', error.message);
      return getPublicUrl(storagePath);
    }
    return data?.signedUrl || getPublicUrl(storagePath);
  } catch (e) {
    console.warn('[storage] getSignedUrl exception, using public URL:', e.message);
    return getPublicUrl(storagePath);
  }
}

module.exports = { uploadNote, getSignedUrl, getPublicUrl, BUCKET };
