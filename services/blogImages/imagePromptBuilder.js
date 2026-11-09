/**
 * Image Prompt Builder
 * Converts an image brief into a camera-calibrated photographic prompt.
 * Preserves the TechyArts visual identity: photorealistic, dark architectural,
 * cinematic lighting, with zero text or cartoon artifacts.
 */

const CAMERA_ANGLES = [
    'Eye-level cinematic depth of field with 50mm prime lens',
    'Low-angle architectural perspective with soft foreground bokeh',
    'Tight macro detail with crisp focus on physical texture and shallow depth',
    'Wide architectural interior view with strong linear perspective'
];

const LIGHTING_CONFIGS = [
    'Dramatic low-key cinematic directional lighting, ambient dark slate shadows with soft violet rim illumination',
    'Cool architectural daylight mixed with warm tungsten studio spotlights and dark matte obsidian surfaces',
    'Moody chiaroscuro lighting, deep charcoal tones punctuated by glowing fiber-optic indicators',
    'Clean industrial lighting with soft diffuse reflections across anodized brushed metals'
];

/**
 * Build photographic generation prompt
 */
function buildPhotographicPrompt(brief, options = {}) {
    const {
        environment = 'Enterprise Server Infrastructure',
        focalSubject = 'Server racks with fiber optic routing',
        lighting = 'Low-key architectural lighting with subtle rim light',
        colorPalette = 'Deep charcoal, slate, obsidian, subtle electric violet',
        mood = 'Architectural, refined, engineering precision'
    } = brief;

    // Deterministic selection based on title hash to ensure varied yet consistent compositions
    const hash = (brief.title || '').split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const cameraAngle = CAMERA_ANGLES[hash % CAMERA_ANGLES.length];
    const lightingConfig = options.lighting || LIGHTING_CONFIGS[hash % LIGHTING_CONFIGS.length];

    const promptParts = [
        `Authentic editorial photograph of ${focalSubject}.`,
        `Setting: ${environment}.`,
        `Composition: 16:9 landscape framing, ${cameraAngle}.`,
        `Lighting: ${lightingConfig}.`,
        `Color grading: ${colorPalette}, filmic dynamic range.`,
        `Atmosphere: ${mood}, crisp textural fidelity on brushed metal, matte polymer, and polished dark glass surfaces.`,
        'Shot on Hasselblad H6D-100c medium format camera with 50mm f/1.8 lens, natural optical bokeh, realistic physical depth.',
        'CRITICAL CONSTRAINTS: Pure photography only. Absolutely NO text, NO typography, NO letters, NO numbers, NO watermarks, NO brand logos, NO cartoon, NO anime, NO 3D render, NO plastic textures, NO fake CGI.'
    ];

    const finalPrompt = promptParts.join(' ');
    console.log('[ImagePromptBuilder] Generated photographic prompt:', finalPrompt.slice(0, 140) + '...');

    return {
        prompt: finalPrompt,
        cameraAngle,
        lightingConfig,
        brief
    };
}

module.exports = {
    buildPhotographicPrompt,
    CAMERA_ANGLES,
    LIGHTING_CONFIGS
};
