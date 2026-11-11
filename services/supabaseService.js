const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const isConfigured = Boolean(supabaseUrl && serviceRoleKey);

let supabaseAdmin = null;
if (isConfigured) {
  supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
}

/**
 * Upload image buffer to Supabase Storage "blog-images" bucket.
 */
async function uploadToSupabaseStorage(buffer, fileName, contentType = 'image/webp') {
  if (!supabaseAdmin) return null;
  try {
    const cleanPath = `covers/${Date.now()}-${fileName.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from('blog-images')
      .upload(cleanPath, buffer, {
        contentType,
        upsert: true,
      });

    if (uploadError) {
      console.error('[Supabase Server] Upload failed:', uploadError.message);
      return null;
    }

    const { data } = supabaseAdmin.storage.from('blog-images').getPublicUrl(cleanPath);
    return data ? data.publicUrl : null;
  } catch (err) {
    console.error('[Supabase Server] Unexpected storage error:', err.message);
    return null;
  }
}

/**
 * Sync blogs to Supabase Database table
 */
async function syncBlogToSupabase(blog) {
  if (!supabaseAdmin) return false;
  try {
    const { error } = await supabaseAdmin.from('blogs').upsert(blog, { onConflict: 'id' });
    if (error) {
      console.warn('[Supabase Server] Blog upsert warning:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[Supabase Server] Sync error:', err.message);
    return false;
  }
}

module.exports = {
  isConfigured,
  supabaseAdmin,
  uploadToSupabaseStorage,
  syncBlogToSupabase,
};

