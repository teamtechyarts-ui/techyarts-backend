/**
 * Image Analyzer
 * Analyzes the completed article text to extract its concrete technical subject,
 * architectural concepts, and engineering environment to formulate a photographic brief.
 */

const _gemini = require('../geminiClient.js');
const generateContent = _gemini.generateContent || _gemini.default?.generateContent;
const CONFIG = _gemini.CONFIG || _gemini.default?.CONFIG;

const PHYSICAL_ENVIRONMENTS = [
    {
        name: 'Enterprise Server Infrastructure',
        keywords: ['server', 'cloud', 'edge', 'distributed', 'infrastructure', 'cluster', 'data center'],
        setting: 'Rows of monolithic matte-black server racks with glowing subtle violet and cyan fiber optic cable looms, polished dark concrete floor, shallow depth of field, dramatic moody lighting'
    },
    {
        name: 'Senior Architect Workstation',
        keywords: ['code', 'typescript', 'react', 'frontend', 'engineering', 'cicd', 'agent'],
        setting: 'Minimalist high-end developer desk with brushed obsidian mechanical keyboard, matte display showing terminal telemetry in low ambient light, architectural blueprints, warm tungsten and soft violet reflections'
    },
    {
        name: 'Cybersecurity Operations Center',
        keywords: ['security', 'vulnerability', 'auth', 'protection', 'token', 'policy', 'firewall'],
        setting: 'High-security network operations bridge, dark glass partition, banks of telemetry monitors cast soft blue and purple radiance across an industrial slate conference table'
    },
    {
        name: 'Micro-Hardware & Silicon Laboratory',
        keywords: ['hardware', 'microcontroller', 'silicon', 'chip', 'latency', 'memory', 'cpu'],
        setting: 'Extreme macro close-up of a high-performance bare circuit board, exposed silicon dies, gold traces, precision solder points, and micro capacitors with cinematic directional spotlighting'
    },
    {
        name: 'Global Fiber & Network Routing',
        keywords: ['network', 'protocol', 'crawler', 'traffic', 'transit', 'throughput', 'bandwidth'],
        setting: 'Intricately organized network patch bay with high-density fiber optic transceivers, glass cables with pulsed internal illumination, industrial anodized aluminum mounting brackets'
    }
];

/**
 * Analyze completed article and build structured photographic brief
 */
async function analyzeArticleForImage(article, options = {}) {
    const { title = '', category = '', content = '', excerpt = '' } = article;
    console.log(`[ImageAnalyzer] Analyzing completed article: "${title}" (${category})`);

    // If visual direction override provided by admin
    if (options.visualDirection) {
        return {
            title,
            category,
            technicalSubject: title,
            environment: options.visualDirection,
            focalSubject: options.visualDirection,
            colorPalette: 'Deep charcoal, slate obsidian, subtle electric violet (#7C4DFF), crisp ivory',
            lighting: 'Cinematic low-key lighting with directional rim glow',
            mood: 'Sophisticated, architectural, high-end editorial'
        };
    }

    try {
        const prompt = `
You are the Creative Photography Director at TechyArts.
Analyze this completed technical software engineering article:

TITLE: "${title}"
CATEGORY: "${category}"
EXCERPT: "${excerpt}"
CONTENT SAMPLE: "${content.slice(0, 1000)}"

TASK: Create a photographic brief for an editorial cover photograph.
REQUIREMENTS:
1. Must depict REAL PHYSICAL OBJECTS or REAL PHYSICAL ENVIRONMENTS (e.g. server racks, fiber optic conduits, developer mechanical hardware, laboratory testing rig, network patch bays).
2. NEVER suggest abstract concepts, drawings, floating glowing holograms, or cartoon characters.
3. Suggest a realistic environment and focal element.

Return valid JSON:
{
  "technicalSubject": "Primary engineering subject",
  "environment": "Physical setting (e.g., Enterprise Server Infrastructure / Developer Hardware Workstation)",
  "focalSubject": "Specific physical element in foreground",
  "lighting": "Cinematic directional rim lighting, cool ambient with subtle violet fill",
  "colorPalette": "Deep charcoal, matte black, slate, subtle electric violet, warm tungsten highlight",
  "mood": "Quiet, architectural, senior engineering rigor"
}
`;

        const res = await generateContent({
            prompt,
            responseJson: true,
            modelOverride: CONFIG.imagePromptModel,
            temperature: 0.3
        });

        if (res.data && res.data.environment && res.data.focalSubject) {
            return {
                title,
                category,
                ...res.data
            };
        }
    } catch (err) {
        console.warn('[ImageAnalyzer] AI analysis returned error, applying algorithmic environment selector:', err.message);
    }

    // Algorithmic Selection based on content keywords
    const combinedText = `${title} ${category} ${excerpt}`.toLowerCase();
    let bestMatch = PHYSICAL_ENVIRONMENTS[0];

    for (const env of PHYSICAL_ENVIRONMENTS) {
        const hits = env.keywords.filter((kw) => combinedText.includes(kw)).length;
        if (hits > 0) {
            bestMatch = env;
            break;
        }
    }

    return {
        title,
        category,
        technicalSubject: title,
        environment: bestMatch.name,
        focalSubject: bestMatch.setting,
        lighting: 'Low-key architectural lighting with subtle directional rim light',
        colorPalette: 'Deep charcoal, slate obsidian, subtle electric violet (#7C4DFF), crisp ivory highlights',
        mood: 'Sophisticated, precise, senior engineering editorial'
    };
}

module.exports = {
    analyzeArticleForImage,
    PHYSICAL_ENVIRONMENTS
};
