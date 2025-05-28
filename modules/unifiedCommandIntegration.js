'use strict';

/**
 * Integration Helper for Unified Command Parser
 * Provides smooth transition from current multi-step approach to unified parsing
 * Includes backward compatibility and gradual migration support
 */

const { logger } = require('./logger');
const { parseCommandWithUnifiedMatching, fallbackToLegacyParsing } = require('./unifiedCommandParser');
const { constructPrompt } = require('./chatgptHelper');
const { parseCommand } = require('./chatgpt');
const { processMultilingualCommand } = require('./multilingualProcessor');

/**
 * Enhanced command parsing with unified approach and fallback
 * This is the new main entry point that replaces parseCommandWithState
 * @param {string} commandText - The natural language command
 * @param {string} detectedLanguage - Language detected from speech recognition
 * @param {Object} homeState - Complete home state with devices and zones
 * @param {Object} options - Configuration options
 * @returns {Promise<Object>} Unified parsing result
 */
async function parseCommandWithEnhancedMatching(commandText, detectedLanguage = 'en', homeState = {}, options = {}) {
  const {
    useUnifiedParsing = true,
    fallbackOnFailure = true,
    confidenceThreshold = 0.7,
    maxRetries = 1
  } = options;

  // Extract available rooms from home state
  const availableRooms = extractAvailableRooms(homeState);
  
  logger.log('Starting enhanced command parsing:', {
    command: commandText.substring(0, 50) + (commandText.length > 50 ? '...' : ''),
    language: detectedLanguage,
    roomsAvailable: availableRooms.length,
    useUnified: useUnifiedParsing
  });

  let result;
  let retryCount = 0;

  // Try unified parsing first (if enabled)
  if (useUnifiedParsing) {
    try {
      result = await parseCommandWithUnifiedMatching(
        commandText, 
        availableRooms, 
        detectedLanguage, 
        homeState, 
        options
      );

      // Check if unified parsing was successful
      if (result.success && !result.fallback_needed) {
        // Validate confidence if room matching occurred
        const roomMatchingConfidence = getRoomMatchingConfidence(result);
        
        if (roomMatchingConfidence >= confidenceThreshold) {
          logger.log('Unified parsing successful with high confidence:', roomMatchingConfidence);
          return transformToLegacyFormat(result);
        } else {
          logger.log('Unified parsing had low confidence:', roomMatchingConfidence, 'attempting fallback');
        }
      } else {
        logger.log('Unified parsing indicated fallback needed');
      }
    } catch (error) {
      logger.error('Unified parsing failed with error:', error);
    }
  }

  // Fall back to legacy parsing
  if (fallbackOnFailure) {
    while (retryCount < maxRetries) {
      try {
        logger.log(`Attempting fallback parsing (attempt ${retryCount + 1}/${maxRetries})`);
        result = await fallbackToLegacyParsing(commandText, availableRooms, detectedLanguage, homeState);
        
        if (result.success) {
          logger.log('Fallback parsing successful');
          return transformToLegacyFormat(result);
        }
        
        retryCount++;
      } catch (error) {
        logger.error(`Fallback parsing attempt ${retryCount + 1} failed:`, error);
        retryCount++;
      }
    }
  }

  // If all methods failed, return error
  return {
    error: 'All parsing methods failed. Please try rephrasing your command.',
    processing_info: {
      method: 'all_failed',
      unified_attempted: useUnifiedParsing,
      fallback_attempted: fallbackOnFailure,
      retry_count: retryCount
    }
  };
}

/**
 * Hybrid parsing approach - tries unified for complex cases, legacy for simple ones
 * @param {string} commandText - The command text
 * @param {string} detectedLanguage - Detected language
 * @param {Object} homeState - Home state
 * @param {Object} options - Options
 * @returns {Promise<Object>} Parsing result
 */
async function parseCommandWithHybridApproach(commandText, detectedLanguage, homeState, options = {}) {
  const commandComplexity = analyzeCommandComplexity(commandText, detectedLanguage);
  
  // Use unified parsing for complex commands, legacy for simple ones
  if (commandComplexity.useUnified) {
    logger.log('Command complexity suggests unified parsing:', commandComplexity);
    return parseCommandWithEnhancedMatching(commandText, detectedLanguage, homeState, {
      ...options,
      useUnifiedParsing: true
    });
  } else {
    logger.log('Command complexity suggests legacy parsing:', commandComplexity);
    return parseCommandWithEnhancedMatching(commandText, detectedLanguage, homeState, {
      ...options,
      useUnifiedParsing: false
    });
  }
}

/**
 * Analyze command complexity to determine parsing approach
 * @param {string} commandText - Command text
 * @param {string} language - Detected language
 * @returns {Object} Complexity analysis
 */
function analyzeCommandComplexity(commandText, language) {
  const analysis = {
    useUnified: false,
    reasons: [],
    complexity_score: 0
  };

  const text = commandText.toLowerCase();

  // Factors that suggest unified parsing
  const complexityFactors = [
    {
      condition: language !== 'en',
      weight: 2,
      reason: 'Non-English language benefits from advanced multilingual matching'
    },
    {
      condition: /\band\b|\bthen\b|\bafter\b|\balso\b/i.test(text),
      weight: 2,
      reason: 'Multi-step commands'
    },
    {
      condition: /trädgård|vardagsrum|kök|sovrum|badrum|kontor/i.test(text),
      weight: 3,
      reason: 'Contains Swedish room names that need advanced matching'
    },
    {
      condition: /salon|chambre|cuisine|bureau|jardin/i.test(text),
      weight: 2,
      reason: 'Contains French room names'
    },
    {
      condition: /wohnzimmer|schlafzimmer|küche|büro|garten/i.test(text),
      weight: 2,
      reason: 'Contains German room names'
    },
    {
      condition: /[äöüåæø]/i.test(text),
      weight: 2,
      reason: 'Contains special characters that need normalization'
    },
    {
      condition: text.includes('ä') || text.includes('ö') || text.includes('ü'),
      weight: 1,
      reason: 'Contains diacritical marks'
    },
    {
      condition: /(en|et|n)$/i.test(text.split(' ').pop()),
      weight: 1,
      reason: 'Possible definite article that needs removal'
    },
    {
      condition: text.length > 50,
      weight: 1,
      reason: 'Long command may benefit from advanced parsing'
    }
  ];

  // Evaluate complexity factors
  complexityFactors.forEach(factor => {
    if (factor.condition) {
      analysis.complexity_score += factor.weight;
      analysis.reasons.push(factor.reason);
    }
  });

  // Use unified parsing if complexity score is high enough
  analysis.useUnified = analysis.complexity_score >= 3;

  return analysis;
}

/**
 * Extract available rooms from home state
 * @param {Object} homeState - Home state with zones
 * @returns {Array} Array of room names
 */
function extractAvailableRooms(homeState) {
  if (!homeState.zones) {
    return [];
  }

  return Object.values(homeState.zones)
    .map(zone => zone.name)
    .filter(name => name && name.trim().length > 0);
}

/**
 * Get room matching confidence from unified result
 * @param {Object} result - Unified parsing result
 * @returns {number} Confidence score (0-1)
 */
function getRoomMatchingConfidence(result) {
  if (!result.room_matching) {
    return 1.0; // No room matching needed, so confidence is high
  }

  // Single room matching
  if (result.room_matching.confidence !== undefined) {
    return result.room_matching.confidence;
  }

  // Multi-room matching - return lowest confidence
  let lowestConfidence = 1.0;
  Object.values(result.room_matching).forEach(match => {
    if (match && match.confidence !== undefined) {
      lowestConfidence = Math.min(lowestConfidence, match.confidence);
    }
  });

  return lowestConfidence;
}

/**
 * Transform unified result to legacy format for backward compatibility
 * @param {Object} unifiedResult - Result from unified parser
 * @returns {Object} Legacy format result
 */
function transformToLegacyFormat(unifiedResult) {
  if (!unifiedResult.success) {
    return {
      error: unifiedResult.error,
      _unifiedResult: unifiedResult
    };
  }

  // Handle single commands
  if (unifiedResult.command) {
    const legacyCommand = { ...unifiedResult.command };
    legacyCommand._roomMatching = unifiedResult.room_matching;
    legacyCommand._processingInfo = unifiedResult.processing_info;
    return legacyCommand;
  }

  // Handle multi-commands
  if (unifiedResult.commands) {
    const legacyResult = {
      commands: unifiedResult.commands,
      _roomMatching: unifiedResult.room_matching,
      _processingInfo: unifiedResult.processing_info
    };
    return legacyResult;
  }

  // Handle status queries
  if (unifiedResult.query_type) {
    const legacyResult = {
      query_type: unifiedResult.query_type,
      room: unifiedResult.room,
      scope: unifiedResult.scope,
      _roomMatching: unifiedResult.room_matching,
      _processingInfo: unifiedResult.processing_info
    };
    return legacyResult;
  }

  // Fallback
  return {
    error: 'Unable to transform unified result to legacy format',
    _unifiedResult: unifiedResult
  };
}

/**
 * Backwards compatible wrapper for existing parseCommandWithState
 * This can be used as a drop-in replacement
 * @param {string} commandText - Command text
 * @param {string} detectedLanguage - Detected language
 * @param {Object} homeState - Home state
 * @returns {Promise<Object>} Legacy format result
 */
async function parseCommandWithStateEnhanced(commandText, detectedLanguage = 'en', homeState = {}) {
  // Use hybrid approach by default for backward compatibility
  return parseCommandWithHybridApproach(commandText, detectedLanguage, homeState, {
    useUnifiedParsing: true,
    fallbackOnFailure: true,
    confidenceThreshold: 0.7
  });
}

/**
 * Configuration options for different migration phases
 */
const MigrationConfigs = {
  // Phase 1: Conservative - use unified only for complex cases
  CONSERVATIVE: {
    useUnifiedParsing: true,
    fallbackOnFailure: true,
    confidenceThreshold: 0.8,
    complexityThreshold: 4
  },
  
  // Phase 2: Balanced - use unified for most cases
  BALANCED: {
    useUnifiedParsing: true,
    fallbackOnFailure: true,
    confidenceThreshold: 0.7,
    complexityThreshold: 2
  },
  
  // Phase 3: Aggressive - prefer unified parsing
  AGGRESSIVE: {
    useUnifiedParsing: true,
    fallbackOnFailure: true,
    confidenceThreshold: 0.6,
    complexityThreshold: 1
  },
  
  // Legacy only - for comparison/debugging
  LEGACY_ONLY: {
    useUnifiedParsing: false,
    fallbackOnFailure: false
  }
};

module.exports = {
  parseCommandWithEnhancedMatching,
  parseCommandWithHybridApproach,
  parseCommandWithStateEnhanced,
  analyzeCommandComplexity,
  extractAvailableRooms,
  getRoomMatchingConfidence,
  transformToLegacyFormat,
  MigrationConfigs
};
