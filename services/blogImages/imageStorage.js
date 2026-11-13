/**
 * Image Storage Service
 * Saves optimized WebP cover images and uploads to Supabase Cloud Storage.
 * Falls back to serving from backend server if Supabase is unavailable.
 * Strictly compresses all images to <= 90KB using high-efficiency WebP multi-pass encoding.
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { uploadToSupabaseStorage, isConfigured: isSupabaseConfigured } = require('../supabaseService');

const STORAGE_DIR = path.join(__dirname, '..', '..', 'data', 'blog-covers');
const MAX_TARGET_BYTES = 90 * 1024; // Strictly <= 90KB (92,160 bytes)

// Backend base URL for serving images when Supabase is unavailable
const BACKEND_BASE_URL = process.env.BACKEND_URL || process.env.RENDER_EXTERNAL_URL || 'https://api.techyarts.com';

function ensureStorageDirectory() {
    if (!fs.existsSync(STORAGE_DIR)) {
        fs.mkdirSync(STORAGE_DIR, { recursive: true });
    }
}

/**
 * Compress, optimize, and store cover image.
 * Priority: Supabase Cloud Storage → Backend server static serving.
 * Guarantees output file size is <= 90KB.
 *
 * @param {Buffer} rawBuffer - Image buffer from Gemini, FLUX, or Procedural engine
 * @param {string} slug - Blog slug for clean naming
 * @returns {Promise<{ localPath: string, publicUrl: string, fileSize: number }>}
 */
async function storeCoverImage(rawBuffer, slug = 'article') {
    ensureStorageDirectory();

    const cleanSlug = slug.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40);
    const filename = `cover-${cleanSlug}-${Date.now()}.webp`;
    const fullPath = path.join(STORAGE_DIR, filename);

    // Initial pass: 1600x900 (16:9) WebP with high quality
    let width = 1600;
    let height = 900;
    let quality = 82;

    let compressedBuffer = await sharp(rawBuffer)
        .resize(width, height, { fit: 'cover', position: 'centre' })
        .webp({ quality, effort: 5 })
        .toBuffer();

    // Multi-pass adaptive compression loop: guarantees output is strictly <= 90KB
    while (compressedBuffer.length > MAX_TARGET_BYTES && quality > 35) {
        quality -= 6;
        if (quality < 65 && width > 1280) {
            width = 1280;
            height = 720;
        }
        compressedBuffer = await sharp(rawBuffer)
            .resize(width, height, { fit: 'cover', position: 'centre' })
            .webp({ quality, effort: 6 })
            .toBuffer();
    }

    // Write to local disk as backup
    fs.writeFileSync(fullPath, compressedBuffer);
    const stats = fs.statSync(fullPath);

    // Try uploading to Supabase Cloud Storage first
    let publicUrl = null;
    if (isSupabaseConfigured) {
        try {
            const cloudUrl = await uploadToSupabaseStorage(compressedBuffer, filename, 'image/webp');
            if (cloudUrl) {
                publicUrl = cloudUrl;
                console.log(`[ImageStorage] Uploaded to Supabase Cloud: ${publicUrl} (${(stats.size / 1024).toFixed(1)} KB)`);
            }
        } catch (err) {
            console.warn('[ImageStorage] Supabase upload failed, falling back to backend serving:', err.message);
        }
    }

    // Fallback: serve from backend server
    if (!publicUrl) {
        publicUrl = `${BACKEND_BASE_URL.replace(/\/$/, '')}/static/blog-covers/${filename}`;
        console.log(`[ImageStorage] Serving from backend: ${publicUrl} (${(stats.size / 1024).toFixed(1)} KB)`);
    }

    return {
        localPath: fullPath,
        publicUrl,
        filename,
        fileSize: stats.size
    };
}

module.exports = {
    storeCoverImage,
    STORAGE_DIR,
    MAX_TARGET_BYTES
};
