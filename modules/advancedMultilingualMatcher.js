'use strict';

/**
 * Advanced Multilingual Matching Module
 * Provides robust fuzzy matching and LLM-powered semantic understanding
 * for room names, device names, and commands across languages
 */

// Configuration constants
const SIMILARITY_THRESHOLD = 0.6; // Minimum similarity score for matches
const PHONETIC_THRESHOLD = 0.7; // Threshold for phonetic matching
const LLM_CONFIDENCE_THRESHOLD = 0.8; // Threshold for LLM-based matches

/**
 * Calculate Levenshtein distance between two strings
 * @param {string} a - First string
 * @param {string} b - Second string
 * @returns {number} Edit distance
 */
function levenshteinDistance(a, b) {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(null));

  for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= b.length; j++) matrix[j][0] = j;

  for (let j = 1; j <= b.length; j++) {
    for (let i = 1; i <= a.length; i++) {
      const indicator = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,     // deletion
        matrix[j - 1][i] + 1,     // insertion
        matrix[j - 1][i - 1] + indicator // substitution
      );
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Calculate similarity score between two strings (0-1)
 * @param {string} a - First string
 * @param {string} b - Second string
 * @returns {number} Similarity score
 */
function calculateSimilarity(a, b) {
  if (!a || !b) return 0;
  const maxLength = Math.max(a.length, b.length);
  if (maxLength === 0) return 1;
  const distance = levenshteinDistance(a.toLowerCase(), b.toLowerCase());
  return 1 - (distance / maxLength);
}

/**
 * Advanced Unicode normalization for multilingual text
 * @param {string} text - Text to normalize
 * @returns {string} Normalized text
 */
function normalizeUnicode(text) {
  if (!text) return '';

  return text
    .normalize('NFD') // Decompose characters
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .toLowerCase()
    .trim()
    // Handle common character variations
    .replace(/[äæ]/g, 'a')
    .replace(/[öø]/g, 'o')
    .replace(/[üù]/g, 'u')
    .replace(/[ñ]/g, 'n')
    .replace(/[ç]/g, 'c')
    .replace(/[ß]/g, 'ss');
}

/**
 * Remove common definite articles from room names
 * @param {string} roomName - Room name to process
 * @param {string} language - Language code
 * @returns {string} Room name without articles
 */
function removeDefiniteArticles(roomName, language = 'en') {
  if (!roomName) return '';

  const articlePatterns = {
    'sv': /(en|et|n)$/i,           // Swedish: -en, -et, -n
    'no': /(en|et|a)$/i,           // Norwegian: -en, -et, -a
    'da': /(en|et)$/i,             // Danish: -en, -et
    'de': /^(der|die|das)\s+/i,    // German: der, die, das
    'fr': /^(le|la|les|l')\s+/i,   // French: le, la, les, l'
    'es': /^(el|la|los|las)\s+/i,  // Spanish: el, la, los, las
    'it': /^(il|la|lo|gli|le)\s+/i, // Italian: il, la, lo, gli, le
    'pt': /^(o|a|os|as)\s+/i,      // Portuguese: o, a, os, as
    'nl': /^(de|het)\s+/i,         // Dutch: de, het
    'en': /^(the)\s+/i             // English: the
  };

  const pattern = articlePatterns[language];
  if (pattern) {
    return roomName.replace(pattern, '').trim();
  }

  return roomName;
}

/**
 * Generate phonetic variations of a word for better matching
 * @param {string} word - Word to generate variations for
 * @returns {Array} Array of phonetic variations
 */
function generatePhoneticVariations(word) {
  if (!word) return [];

  const variations = [word.toLowerCase()];
  let current = word.toLowerCase();

  // Common phonetic substitutions
  const substitutions = [
    [/ä/g, 'a'], [/ö/g, 'o'], [/ü/g, 'u'],
    [/å/g, 'a'], [/æ/g, 'ae'], [/ø/g, 'o'],
    [/ç/g, 'c'], [/ñ/g, 'n'], [/ß/g, 'ss'],
    [/ph/g, 'f'], [/th/g, 't'], [/ck/g, 'k'],
    [/x/g, 'ks'], [/z/g, 's'], [/v/g, 'w']
  ];

  substitutions.forEach(([pattern, replacement]) => {
    if (pattern.test(current)) {
      variations.push(current.replace(pattern, replacement));
    }
  });

  return [...new Set(variations)];
}

/**
 * Advanced fuzzy matching with multiple algorithms
 * @param {string} input - Input string to match
 * @param {Array} candidates - Array of candidate strings
 * @param {string} language - Language code for context
 * @returns {Object} Best match with confidence score
 */
function fuzzyMatch(input, candidates, language = 'en') {
  if (!input || !candidates || candidates.length === 0) {
    return { match: null, confidence: 0, method: 'none' };
  }

  const normalizedInput = normalizeUnicode(input);
  const inputWithoutArticles = removeDefiniteArticles(normalizedInput, language);
  const inputVariations = generatePhoneticVariations(inputWithoutArticles);

  let bestMatch = null;
  let bestConfidence = 0;
  let bestMethod = 'none';

  candidates.forEach(candidate => {
    const normalizedCandidate = normalizeUnicode(candidate);
    const candidateWithoutArticles = removeDefiniteArticles(normalizedCandidate, language);
    const candidateVariations = generatePhoneticVariations(candidateWithoutArticles);

    // Method 1: Exact match (highest confidence)
    if (normalizedInput === normalizedCandidate) {
      bestMatch = candidate;
      bestConfidence = 1.0;
      bestMethod = 'exact';
      return;
    }

    // Method 2: Exact match without articles
    if (inputWithoutArticles === candidateWithoutArticles) {
      if (0.95 > bestConfidence) {
        bestMatch = candidate;
        bestConfidence = 0.95;
        bestMethod = 'exact_no_articles';
      }
    }

    // Method 3: Substring matching
    if (normalizedInput.includes(candidateWithoutArticles) ||
        candidateWithoutArticles.includes(inputWithoutArticles)) {
      const confidence = Math.min(inputWithoutArticles.length, candidateWithoutArticles.length) /
                        Math.max(inputWithoutArticles.length, candidateWithoutArticles.length);
      if (confidence > bestConfidence && confidence >= SIMILARITY_THRESHOLD) {
        bestMatch = candidate;
        bestConfidence = confidence;
        bestMethod = 'substring';
      }
    }

    // Method 4: Levenshtein similarity
    const similarity = calculateSimilarity(inputWithoutArticles, candidateWithoutArticles);
    if (similarity > bestConfidence && similarity >= SIMILARITY_THRESHOLD) {
      bestMatch = candidate;
      bestConfidence = similarity;
      bestMethod = 'levenshtein';
    }

    // Method 5: Phonetic variations
    for (const inputVar of inputVariations) {
      for (const candidateVar of candidateVariations) {
        const phoneticSimilarity = calculateSimilarity(inputVar, candidateVar);
        if (phoneticSimilarity > bestConfidence && phoneticSimilarity >= PHONETIC_THRESHOLD) {
          bestMatch = candidate;
          bestConfidence = phoneticSimilarity * 0.9; // Slightly lower confidence for phonetic
          bestMethod = 'phonetic';
        }
      }
    }
  });

  return {
    match: bestMatch,
    confidence: bestConfidence,
    method: bestMethod,
    normalizedInput: normalizedInput,
    inputWithoutArticles: inputWithoutArticles
  };
}

/**
 * LLM-powered semantic matching for cross-language understanding
 * @param {string} input - Input room name
 * @param {Array} candidates - Available room names
 * @param {string} language - Input language
 * @param {Function} llmFunction - LLM function for semantic matching
 * @returns {Promise<Object>} Semantic match result
 */
async function semanticMatch(input, candidates, language, llmFunction) {
  if (!input || !candidates || candidates.length === 0 || !llmFunction) {
    return { match: null, confidence: 0, method: 'semantic_unavailable' };
  }

  try {
    const prompt = `You are a multilingual smart home assistant. Help match a room name to available rooms.

Input room name: "${input}" (language: ${language})
Available rooms: ${candidates.map(room => `"${room}"`).join(', ')}

Task: Find the best semantic match for the input room name among the available rooms. Consider:
- Translation equivalents (e.g., "garden" = "trädgård" = "jardin")
- Spelling variations and typos
- Definite articles (e.g., "trädgården" vs "trädgård")
- Character encoding differences (e.g., "ä" vs "a")

Respond with ONLY a JSON object in this exact format:
{
  "match": "exact_room_name_from_list_or_null",
  "confidence": 0.0-1.0,
  "reasoning": "brief_explanation"
}

If no good match exists, return null for match and 0.0 for confidence.`;

    const response = await llmFunction(prompt);

    // Parse LLM response
    let result;
    try {
      // Handle both string and object responses
      if (typeof response === 'object' && response !== null) {
        // Response is already a parsed object
        result = response;
      } else if (typeof response === 'string') {
        // Response is a string, need to parse JSON
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        const jsonStr = jsonMatch ? jsonMatch[0] : response;
        result = JSON.parse(jsonStr);
      } else {
        throw new Error('Invalid response type');
      }
    } catch (parseError) {
      console.warn('Failed to parse LLM response for semantic matching:', parseError);
      return { match: null, confidence: 0, method: 'semantic_parse_error' };
    }

    // Validate the result
    if (result.match && !candidates.includes(result.match)) {
      console.warn('LLM returned invalid room name:', result.match);
      return { match: null, confidence: 0, method: 'semantic_invalid' };
    }

    return {
      match: result.match,
      confidence: Math.min(Math.max(result.confidence || 0, 0), 1), // Clamp to 0-1
      method: 'semantic',
      reasoning: result.reasoning || 'No reasoning provided'
    };

  } catch (error) {
    console.error('Error in semantic matching:', error);
    return { match: null, confidence: 0, method: 'semantic_error' };
  }
}

/**
 * Find the best room match using advanced fuzzy matching
 * @param {string} roomName - Room name to match
 * @param {Array} availableRooms - Array of available room names
 * @param {string} language - Language code
 * @returns {Object} Match result with confidence
 */
function findBestRoomMatch(roomName, availableRooms, language = 'en') {
  return fuzzyMatch(roomName, availableRooms, language);
}

/**
 * Comprehensive room matching with multiple strategies
 * @param {string} roomName - Room name to match
 * @param {Array} availableRooms - Array of available room names
 * @param {string} language - Language code
 * @param {Function} llmFunction - Optional LLM function for semantic matching
 * @returns {Promise<Object>} Best match result
 */
async function comprehensiveRoomMatch(roomName, availableRooms, language = 'en', llmFunction = null) {
  if (!roomName || !availableRooms || availableRooms.length === 0) {
    return { match: null, confidence: 0, method: 'no_input' };
  }

  // Strategy 1: Advanced fuzzy matching
  const fuzzyResult = findBestRoomMatch(roomName, availableRooms, language);

  // If fuzzy matching gives high confidence, use it
  if (fuzzyResult.confidence >= 0.9) {
    return fuzzyResult;
  }

  // Strategy 2: LLM semantic matching (if available and fuzzy confidence is low)
  if (llmFunction && fuzzyResult.confidence < LLM_CONFIDENCE_THRESHOLD) {
    try {
      const semanticResult = await semanticMatch(roomName, availableRooms, language, llmFunction);

      // Use semantic result if it has higher confidence
      if (semanticResult.confidence > fuzzyResult.confidence) {
        return semanticResult;
      }
    } catch (error) {
      console.warn('Semantic matching failed, falling back to fuzzy matching:', error);
    }
  }

  // Return the best result we have
  return fuzzyResult;
}

/**
 * Batch process multiple room names for matching
 * @param {Array} roomNames - Array of room names to match
 * @param {Array} availableRooms - Array of available room names
 * @param {string} language - Language code
 * @param {Function} llmFunction - Optional LLM function
 * @returns {Promise<Array>} Array of match results
 */
async function batchRoomMatch(roomNames, availableRooms, language = 'en', llmFunction = null) {
  const results = [];

  for (const roomName of roomNames) {
    const result = await comprehensiveRoomMatch(roomName, availableRooms, language, llmFunction);
    results.push({
      input: roomName,
      ...result
    });
  }

  return results;
}

module.exports = {
  levenshteinDistance,
  calculateSimilarity,
  normalizeUnicode,
  removeDefiniteArticles,
  generatePhoneticVariations,
  fuzzyMatch,
  semanticMatch,
  findBestRoomMatch,
  comprehensiveRoomMatch,
  batchRoomMatch,
  SIMILARITY_THRESHOLD,
  PHONETIC_THRESHOLD,
  LLM_CONFIDENCE_THRESHOLD
};
