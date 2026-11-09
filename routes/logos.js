const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();

const DATA_FILE = path.join(__dirname, '..', 'data', 'logos.json');

// Helper to safely read logos from server data file
function readLogos() {
    try {
        if (!fs.existsSync(DATA_FILE)) {
            return [];
        }
        const data = fs.readFileSync(DATA_FILE, 'utf8');
        const parsed = JSON.parse(data || '[]');
        return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
        console.error('[Logos API] Error reading logos.json:', err);
        return [];
    }
}

// Helper to write logos to server data file
function writeLogos(logos) {
    try {
        const dir = path.dirname(DATA_FILE);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(DATA_FILE, JSON.stringify(logos, null, 2), 'utf8');
        return true;
    } catch (err) {
        console.error('[Logos API] Error writing logos.json:', err);
        return false;
    }
}

/**
 * GET /api/logos
 * Query parameters:
 *  - status: 'all' | 'published' | 'draft' (default: 'all')
 *  - category: filter by category
 *  - serviceType: 'website' | 'marketing'
 */
router.get('/', (req, res) => {
    try {
        let logos = readLogos();
        const { status = 'all', category, serviceType } = req.query;

        if (status !== 'all') {
            logos = logos.filter(l => l.status === status);
        }

        if (serviceType && (serviceType === 'website' || serviceType === 'marketing')) {
            logos = logos.filter(l => (l.serviceType || 'website') === serviceType);
        }

        if (category && category !== 'All') {
            logos = logos.filter(l => l.category && l.category.toLowerCase() === category.toLowerCase());
        }

        // Sort by order ascending
        logos.sort((a, b) => (a.order ?? 99) - (b.order ?? 99));

        res.setHeader('Cache-Control', 'no-store, max-age=0');
        return res.json(logos);
    } catch (err) {
        console.error('[Logos API GET] Error:', err);
        return res.status(500).json({ error: 'Failed to retrieve client logos' });
    }
});

/**
 * GET /api/logos/:id
 * Retrieve single logo by id or slug
 */
router.get('/:id', (req, res) => {
    try {
        const { id } = req.params;
        const logos = readLogos();
        const item = logos.find(l => l.id === id || l.slug === id);

        if (!item) {
            return res.status(404).json({ error: 'Client logo or case study not found' });
        }

        return res.json(item);
    } catch (err) {
        console.error('[Logos API GET/:id] Error:', err);
        return res.status(500).json({ error: 'Failed to retrieve logo item' });
    }
});

/**
 * POST /api/logos
 * Create new logo entry
 */
router.post('/', (req, res) => {
    try {
        const body = req.body;

        if (!body.name || !body.logoUrl) {
            return res.status(400).json({ error: 'Brand Name and Logo URL are required.' });
        }

        const logos = readLogos();

        // Generate safe unique ID and slug
        const rawSlug = body.slug || body.name;
        const slug = rawSlug
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)+/g, '');

        const newLogo = {
            id: body.id || `logo-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
            name: body.name.trim(),
            slug: slug || `client-${Date.now().toString(36)}`,
            logoUrl: body.logoUrl.trim(),
            category: body.category || 'Technology',
            serviceType: body.serviceType === 'marketing' ? 'marketing' : 'website',
            scale: typeof body.scale === 'number' ? body.scale : 1.0,
            maxHeight: typeof body.maxHeight === 'number' ? body.maxHeight : 45,
            websiteUrl: body.websiteUrl?.trim() || '',
            description: body.description?.trim() || '',
            featured: Boolean(body.featured),
            status: body.status === 'draft' ? 'draft' : 'published',
            order: typeof body.order === 'number' ? body.order : logos.length + 1,
            caseStudy: body.caseStudy || undefined,
            createdAt: new Date().toISOString().split('T')[0]
        };

        logos.push(newLogo);
        writeLogos(logos);

        return res.status(201).json(newLogo);
    } catch (err) {
        console.error('[Logos API POST] Error:', err);
        return res.status(500).json({ error: 'Failed to create logo entry' });
    }
});

/**
 * PUT /api/logos/:id
 * Update existing logo entry
 */
router.put('/:id', (req, res) => {
    try {
        const { id } = req.params;
        const body = req.body;
        const logos = readLogos();
        const index = logos.findIndex(l => l.id === id || l.slug === id);

        if (index === -1) {
            return res.status(404).json({ error: 'Logo not found' });
        }

        logos[index] = {
            ...logos[index],
            ...body,
            id: logos[index].id, // preserve immutable ID
            updatedAt: new Date().toISOString()
        };

        writeLogos(logos);
        return res.json(logos[index]);
    } catch (err) {
        console.error('[Logos API PUT] Error:', err);
        return res.status(500).json({ error: 'Failed to update logo' });
    }
});

/**
 * DELETE /api/logos/:id
 * Remove logo entry
 */
router.delete('/:id', (req, res) => {
    try {
        const { id } = req.params;
        const logos = readLogos();
        const filtered = logos.filter(l => l.id !== id && l.slug !== id);

        if (filtered.length === logos.length) {
            return res.status(404).json({ error: 'Logo not found' });
        }

        writeLogos(filtered);
        return res.json({ success: true, message: 'Logo deleted successfully' });
    } catch (err) {
        console.error('[Logos API DELETE] Error:', err);
        return res.status(500).json({ error: 'Failed to delete logo' });
    }
});

module.exports = router;

