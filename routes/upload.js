const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();

/**
 * POST /api/upload
 * Handles base64 data URLs or binary payloads to store uploaded assets.
 */
router.post('/', (req, res) => {
    try {
        const { file, filename = 'upload.png', folder = 'uploads' } = req.body;

        if (!file) {
            return res.status(400).json({ success: false, message: 'No file data received' });
        }

        // Clean folder name
        const cleanFolder = folder.replace(/[^a-zA-Z0-9_-]/g, '') || 'uploads';
        const targetDir = path.join(__dirname, '..', '..', 'public', 'images', cleanFolder);

        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }

        // Check if data is base64 Data URL
        let buffer;
        let ext = path.extname(filename).toLowerCase() || '.png';

        if (file.startsWith('data:')) {
            const matches = file.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
            if (!matches || matches.length !== 3) {
                return res.status(400).json({ success: false, message: 'Invalid data URL format' });
            }
            buffer = Buffer.from(matches[2], 'base64');
            const mime = matches[1];
            if (mime === 'image/jpeg') ext = '.jpg';
            else if (mime === 'image/png') ext = '.png';
            else if (mime === 'image/webp') ext = '.webp';
            else if (mime === 'image/svg+xml') ext = '.svg';
        } else {
            buffer = Buffer.from(file, 'base64');
        }

        if (buffer.length > 10 * 1024 * 1024) {
            return res.status(400).json({ success: false, message: 'File too large (exceeds 10MB limit)' });
        }

        const safeBaseName = path
            .basename(filename, path.extname(filename))
            .toLowerCase()
            .replace(/[^a-z0-9_-]/g, '-')
            .slice(0, 40);

        const uniqueFilename = `${safeBaseName}-${Date.now().toString().slice(-6)}${ext}`;
        const finalFilePath = path.join(targetDir, uniqueFilename);

        fs.writeFileSync(finalFilePath, buffer);

        const publicUrl = `/images/${cleanFolder}/${uniqueFilename}`;

        return res.json({
            success: true,
            url: publicUrl,
            filename: uniqueFilename
        });
    } catch (err) {
        console.error('[Upload API] Error saving file:', err);
        return res.status(500).json({ success: false, message: 'Failed to save file' });
    }
});

module.exports = router;

