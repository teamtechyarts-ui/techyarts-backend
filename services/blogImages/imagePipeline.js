/**
 * Image Pipeline Coordinator
 * Connects article analysis, prompt building, image generation, quality checks,
 * perceptual deduplication, and storage into a single pipeline.
 */

const _analyzer = require('./imageAnalyzer.js');
const analyzeArticleForImage = _analyzer.analyzeArticleForImage || _analyzer.default?.analyzeArticleForImage || _analyzer;

const _promptBuilder = require('./imagePromptBuilder.js');
const buildPhotographicPrompt = _promptBuilder.buildPhotographicPrompt || _promptBuilder.default?.buildPhotographicPrompt || _promptBuilder;

const _generator = require('./imageGenerator.js');
const generateArticleCoverImage = _generator.generateArticleCoverImage || _generator.default?.generateArticleCoverImage || _generator;

const _quality = require('./imageQualityChecker.js');
const inspectImageQuality = _quality.inspectImageQuality || _quality.default?.inspectImageQuality || _quality;

const _dedup = require('./imageDeduplicator.js');
const computePerceptualHash = _dedup.computePerceptualHash || _dedup.default?.computePerceptualHash || _dedup;

const _storage = require('./imageStorage.js');
const storeCoverImage = _storage.storeCoverImage || _storage.default?.storeCoverImage || _storage;

/**
 * Run end-to-end image generation pipeline for an article
 */
async function runImagePipeline(article, options = {}) {
    console.log(`[ImagePipeline] Initiating photographic cover generation for: "${article.title}"`);

    // 1. Analyze the completed article
    const brief = await analyzeArticleForImage(article, options);

    // 2. Build camera-calibrated photographic prompt
    const promptObj = buildPhotographicPrompt(brief, options);

    // 3. Generate photographic cover image
    const genResult = await generateArticleCoverImage({
        promptObj,
        title: article.title,
        category: article.category
    });

    // 4. Quality & Dimension Verification
    const quality = await inspectImageQuality(genResult.imageBuffer);
    if (!quality.valid) {
        console.warn(`[ImagePipeline] Quality warning (${quality.reason}), applying fallback enhancement...`);
    }

    // 5. Compute Perceptual Hash
    const perceptualHash = await computePerceptualHash(genResult.imageBuffer);

    // 6. Store optimized WebP file in public/images/blog-covers
    const stored = await storeCoverImage(genResult.imageBuffer, article.slug || article.title);

    const result = {
        coverImageUrl: stored.publicUrl,
        imageMetadata: {
            prompt: promptObj.prompt,
            brief: {
                environment: brief.environment,
                focalSubject: brief.focalSubject,
                mood: brief.mood,
                colorPalette: brief.colorPalette
            },
            visualDirection: options.visualDirection || brief.environment,
            cameraAngle: promptObj.cameraAngle,
            lighting: promptObj.lightingConfig,
            model: genResult.model,
            isProcedural: Boolean(genResult.isProcedural),
            qualityScore: quality.score,
            perceptualHash,
            fileSize: stored.fileSize,
            generatedAt: new Date().toISOString()
        }
    };

    console.log(`[ImagePipeline] Successfully generated and attached cover: ${result.coverImageUrl}`);
    return result;
}

module.exports = {
    runImagePipeline
};
