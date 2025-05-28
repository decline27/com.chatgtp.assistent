'use strict';

/**
 * Unified Command Parser
 * Combines command parsing and room matching in a single LLM call
 * This replaces the multi-step approach with a more efficient unified approach
 */

const https = require('https');
const { logger } = require('./logger');
const { ErrorHandler, ErrorTypes } = require('./errorHandler');
const { getKeyManager } = require('./secureKeyManager'); // Changed from './keyManager'
const { safeJsonParse } = require('./utils/jsonUtils');
const { normalizeUnicode, removeDefiniteArticles } = require('./advancedMultilingualMatcher');

/**
 * Unified command parsing with advanced room matching
 * Combines both command parsing and room matching in a single LLM call
 * @param {string} commandText - The natural language command
 * @param {Array} availableRooms - Array of available room names from Homey
 * @param {string} detectedLanguage - Language detected from speech recognition
 * @param {Object} homeState - Complete home state with devices and zones
 * @param {Object} options - Optional configuration
 * @returns {Promise<Object>} Unified parsing result with matched rooms and parsed commands
 */
async function parseCommandWithUnifiedMatching(commandText, availableRooms = [], detectedLanguage = 'en', homeState = {}, options = {}) {
  // Input validation
  if (!commandText || typeof commandText !== 'string') {
    return { error: 'Command text must be a non-empty string' };
  }

  if (commandText.length > 10000) {
    return { error: 'Command text too long (max 10000 characters)' };
  }

  const keyManager = getKeyManager();
  if (!keyManager.hasKey('openai')) {
    logger.error('ChatGPT not initialized - missing API key');
    return { error: 'ChatGPT must be initialized with an API key first' };
  }

  logger.log('Processing unified command parsing:', commandText.substring(0, 100) + (commandText.length > 100 ? '...' : ''));

  try {
    // Build the unified prompt that handles both room matching and command parsing
    const prompt = buildUnifiedPrompt(commandText, availableRooms, detectedLanguage, homeState, options);
    
    // Make the ChatGPT API call
    const result = await makeUnifiedChatGPTCall(prompt);
    
    if (result.error) {
      return result;
    }

    // Validate and enhance the result
    const enhancedResult = enhanceUnifiedResult(result, commandText, availableRooms, detectedLanguage);
    
    logger.log('Unified parsing completed:', JSON.stringify(enhancedResult, null, 2));
    return enhancedResult;

  } catch (error) {
    logger.error('Error in unified command parsing:', error);
    return { error: `Failed to parse command: ${error.message}` };
  }
}

/**
 * Build a unified prompt that handles both room matching and command parsing
 * @param {string} commandText - The command to parse
 * @param {Array} availableRooms - Available rooms
 * @param {string} language - Detected language
 * @param {Object} homeState - Home state with devices and zones
 * @param {Object} options - Configuration options
 * @returns {string} The constructed prompt
 */
function buildUnifiedPrompt(commandText, availableRooms, language, homeState, options = {}) {
  const { maxDevices = 50 } = options;

  // Prepare room context with normalization hints
  const roomContext = buildRoomMatchingContext(availableRooms, language);
  
  // Prepare device context (limited for prompt size)
  const deviceContext = buildDeviceContext(homeState, maxDevices);

  // Build the comprehensive prompt
  return `You are an advanced smart home assistant that combines room matching and command parsing in a single step.

TASK: Parse the command AND match room names using advanced multilingual understanding.

AVAILABLE ROOMS:
${roomContext}

AVAILABLE DEVICES:
${deviceContext}

COMMAND TO PROCESS: "${commandText}" (Language: ${language})

UNIFIED PARSING RULES:

1. ROOM MATCHING - Use advanced fuzzy matching and semantic understanding:
   - Handle spelling variations, typos, and character differences (ä→a, ö→o)
   - Remove definite articles (Swedish: -en/-et, German: der/die/das, etc.)
   - Understand semantic equivalents across languages:
     * "garden" = "trädgård" = "jardin" = "garten"
     * "living room" = "vardagsrum" = "salon" = "wohnzimmer"
     * "kitchen" = "kök" = "cuisine" = "küche"
     * "bedroom" = "sovrum" = "chambre" = "schlafzimmer"
   - Prefer exact matches, then fuzzy matches, then semantic matches
   - Consider context from the command to resolve ambiguity

2. COMMAND PARSING - Extract actions and targets:
   - Understand commands in ANY language
   - Normalize actions to English: "turn_on", "turn_off", "dim", etc.
   - Identify device filters if specified
   - Handle multi-step commands

3. OUTPUT FORMAT - Return structured JSON with room matching details:

For SUCCESSFUL parsing:
{
  "success": true,
  "command": {
    "room": "<matched_room_name>",
    "command": "<normalized_action>",
    "device_filter": "<device_type_if_specified>",
    "parameters": {...}
  },
  "room_matching": {
    "original": "<original_room_mention>",
    "matched": "<final_matched_room>",
    "method": "exact|fuzzy|semantic",
    "confidence": 0.0-1.0,
    "alternatives": ["<other_possible_matches>"]
  },
  "language_processing": {
    "detected_language": "${language}",
    "normalized_input": "<normalized_command_text>",
    "extracted_entities": {
      "rooms": ["<room_mentions>"],
      "actions": ["<action_words>"],
      "devices": ["<device_mentions>"]
    }
  }
}

For MULTI-COMMANDS:
{
  "success": true,
  "commands": [
    {
      "room": "<room1>",
      "command": "<action1>",
      "device_filter": "<type1>"
    },
    {
      "room": "<room2>", 
      "command": "<action2>"
    }
  ],
  "room_matching": {
    "<original_room1>": {
      "matched": "<final_room1>",
      "method": "exact|fuzzy|semantic",
      "confidence": 0.0-1.0
    },
    "<original_room2>": {
      "matched": "<final_room2>",
      "method": "exact|fuzzy|semantic", 
      "confidence": 0.0-1.0
    }
  }
}

For STATUS QUERIES:
{
  "success": true,
  "query_type": "status",
  "room": "<matched_room_if_specified>",
  "scope": "room|global",
  "room_matching": {...}
}

For ERRORS:
{
  "success": false,
  "error": "<detailed_error_message>",
  "suggestions": ["<helpful_suggestions>"],
  "room_matching": {
    "attempted": "<what_was_tried>",
    "available": ["<closest_matches>"]
  }
}

MULTILINGUAL EXAMPLES:

Input: "encender las luces del dormitorio" 
Output: {
  "success": true,
  "command": {"room": "bedroom", "command": "turn_on", "device_filter": "light"},
  "room_matching": {"original": "dormitorio", "matched": "bedroom", "method": "semantic", "confidence": 0.95}
}

Input: "sätt på vardagsrummet" 
Output: {
  "success": true, 
  "command": {"room": "living room", "command": "turn_on"},
  "room_matching": {"original": "vardagsrummet", "matched": "living room", "method": "semantic", "confidence": 0.90}
}

IMPORTANT: Always provide detailed room_matching information showing how room names were resolved.`;
}

/**
 * Build room matching context with normalization hints
 * @param {Array} availableRooms - Available room names
 * @param {string} language - Detected language
 * @returns {string} Room context for the prompt
 */
function buildRoomMatchingContext(availableRooms, language) {
  if (!availableRooms || availableRooms.length === 0) {
    return "No specific rooms available - use generic room names.";
  }

  // Create normalized versions for fuzzy matching hints
  const roomsWithNormalization = availableRooms.map(room => {
    const normalized = normalizeUnicode(room.toLowerCase());
    const withoutArticles = removeDefiniteArticles(normalized, language);
    
    return {
      original: room,
      normalized: normalized,
      withoutArticles: withoutArticles
    };
  });

  let context = `Available rooms (${availableRooms.length}):\n`;
  roomsWithNormalization.forEach((room, index) => {
    context += `${index + 1}. "${room.original}"`;
    if (room.normalized !== room.original.toLowerCase()) {
      context += ` (normalized: "${room.normalized}")`;
    }
    if (room.withoutArticles !== room.normalized) {
      context += ` (without articles: "${room.withoutArticles}")`;
    }
    context += '\n';
  });

  // Add multilingual matching hints
  context += `\nMATCHING HINTS:
- Handle character variations: ä→a, ö→o, ü→u, å→a
- Remove definite articles: Swedish (-en, -et), German (der, die, das), etc.
- Semantic equivalents: garden=trädgård, kitchen=kök, bedroom=sovrum, living room=vardagsrum`;

  return context;
}

/**
 * Build device context for the prompt
 * @param {Object} homeState - Home state with devices and zones
 * @param {number} maxDevices - Maximum devices to include
 * @returns {string} Device context for the prompt
 */
function buildDeviceContext(homeState, maxDevices) {
  if (!homeState.devices) {
    return "No devices available.";
  }

  const devices = Object.values(homeState.devices);
  const limitedDevices = devices.slice(0, maxDevices);

  let context = `Available devices (showing ${limitedDevices.length} of ${devices.length}):\n`;
  
  // Group by room for better context
  const devicesByRoom = {};
  limitedDevices.forEach(device => {
    const roomName = homeState.zones?.[device.zone]?.name || 'Unknown';
    if (!devicesByRoom[roomName]) {
      devicesByRoom[roomName] = [];
    }
    devicesByRoom[roomName].push(device);
  });

  Object.entries(devicesByRoom).forEach(([roomName, roomDevices]) => {
    context += `\n${roomName}:\n`;
    roomDevices.forEach(device => {
      context += `  - ${device.name} (${device.class})\n`;
    });
  });

  return context;
}

/**
 * Make the unified ChatGPT API call
 * @param {string} prompt - The unified prompt
 * @returns {Promise<Object>} The API response
 */
async function makeUnifiedChatGPTCall(prompt) {
  const keyManager = getKeyManager();
  
  const data = JSON.stringify({
    model: 'gpt-4o-mini',
    messages: [{
      role: 'user',
      content: prompt
    }],
    temperature: 0.1
  });

  const authHeader = keyManager.createAuthHeader('openai', 'Bearer');

  const options = {
    hostname: 'api.openai.com',
    path: '/v1/chat/completions',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(data),
      'Authorization': authHeader
    }
  };

  return new Promise((resolve) => {
    const req = https.request(options, res => {
      let responseBody = '';
      const MAX_RESPONSE_SIZE = 1024 * 1024; // 1MB limit

      res.on('data', chunk => {
        responseBody += chunk;
        if (responseBody.length > MAX_RESPONSE_SIZE) {
          resolve({ error: 'Response too large from ChatGPT API' });
          return;
        }
      });

      res.on('end', () => {
        try {
          if (!responseBody) {
            resolve({ error: 'Empty response from ChatGPT API' });
            return;
          }

          const response = safeJsonParse(responseBody, 'ChatGPT API response');
          if (response.error) {
            resolve({ error: response.error });
            return;
          }

          if (response.data.error) {
            resolve({ error: `ChatGPT API error: ${response.data.error.message}` });
            return;
          }

          const commandText = response.data.choices?.[0]?.message?.content?.trim();
          if (!commandText) {
            resolve({ error: 'No content in ChatGPT response' });
            return;
          }

          const commandResult = safeJsonParse(commandText, 'ChatGPT command response');
          if (commandResult.error) {
            resolve({ error: commandResult.error });
            return;
          }

          resolve(commandResult.data);

        } catch (error) {
          logger.error('Error processing ChatGPT response:', error);
          resolve({ error: `Failed to process response: ${error.message}` });
        }
      });
    });

    req.on('error', error => {
      logger.error('Network error during ChatGPT API request:', error);
      resolve({ error: `Network error: ${error.message}` });
    });

    req.write(data);
    req.end();
  });
}

/**
 * Enhance and validate the unified result
 * @param {Object} result - Raw result from ChatGPT
 * @param {string} originalCommand - Original command text
 * @param {Array} availableRooms - Available rooms
 * @param {string} language - Detected language
 * @returns {Object} Enhanced result
 */
function enhanceUnifiedResult(result, originalCommand, availableRooms, language) {
  // Validate the basic structure
  if (!result || typeof result !== 'object') {
    return { 
      success: false, 
      error: 'Invalid response structure from unified parser',
      fallback_needed: true
    };
  }

  // If it's already marked as failed, return as-is
  if (result.success === false) {
    return result;
  }

  // Validate room matching results
  if (result.room_matching) {
    result.room_matching = validateRoomMatching(result.room_matching, availableRooms);
  }

  // Add metadata
  result.processing_info = {
    method: 'unified_parsing',
    timestamp: new Date().toISOString(),
    original_command: originalCommand,
    detected_language: language,
    available_rooms_count: availableRooms.length
  };

  // Validate command structure based on type
  if (result.command) {
    // Single command validation
    if (!result.command.command) {
      return {
        success: false,
        error: 'Missing action in parsed command',
        fallback_needed: true
      };
    }
  } else if (result.commands) {
    // Multi-command validation
    for (const cmd of result.commands) {
      if (!cmd.command) {
        return {
          success: false,
          error: 'Missing action in one of the parsed commands',
          fallback_needed: true
        };
      }
    }
  } else if (!result.query_type) {
    // Neither command nor query - this is an error
    return {
      success: false,
      error: 'No valid command or query found in response',
      fallback_needed: true
    };
  }

  return result;
}

/**
 * Validate room matching results
 * @param {Object} roomMatching - Room matching result
 * @param {Array} availableRooms - Available rooms
 * @returns {Object} Validated room matching result
 */
function validateRoomMatching(roomMatching, availableRooms) {
  if (!roomMatching || typeof roomMatching !== 'object') {
    return roomMatching;
  }

  // For single room matching
  if (roomMatching.matched) {
    const isValidRoom = availableRooms.some(room => 
      room.toLowerCase() === roomMatching.matched.toLowerCase()
    );
    
    if (!isValidRoom) {
      roomMatching.validation_warning = `Matched room "${roomMatching.matched}" not found in available rooms`;
      roomMatching.confidence = Math.max(0, (roomMatching.confidence || 0) - 0.2);
    }
  }

  // For multi-room matching (object with room mappings)
  Object.keys(roomMatching).forEach(key => {
    const match = roomMatching[key];
    if (match && match.matched) {
      const isValidRoom = availableRooms.some(room => 
        room.toLowerCase() === match.matched.toLowerCase()
      );
      
      if (!isValidRoom) {
        match.validation_warning = `Matched room "${match.matched}" not found in available rooms`;
        match.confidence = Math.max(0, (match.confidence || 0) - 0.2);
      }
    }
  });

  return roomMatching;
}

/**
 * Fallback to legacy parsing if unified parsing fails
 * @param {string} commandText - Original command
 * @param {Array} availableRooms - Available rooms
 * @param {string} language - Detected language
 * @param {Object} homeState - Home state
 * @returns {Promise<Object>} Fallback result
 */
async function fallbackToLegacyParsing(commandText, availableRooms, language, homeState) {
  logger.log('Falling back to legacy parsing method');
  
  try {
    // Use the existing system as fallback
    const { constructPrompt } = require('./chatgptHelper');
    const { parseCommand } = require('./chatgpt');
    const { processMultilingualCommand } = require('./multilingualProcessor');

    // Process the command with the existing multilingual processor
    const processedCmd = processMultilingualCommand(commandText, language, availableRooms);
    
    // Build prompt using existing helper
    const prompt = constructPrompt(processedCmd.processed || commandText, homeState);
    
    // Parse using existing parser
    const legacyResult = await parseCommand(prompt);
    
    // Convert to unified format
    return {
      success: !legacyResult.error,
      command: legacyResult.error ? undefined : legacyResult,
      error: legacyResult.error,
      processing_info: {
        method: 'legacy_fallback',
        timestamp: new Date().toISOString(),
        original_command: commandText,
        detected_language: language,
        preprocessed_confidence: processedCmd.confidence
      }
    };
    
  } catch (error) {
    logger.error('Legacy fallback also failed:', error);
    return {
      success: false,
      error: `Both unified and legacy parsing failed: ${error.message}`,
      processing_info: {
        method: 'fallback_failed',
        timestamp: new Date().toISOString()
      }
    };
  }
}

module.exports = {
  parseCommandWithUnifiedMatching,
  fallbackToLegacyParsing,
  buildUnifiedPrompt,
  enhanceUnifiedResult
};
