/**
 * Image Deduplicator
 * Calculates visual perceptual hashes (dHash) to detect identical or overly similar covers.
 */

const sharp = require('sharp');

/**
 * Compute 64-bit difference hash (dHash) for an image buffer
 */
async function computePerceptualHash(imageBuffer) {
    try {
        // Resize to 9x8 greyscale (64 difference bits)
        const raw = await sharp(imageBuffer)
            .resize(9, 8, { fit: 'fill' })
            .greyscale()
            .raw()
            .toBuffer();

        let hash = '';
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const left = raw[row * 9 + col];
                const right = raw[row * 9 + col + 1];
                hash += left < right ? '1' : '0';
            }
        }

        // Convert binary string to hexadecimal
        let hex = '';
        for (let i = 0; i < hash.length; i += 4) {
            hex += parseInt(hash.substr(i, 4), 2).toString(16);
        }
        return hex;
    } catch (err) {
        // Fallback to simple buffer hash
        const crypto = require('crypto');
        return crypto.createHash('md5').update(imageBuffer).digest('hex').slice(0, 16);
    }
}

/**
 * Calculate Hamming distance between two hex hashes
 */
function getHammingDistance(hexA, hexB) {
    if (!hexA || !hexB || hexA.length !== hexB.length) return 64;
    let distance = 0;
    for (let i = 0; i < hexA.length; i++) {
        const valA = parseInt(hexA[i], 16);
        const valB = parseInt(hexB[i], 16);
        let xor = valA ^ valB;
        while (xor > 0) {
            distance += xor & 1;
            xor >>= 1;
        }
    }
    return distance;
}

module.exports = {
    computePerceptualHash,
    getHammingDistance
};
