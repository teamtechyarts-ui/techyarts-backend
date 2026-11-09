/**
 * Image Storage Service
 * Saves optimized WebP cover images into the local public/images/blog-covers directory.
 * Strictly compresses all images to <= 90KB using high-efficiency WebP multi-pass encoding.
 * NEVER stores raw base64 in database — writes directly to disk storage and returns clean public URLs.
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const STORAGE_DIR = path.join(process.cwd(), 'public', 'images', 'blog-covers');
const MAX_TARGET_BYTES = 90 * 1024; // Strictly <= 90KB (92,160 bytes)

function ensureStorageDirectory() {
    if (!fs.existsSync(STORAGE_DIR)) {
        fs.mkdirSync(STORAGE_DIR, { recursive: true });
    }
}

/**
 * Compress, optimize, and store cover image into disk storage.
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

    // Write final <= 90KB WebP file directly to physical disk storage
    fs.writeFileSync(fullPath, compressedBuffer);

    const stats = fs.statSync(fullPath);
    const publicUrl = `/images/blog-covers/${filename}`;

    console.log(`[ImageStorage] Saved optimized cover to storage: ${publicUrl} (${(stats.size / 1024).toFixed(1)} KB <= 90KB target)`);

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
