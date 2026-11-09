/**
 * Image Quality Checker
 * Inspects image dimensions, format integrity, file size, and visual parameters.
 */

const sharp = require('sharp');

async function inspectImageQuality(imageBuffer) {
    if (!imageBuffer || !Buffer.isBuffer(imageBuffer) || imageBuffer.length < 2048) {
        return {
            valid: false,
            score: 0,
            reason: 'Image buffer is missing or below minimum size threshold (2KB)'
        };
    }

    try {
        const metadata = await sharp(imageBuffer).metadata();
        const { width, height, format } = metadata;

        if (!width || !height) {
            return {
                valid: false,
                score: 0,
                reason: 'Unable to extract valid dimensions from image metadata'
            };
        }

        const aspectRatio = width / height;
        const targetAspectRatio = 16 / 9; // ~1.777
        const aspectDiff = Math.abs(aspectRatio - targetAspectRatio);

        let score = 95;

        // Penalize for extreme aspect ratio deviations
        if (aspectDiff > 0.4) {
            score -= 15;
        }

        // Check adequate resolution
        if (width < 800 || height < 450) {
            score -= 20;
        }

        return {
            valid: score >= 60,
            score,
            width,
            height,
            format,
            aspectRatio: Number(aspectRatio.toFixed(2))
        };
    } catch (err) {
        return {
            valid: false,
            score: 0,
            reason: `Sharp metadata extraction failed: ${err.message}`
        };
    }
}

module.exports = {
    inspectImageQuality
};
