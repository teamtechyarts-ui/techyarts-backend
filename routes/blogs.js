const express = require('express');
const fs = require('fs');
const path = require('path');
const { triggerDraftNow, getSchedulerStatus } = require('../services/cronScheduler');
const { regenerateArticleCover } = require('../services/blogGenerator');
const router = express.Router();

const DATA_FILE = path.join(__dirname, '..', 'data', 'blogs.json');

// Helper to ensure data file exists
function readBlogs() {
    try {
        if (!fs.existsSync(DATA_FILE)) {
            return [];
        }
        const data = fs.readFileSync(DATA_FILE, 'utf8');
        return JSON.parse(data || '[]');
    } catch (err) {
        console.error('[Blogs API] Error reading blogs.json:', err);
        return [];
    }
}

function writeBlogs(blogs) {
    try {
        const dir = path.dirname(DATA_FILE);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(DATA_FILE, JSON.stringify(blogs, null, 2), 'utf8');
        return true;
    } catch (err) {
        console.error('[Blogs API] Error writing blogs.json:', err);
        return false;
    }
}

// Helper to generate slug
function generateSlug(title) {
    return title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '');
}

/**
 * GET /api/blogs
 * Query parameters:
 *  - status: 'all' | 'published' | 'draft' (default: 'published' for public, or 'all' if admin)
 *  - category: filter by category
 *  - search: search title, excerpt, tags
 */
router.get('/', (req, res) => {
    try {
        const blogs = readBlogs();
        const { status = 'all', category, search } = req.query;

        let filtered = [...blogs];

        if (status !== 'all') {
            filtered = filtered.filter(b => b.status === status);
        }

        if (category && category !== 'All') {
            filtered = filtered.filter(b => b.category?.toLowerCase() === category.toLowerCase());
        }

        if (search) {
            const query = search.toLowerCase();
            filtered = filtered.filter(b =>
                b.title?.toLowerCase().includes(query) ||
                b.excerpt?.toLowerCase().includes(query) ||
                b.tags?.some(t => t.toLowerCase().includes(query))
            );
        }

        // Sort by publishedAt desc
        filtered.sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0));

        return res.json({ success: true, count: filtered.length, data: filtered });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Server error reading blogs' });
    }
});

/**
 * GET /api/blogs/:slug
 */
router.get('/:slug', (req, res) => {
    try {
        const blogs = readBlogs();
        const blog = blogs.find(b => b.slug === req.params.slug || b.id === req.params.slug);

        if (!blog) {
            return res.status(404).json({ success: false, message: 'Blog article not found' });
        }

        // Increment views count in memory safely without triggering file watcher rebuilds on read
        blog.views = (blog.views || 0) + 1;

        return res.json({ success: true, data: blog });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Server error retrieving blog' });
    }
});

/**
 * POST /api/blogs
 * Create new blog article
 */
router.post('/', (req, res) => {
    try {
        const blogs = readBlogs();
        const {
            title,
            slug,
            excerpt,
            content,
            coverImage,
            category,
            tags,
            author,
            readTime,
            status = 'published',
            featured = false
        } = req.body;

        if (!title || !content) {
            return res.status(400).json({ success: false, message: 'Title and content are required' });
        }

        const finalSlug = (slug || generateSlug(title)).trim();

        // Check if slug already exists
        const exists = blogs.some(b => b.slug === finalSlug);
        const resolvedSlug = exists ? `${finalSlug}-${Date.now().toString().slice(-4)}` : finalSlug;

        const newBlog = {
            id: `blog-${Date.now()}`,
            slug: resolvedSlug,
            title: title.trim(),
            excerpt: excerpt ? excerpt.trim() : (content.slice(0, 150) + '...'),
            content,
            coverImage: coverImage || 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=1400&auto=format&fit=crop&q=85',
            category: category || 'Engineering',
            tags: Array.isArray(tags) ? tags : (tags ? tags.split(',').map(t => t.trim()) : ['TechyArts']),
            author: {
                name: author?.name || 'TechyArts Team',
                role: author?.role || 'Lead Systems Architect',
                avatar: author?.avatar || '/images/T.png'
            },
            readTime: readTime || `${Math.max(2, Math.round(content.split(/\s+/).length / 200))} min read`,
            publishedAt: new Date().toISOString().split('T')[0],
            status: status === 'draft' ? 'draft' : 'published',
            featured: Boolean(featured),
            views: 0
        };

        blogs.unshift(newBlog);
        writeBlogs(blogs);

        console.log('[Blogs API] Created blog:', newBlog.title, `(${newBlog.slug})`);
        return res.status(201).json({ success: true, data: newBlog });
    } catch (err) {
        console.error('[Blogs API] Error creating blog:', err);
        return res.status(500).json({ success: false, message: 'Failed to create blog article' });
    }
});

/**
 * PUT /api/blogs/:id
 * Update existing blog article
 */
router.put('/:id', (req, res) => {
    try {
        const blogs = readBlogs();
        const index = blogs.findIndex(b => b.id === req.params.id || b.slug === req.params.id);

        if (index === -1) {
            return res.status(404).json({ success: false, message: 'Blog article not found' });
        }

        const existing = blogs[index];
        const {
            title,
            slug,
            excerpt,
            content,
            coverImage,
            category,
            tags,
            author,
            readTime,
            status,
            featured
        } = req.body;

        const updated = {
            ...existing,
            title: title !== undefined ? title.trim() : existing.title,
            slug: slug !== undefined ? slug.trim() : existing.slug,
            excerpt: excerpt !== undefined ? excerpt.trim() : existing.excerpt,
            content: content !== undefined ? content : existing.content,
            coverImage: coverImage !== undefined ? coverImage : existing.coverImage,
            category: category !== undefined ? category : existing.category,
            tags: tags !== undefined ? (Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim())) : existing.tags,
            author: {
                ...existing.author,
                ...(author || {})
            },
            readTime: readTime !== undefined ? readTime : existing.readTime,
            status: status !== undefined ? status : existing.status,
            featured: featured !== undefined ? Boolean(featured) : existing.featured,
            updatedAt: new Date().toISOString().split('T')[0]
        };

        blogs[index] = updated;
        writeBlogs(blogs);

        console.log('[Blogs API] Updated blog:', updated.title, `(${updated.id})`);
        return res.json({ success: true, data: updated });
    } catch (err) {
        console.error('[Blogs API] Error updating blog:', err);
        return res.status(500).json({ success: false, message: 'Failed to update blog article' });
    }
});

/**
 * DELETE /api/blogs/:id
 */
router.delete('/:id', (req, res) => {
    try {
        const blogs = readBlogs();
        const initialLength = blogs.length;
        const filtered = blogs.filter(b => b.id !== req.params.id && b.slug !== req.params.id);

        if (filtered.length === initialLength) {
            return res.status(404).json({ success: false, message: 'Blog article not found' });
        }

        writeBlogs(filtered);
        console.log('[Blogs API] Deleted blog id:', req.params.id);
        return res.json({ success: true, message: 'Blog article deleted successfully' });
    } catch (err) {
        console.error('[Blogs API] Error deleting blog:', err);
        return res.status(500).json({ success: false, message: 'Failed to delete blog article' });
    }
});

/**
 * GET /api/blogs/automation-status
 * Inspect automation schedule, next run, and daily topic
 */
router.get('/automation/status', (req, res) => {
    try {
        const status = getSchedulerStatus();
        return res.json({ success: true, data: status });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Error checking automation status' });
    }
});

/**
 * POST /api/blogs/automation/trigger
 * Manually trigger AI draft generation and email alert with optional custom topic/tone
 */
router.post('/automation/trigger', async (req, res) => {
    try {
        console.log('[Blogs API] On-demand draft generation requested with payload:', req.body);
        const options = req.body || {};
        const result = await triggerDraftNow(options);
        if (result.success) {
            return res.json({
                success: true,
                message: 'Technical draft synthesized and executive alert dispatched to administrator.',
                data: result.draft
            });
        }
        return res.status(500).json({ success: false, message: result.error });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

/**
 * POST /api/blogs/:id/regenerate-image
 * Regenerate AI cover photograph for an existing article with optional visual direction
 */
router.post('/:id/regenerate-image', async (req, res) => {
    try {
        const { id } = req.params;
        const options = req.body || {};
        console.log(`[Blogs API] Regenerate cover image requested for article id: ${id}`);
        const result = await regenerateArticleCover(id, options);
        return res.json({
            success: true,
            message: 'Cover photograph successfully regenerated.',
            data: result
        });
    } catch (err) {
        console.error('[Blogs API] Error regenerating cover image:', err);
        return res.status(500).json({ success: false, message: err.message || 'Image regeneration failed' });
    }
});

module.exports = router;

