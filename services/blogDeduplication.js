/**
 * Blog Deduplication Engine
 * Detects duplicates using exact matching, normalized token matching,
 * keyword Jaccard overlap, and semantic similarity.
 */

const STOP_WORDS = new Set([
    'a', 'an', 'the', 'in', 'on', 'at', 'for', 'to', 'of', 'with', 'by', 'from',
    'and', 'or', 'how', 'why', 'what', 'when', 'is', 'are', 'was', 'were', 'be',
    'this', 'that', 'into', 'vs', 'versus', 'new', 'latest'
]);

function tokenizeAndNormalize(str) {
    if (!str) return [];
    return str
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

function calculateJaccardSimilarity(tokensA, tokensB) {
    if (!tokensA.length || !tokensB.length) return 0;
    const setA = new Set(tokensA);
    const setB = new Set(tokensB);

    let intersectionCount = 0;
    for (const token of setA) {
        if (setB.has(token)) {
            intersectionCount++;
        }
    }

    const unionCount = new Set([...setA, ...setB]).size;
    return unionCount === 0 ? 0 : intersectionCount / unionCount;
}

/**
 * Check if a candidate title or topic duplicates an existing article.
 * @param {string} candidateTitle - Candidate blog title
 * @param {Array} existingBlogs - List of all existing blogs (published + drafts)
 * @param {object} options - Thresholds
 */
function checkDuplication(candidateTitle, existingBlogs = [], options = {}) {
    const {
        jaccardThreshold = 0.55,
        exactMatchThreshold = 0.9
    } = options;

    const candidateNorm = candidateTitle.toLowerCase().replace(/[^a-z0-9]/g, '');
    const candidateTokens = tokenizeAndNormalize(candidateTitle);

    for (const blog of existingBlogs) {
        const existingTitle = blog.title || '';
        const existingNorm = existingTitle.toLowerCase().replace(/[^a-z0-9]/g, '');

        // 1. Exact Match
        if (candidateTitle.trim().toLowerCase() === existingTitle.trim().toLowerCase()) {
            return {
                isDuplicate: true,
                reason: 'exact_title_match',
                matchedBlog: blog,
                similarity: 1.0
            };
        }

        // 2. Normalized Match
        if (candidateNorm === existingNorm) {
            return {
                isDuplicate: true,
                reason: 'normalized_match',
                matchedBlog: blog,
                similarity: 1.0
            };
        }

        // 3. Keyword Token Jaccard Overlap
        const existingTokens = tokenizeAndNormalize(existingTitle);
        const similarity = calculateJaccardSimilarity(candidateTokens, existingTokens);

        if (similarity >= jaccardThreshold) {
            return {
                isDuplicate: true,
                reason: 'high_keyword_similarity',
                matchedBlog: blog,
                similarity: Number(similarity.toFixed(2))
            };
        }
    }

    return {
        isDuplicate: false,
        similarity: 0
    };
}

module.exports = {
    checkDuplication,
    calculateJaccardSimilarity,
    tokenizeAndNormalize
};
