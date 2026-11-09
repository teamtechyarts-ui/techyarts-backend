/**
 * Image Generator Service
 * Invokes Gemini Image Generation with rate-limit recovery and resilient AI photographic fallback.
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const _gemini = require('../geminiClient.js');
const generateImage = _gemini.generateImage || _gemini.default?.generateImage;
const CONFIG = _gemini.CONFIG || _gemini.default?.CONFIG;

const PRESETS_DIR = path.join(process.cwd(), 'public', 'images', 'blog-presets');

// Curated high-resolution royalty-free engineering stock photography (Unsplash)
const CURATED_TECH_PHOTOS = {
    'Enterprise Server Infrastructure': [
        'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=1600&auto=format&fit=crop&q=85',
        'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=1600&auto=format&fit=crop&q=85'
    ],
    'Senior Architect Workstation': [
        'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=1600&auto=format&fit=crop&q=85',
        'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=1600&auto=format&fit=crop&q=85'
    ],
    'Cybersecurity Operations Center': [
        'https://images.unsplash.com/photo-1563986768609-322da13575f3?w=1600&auto=format&fit=crop&q=85',
        'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=1600&auto=format&fit=crop&q=85'
    ],
    'Micro-Hardware & Silicon Laboratory': [
        'https://images.unsplash.com/photo-1518770660439-4636190af475?w=1600&auto=format&fit=crop&q=85',
        'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=1600&auto=format&fit=crop&q=85'
    ],
    'Global Fiber & Network Routing': [
        'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=1600&auto=format&fit=crop&q=85',
        'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1600&auto=format&fit=crop&q=85'
    ]
};

/**
 * AI Photographic Generation Engine via FLUX
 * Invoked when Gemini free-tier quota is 0 or unavailable.
 * Generates true 16:9 photorealistic editorial photography with no API key required.
 */
async function generateWithPollinationsAI({ prompt, title, visualDirection }) {
    try {
        console.log(`[ImageGenerator] Dispatching to AI Photography Engine (FLUX)...`);
        const cleanPrompt = `editorial high-end architectural photography, ${prompt || visualDirection || title}, realistic physical studio lighting, Hasselblad H6D-100c 50mm lens, 16:9 aspect ratio, 8k resolution, cinematic atmosphere, crisp details, no text, no watermark`;
        const seed = Math.abs((title || 'techyarts').split('').reduce((acc, char) => (acc * 31 + char.charCodeAt(0)) | 0, 0));
        const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(cleanPrompt)}?width=1280&height=720&model=flux&nologo=true&seed=${seed}`;

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 20000);
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeout);

        if (res.ok) {
            const arrayBuffer = await res.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            if (buffer.length > 5000) {
                console.log(`[ImageGenerator] AI Photography Engine (FLUX) returned ${buffer.length} bytes.`);
                return {
                    model: 'ai-flux-photographic-editorial',
                    imageBuffer: buffer,
                    mimeType: 'image/jpeg',
                    isProcedural: false
                };
            }
        }
    } catch (err) {
        console.warn(`[ImageGenerator] AI Photography Engine (FLUX) attempt failed (${err.message}). Proceeding to fallback...`);
    }
    return null;
}

/**
 * Editorial Photography Synthesis Engine (Curated Photography + Brand Lighting Overlay)
 * Never uses portfolio or client website assets.
 */
async function generateProceduralEditorialCover({ prompt = '', title = '', category = '', visualDirection = '' }) {
    console.log(`[ImageGenerator] Synthesizing editorial photograph for: "${title}" (${category})...`);

    const width = 1920;
    const height = 1080;
    const hash = (title || 'techyarts').split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);

    // Color accents based on TechyArts design system
    const accentColors = [
        { primary: '#7C4DFF', secondary: '#4F46E5', name: 'Electric Violet' },
        { primary: '#00F0FF', secondary: '#0284C7', name: 'Cyber Azure' },
        { primary: '#10B981', secondary: '#059669', name: 'Terminal Emerald' },
        { primary: '#F59E0B', secondary: '#D97706', name: 'Silicon Amber' }
    ];
    const accent = accentColors[hash % accentColors.length];

    const overlaySvg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <radialGradient id="rimGlow" cx="80%" cy="25%" r="60%">
                <stop offset="0%" stop-color="${accent.primary}" stop-opacity="0.25" />
                <stop offset="60%" stop-color="${accent.secondary}" stop-opacity="0.10" />
                <stop offset="100%" stop-color="#000000" stop-opacity="0" />
            </radialGradient>
            <linearGradient id="editorialVignette" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#030712" stop-opacity="0.30" />
                <stop offset="50%" stop-color="#000000" stop-opacity="0.05" />
                <stop offset="100%" stop-color="#030712" stop-opacity="0.55" />
            </linearGradient>
        </defs>
        <rect width="${width}" height="${height}" fill="url(#editorialVignette)" />
        <rect width="${width}" height="${height}" fill="url(#rimGlow)" />
    </svg>`;

    let baseBuffer = null;

    // 1. Try local preset file if exists in public/images/blog-presets
    if (fs.existsSync(PRESETS_DIR)) {
        try {
            const files = fs.readdirSync(PRESETS_DIR).filter((f) => /\.(jpg|jpeg|png|webp)$/i.test(f));
            if (files.length > 0) {
                const chosen = files[hash % files.length];
                const filePath = path.join(PRESETS_DIR, chosen);
                baseBuffer = fs.readFileSync(filePath);
            }
        } catch {
            // Preset directory read failed, continue to remote stock
        }
    }

    // 2. Try curated remote engineering photography
    if (!baseBuffer) {
        const pool = CURATED_TECH_PHOTOS[visualDirection] || CURATED_TECH_PHOTOS[category] || CURATED_TECH_PHOTOS['Senior Architect Workstation'];
        const chosenUrl = pool[hash % pool.length];
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 8000);
            const res = await fetch(chosenUrl, { signal: controller.signal });
            clearTimeout(timeout);
            if (res.ok) {
                const arr = await res.arrayBuffer();
                baseBuffer = Buffer.from(arr);
            }
        } catch (fetchErr) {
            console.warn('[ImageGenerator] Remote curated stock fetch failed:', fetchErr.message);
        }
    }

    // 3. Last-resort dark minimal TechyArts procedural canvas
    if (!baseBuffer) {
        baseBuffer = await sharp({
            create: {
                width,
                height,
                channels: 3,
                background: { r: 11, g: 15, b: 25 }
            }
        }).jpeg().toBuffer();
    }

    // Composite photo with brand lighting and convert to pristine WebP
    const imageBuffer = await sharp(baseBuffer)
        .resize(width, height, { fit: 'cover', position: 'center' })
        .modulate({ brightness: 1.05, saturation: 1.12 })
        .composite([{ input: Buffer.from(overlaySvg), blend: 'over' }])
        .webp({ quality: 90, effort: 4 })
        .toBuffer();

    return {
        model: 'techyarts-editorial-photography-v2',
        imageBuffer,
        mimeType: 'image/webp',
        isProcedural: true
    };
}

/**
 * Primary Generator Method
 */
async function generateArticleCoverImage({ promptObj, title, category }) {
    const prompt = typeof promptObj === 'string' ? promptObj : promptObj.prompt;
    const visualDirection = typeof promptObj === 'object' ? (promptObj.brief?.environment || promptObj.visualDirection) : '';

    // 1. Attempt Gemini GenAI Image API (if quota or enterprise model available)
    try {
        console.log('[ImageGenerator] Dispatching request to Gemini GenAI Image API...');
        const result = await generateImage({
            prompt,
            aspectRatio: '16:9'
        });

        if (result && result.imageBuffer && result.imageBuffer.length > 5000) {
            console.log(`[ImageGenerator] Gemini Image API returned ${result.imageBuffer.length} bytes using model ${result.model}.`);
            return {
                ...result,
                isProcedural: false
            };
        }
    } catch (err) {
        console.warn(`[ImageGenerator] Gemini Image API (${err.message.slice(0, 100)}). Deploying AI FLUX generation engine...`);
    }

    // 2. Attempt AI Photography Engine (FLUX) - Real AI generation with zero quota limits
    const aiResult = await generateWithPollinationsAI({ prompt, title, visualDirection });
    if (aiResult && aiResult.imageBuffer) {
        return aiResult;
    }

    // 3. Fallback to curated licensed tech photography & brand grading (NEVER client portfolio assets)
    return await generateProceduralEditorialCover({ prompt, title, category, visualDirection });
}

module.exports = {
    generateArticleCoverImage,
    generateProceduralEditorialCover
};
