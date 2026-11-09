/**
 * Centralized Google Gemini Client & Configuration
 * Uses the official @google/genai SDK with automatic retry, backoff, and model fallback.
 */

const { GoogleGenAI } = require('@google/genai');
const path = require('path');
const fs = require('fs');

// Attempt to load .env from server or root if not already loaded
try {
    const serverEnv = path.join(process.cwd(), 'server', '.env');
    if (fs.existsSync(serverEnv)) {
        const envContent = fs.readFileSync(serverEnv, 'utf8');
        envContent.split('\n').forEach(line => {
            const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
            if (match) {
                const key = match[1];
                let value = match[2] || '';
                if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
                if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
                if (!process.env[key]) process.env[key] = value.trim();
            }
        });
    }
} catch {
    // Ignore env loading errors
}

// Configurable Model Identifiers
const CONFIG = {
    // Priority order for text models; handles temporary 503 high demand or 404 deprecations
    textModelCandidates: [
        process.env.GEMINI_TEXT_MODEL,
        process.env.GEMINI_ARTICLE_MODEL,
        'gemini-3.5-flash',
        'gemini-3.5-flash-lite',
        'gemini-flash-latest',
        'gemini-3.6-flash',
        'gemini-3.1-flash-lite'
    ].filter(Boolean),

    // Priority order for image models
    imageModelCandidates: [
        process.env.GEMINI_IMAGE_MODEL,
        'gemini-2.5-flash-image',
        'gemini-3.1-flash-image',
        'gemini-3-pro-image',
        'imagen-3.0-generate-002'
    ].filter(Boolean),

    topicModel: process.env.GEMINI_TOPIC_MODEL || 'gemini-3.5-flash',
    researchModel: process.env.GEMINI_RESEARCH_MODEL || 'gemini-3.5-flash',
    articleModel: process.env.GEMINI_ARTICLE_MODEL || 'gemini-3.5-flash',
    editorialModel: process.env.GEMINI_EDITORIAL_MODEL || 'gemini-3.5-flash',
    imagePromptModel: process.env.GEMINI_IMAGE_PROMPT_MODEL || 'gemini-3.5-flash',

    timeoutMs: parseInt(process.env.GEMINI_TIMEOUT_MS || '60000', 10),
    maxRetries: 1,
    initialRetryDelayMs: 800
};

function withTimeout(promise, ms, label = 'Operation') {
    return Promise.race([
        promise,
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
        )
    ]);
}

let cachedClient = null;

function getApiKey() {
    return (
        process.env.GEMINI_API_KEY ||
        process.env.GOOGLE_GENAI_API_KEY ||
        process.env.GOOGLE_API_KEY ||
        ''
    ).trim();
}

function getGenAIClient() {
    const apiKey = getApiKey();
    if (!apiKey) {
        throw new Error('GEMINI_API_KEY is not configured in the environment.');
    }
    if (!cachedClient) {
        cachedClient = new GoogleGenAI({ apiKey });
    }
    return cachedClient;
}

/**
 * Utility delay with jitter
 */
function sleep(ms) {
    const jitter = Math.floor(Math.random() * 400);
    return new Promise((resolve) => setTimeout(resolve, ms + jitter));
}

/**
 * Robust JSON Parser that strips markdown code blocks (```json ... ```)
 */
function parseJsonSafe(rawText) {
    if (!rawText || typeof rawText !== 'string') {
        throw new Error('Empty or non-string response to parse as JSON');
    }
    let cleaned = rawText.trim();
    // Strip markdown code fences if present
    if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```[a-zA-Z]*\n?/, '').replace(/\n?```$/, '').trim();
    }
    // Find first '{' or '[' and last '}' or ']'
    const firstBrace = cleaned.search(/[\{\[]/);
    const lastBrace = Math.max(cleaned.lastIndexOf('}'), cleaned.lastIndexOf(']'));
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        cleaned = cleaned.slice(firstBrace, lastBrace + 1);
    }
    return JSON.parse(cleaned);
}

/**
 * Execute Gemini content generation with retry, exponential backoff, and model fallback
 */
async function generateContent({
    prompt,
    systemInstruction,
    modelOverride,
    responseJson = false,
    temperature = 0.7,
    maxOutputTokens = 4096,
    tools = undefined,
    timeoutMs = CONFIG.timeoutMs
}) {
    const ai = getGenAIClient();
    const modelsToTry = modelOverride
        ? [modelOverride, ...CONFIG.textModelCandidates.filter((m) => m !== modelOverride)]
        : [...CONFIG.textModelCandidates];

    let lastError = null;

    for (const model of modelsToTry) {
        for (let attempt = 1; attempt <= CONFIG.maxRetries; attempt++) {
            try {
                const config = {
                    temperature,
                    maxOutputTokens
                };

                if (responseJson) {
                    config.responseMimeType = 'application/json';
                }

                if (systemInstruction) {
                    config.systemInstruction = systemInstruction;
                }

                if (tools && Array.isArray(tools) && tools.length > 0) {
                    config.tools = tools;
                }

                const response = await withTimeout(
                    ai.models.generateContent({
                        model,
                        contents: prompt,
                        config
                    }),
                    timeoutMs,
                    `Gemini generateContent (${model})`
                );

                const text = response?.text;
                if (!text) {
                    throw new Error(`Model ${model} returned empty content.`);
                }

                if (responseJson) {
                    const parsed = parseJsonSafe(text);
                    return {
                        model,
                        text,
                        data: parsed,
                        rawResponse: response
                    };
                }

                return {
                    model,
                    text,
                    rawResponse: response
                };
            } catch (err) {
                lastError = err;
                const errMsg = err.message || '';
                const isRetryable =
                    errMsg.includes('503') ||
                    errMsg.includes('429') ||
                    errMsg.includes('UNAVAILABLE') ||
                    errMsg.includes('RESOURCE_EXHAUSTED') ||
                    errMsg.includes('high demand') ||
                    errMsg.includes('rate limit');

                const isModelUnavailable =
                    errMsg.includes('404') ||
                    errMsg.includes('NOT_FOUND') ||
                    errMsg.includes('no longer available');

                if (isModelUnavailable) {
                    console.warn(`[GeminiClient] Model ${model} is unavailable. Switching to next candidate...`);
                    break; // Switch to next model in list immediately
                }

                if (isRetryable && attempt < CONFIG.maxRetries) {
                    const delay = CONFIG.initialRetryDelayMs * Math.pow(2, attempt - 1);
                    console.warn(`[GeminiClient] Attempt ${attempt} on ${model} failed (${errMsg.slice(0, 100)}). Retrying in ${delay}ms...`);
                    await sleep(delay);
                } else {
                    console.warn(`[GeminiClient] Model ${model} failed attempt ${attempt}: ${errMsg.slice(0, 100)}`);
                    break; // Try next model candidate
                }
            }
        }
    }

    throw new Error(`All Gemini model candidates failed. Last error: ${lastError?.message || 'Unknown error'}`);
}

/**
 * Generate image using Gemini image models
 * Returns raw image Buffer and mimeType
 */
async function generateImage({ prompt, modelOverride, aspectRatio = '16:9' }) {
    const ai = getGenAIClient();
    const modelsToTry = modelOverride
        ? [modelOverride, ...CONFIG.imageModelCandidates.filter((m) => m !== modelOverride)]
        : [...CONFIG.imageModelCandidates];

    let lastError = null;

    for (const model of modelsToTry) {
        try {
            console.log(`[GeminiClient] Requesting photographic generation with image model: ${model}...`);

            // Try generateContent with image response modality first (Standard in new GenAI SDK)
            try {
                const response = await withTimeout(
                    ai.models.generateContent({
                        model,
                        contents: prompt,
                        config: {
                            responseModalities: ['IMAGE']
                        }
                    }),
                    25000,
                    `Gemini generateImage (${model})`
                );

                const parts = response?.candidates?.[0]?.content?.parts || [];
                for (const part of parts) {
                    if (part.inlineData && part.inlineData.data) {
                        return {
                            model,
                            imageBuffer: Buffer.from(part.inlineData.data, 'base64'),
                            mimeType: part.inlineData.mimeType || 'image/jpeg'
                        };
                    }
                }
            } catch (innerErr) {
                // If generateContent fails, attempt generateImages (for Vertex/Imagen endpoints)
                if (typeof ai.models.generateImages === 'function') {
                    const imgRes = await ai.models.generateImages({
                        model,
                        prompt,
                        config: {
                            numberOfImages: 1,
                            aspectRatio
                        }
                    });
                    const genImg = imgRes?.generatedImages?.[0]?.image;
                    if (genImg && genImg.imageBytes) {
                        return {
                            model,
                            imageBuffer: Buffer.from(genImg.imageBytes, 'base64'),
                            mimeType: 'image/jpeg'
                        };
                    }
                }
                throw innerErr;
            }
        } catch (err) {
            lastError = err;
            console.warn(`[GeminiClient] Image model ${model} failed: ${err.message.slice(0, 150)}`);
        }
    }

    throw new Error(`Gemini Image Generation failed on all candidates: ${lastError?.message || 'Unknown error'}`);
}

module.exports = {
    CONFIG,
    getApiKey,
    getGenAIClient,
    generateContent,
    generateImage,
    parseJsonSafe
};
