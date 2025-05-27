'use strict';

const https = require('https');
const { getKeyManager } = require('./secureKeyManager');
const { ErrorHandler, ErrorTypes } = require('./errorHandler');

let logger = console;
let isInitialized = false;

/**
 * Safely parse JSON with size limits and error handling
 * @param {string} jsonString - The JSON string to parse
 * @param {string} context - Context for error messages
 * @returns {Object} - {data: parsed object, error: error message}
 */
function safeJsonParse(jsonString, context = 'JSON') {
  try {
    // Validate input
    if (typeof jsonString !== 'string') {
      return { error: `${context} must be a string` };
    }

    if (jsonString.length === 0) {
      return { error: `${context} cannot be empty` };
    }

    if (jsonString.length > 100000) { // 100KB limit for JSON strings
      return { error: `${context} too large (${jsonString.length} characters, max 100000)` };
    }

    // Check for potential JSON bombs (deeply nested structures)
    const nestingLevel = (jsonString.match(/[\[{]/g) || []).length;
    if (nestingLevel > 50) {
      return { error: `${context} has too many nested levels (${nestingLevel}, max 50)` };
    }

    // Parse JSON
    const parsed = JSON.parse(jsonString);

    // Additional validation for parsed object
    if (parsed === null) {
      return { error: `${context} cannot be null` };
    }

    return { data: parsed };
  } catch (error) {
    if (error instanceof SyntaxError) {
      return { error: `Invalid ${context}: ${error.message}` };
    }
    return { error: `Failed to parse ${context}: ${error.message}` };
  }
}

/**
 * Validate ChatGPT API response structure
 * @param {Object} response - The parsed response object
 * @returns {Object} - {isValid: boolean, errors: string[]}
 */
function validateChatGPTResponse(response) {
  const errors = [];

  if (!response || typeof response !== 'object') {
    errors.push('Response must be an object');
    return { isValid: false, errors };
  }

  // Check for error response
  if (response.error) {
    if (typeof response.error !== 'object') {
      errors.push('Error field must be an object');
    } else {
      if (!response.error.message || typeof response.error.message !== 'string') {
        errors.push('Error message must be a string');
      }
    }
    return { isValid: errors.length === 0, errors };
  }

  // Check for successful response structure
  if (!response.choices || !Array.isArray(response.choices)) {
    errors.push('Response must have choices array');
  } else if (response.choices.length === 0) {
    errors.push('Choices array cannot be empty');
  } else {
    const choice = response.choices[0];
    if (!choice || typeof choice !== 'object') {
      errors.push('First choice must be an object');
    } else {
      if (!choice.message || typeof choice.message !== 'object') {
        errors.push('Choice must have message object');
      } else {
        if (!choice.message.content || typeof choice.message.content !== 'string') {
          errors.push('Message must have content string');
        }
      }
    }
  }

  return { isValid: errors.length === 0, errors };
}

/**
 * Validate command structure from ChatGPT
 * @param {Object} command - The parsed command object
 * @returns {Object} - {isValid: boolean, errors: string[]}
 */
function validateCommandStructure(command) {
  const errors = [];

  if (!command || typeof command !== 'object') {
    errors.push('Command must be an object');
    return { isValid: false, errors };
  }

  // Check for error command
  if (command.error) {
    if (typeof command.error !== 'string') {
      errors.push('Error field must be a string');
    }
    return { isValid: errors.length === 0, errors };
  }

  // Check for multi-command structure
  if (command.commands) {
    if (!Array.isArray(command.commands)) {
      errors.push('Commands field must be an array');
    } else if (command.commands.length === 0) {
      errors.push('Commands array cannot be empty');
    } else {
      command.commands.forEach((cmd, index) => {
        if (!cmd || typeof cmd !== 'object') {
          errors.push(`Command ${index} must be an object`);
        } else if (!cmd.command || typeof cmd.command !== 'string') {
          errors.push(`Command ${index} must have command string`);
        }
      });
    }
    return { isValid: errors.length === 0, errors };
  }

  // Check for single command structure
  if (!command.command || typeof command.command !== 'string') {
    errors.push('Command must have command string');
  }

  // Validate command has at least one target (room, device_id, or device_ids)
  const hasRoom = command.room && typeof command.room === 'string';
  const hasDeviceId = command.device_id && typeof command.device_id === 'string';
  const hasDeviceIds = command.device_ids && Array.isArray(command.device_ids);

  if (!hasRoom && !hasDeviceId && !hasDeviceIds) {
    errors.push('Command must specify room, device_id, or device_ids');
  }

  // Validate device_ids array if present
  if (hasDeviceIds) {
    if (command.device_ids.length === 0) {
      errors.push('device_ids array cannot be empty');
    } else {
      command.device_ids.forEach((id, index) => {
        if (!id || typeof id !== 'string') {
          errors.push(`device_ids[${index}] must be a non-empty string`);
        }
      });
    }
  }

  return { isValid: errors.length === 0, errors };
}

function initChatGPT(apiKey, customLogger = null) {
  // Input validation
  ErrorHandler.validateInput(apiKey && typeof apiKey === 'string', 'OpenAI API key is required and must be a string');

  try {
    // Store API key securely
    const keyManager = getKeyManager();
    keyManager.setKey('openai', apiKey, 'openai');

    if (customLogger) {
      logger = customLogger;
    }

    isInitialized = true;
    const keyInfo = keyManager.getKeyInfo('openai');
    logger.log(`ChatGPT module initialized securely (key hash: ${keyInfo.hash})`);
    return Promise.resolve();
  } catch (error) {
    throw ErrorHandler.wrap(error, ErrorTypes.AUTHENTICATION_ERROR, 'Failed to initialize ChatGPT');
  }
}

function parseCommand(prompt) {
  // Input validation
  ErrorHandler.validateInput(prompt && typeof prompt === 'string', 'Prompt must be a non-empty string');
  ErrorHandler.validateInput(prompt.length <= 10000, 'Prompt must be 10000 characters or less');

  const keyManager = getKeyManager();
  if (!keyManager.hasKey('openai')) {
    logger.error('ChatGPT not initialized - missing API key');
    return Promise.resolve({ error: 'ChatGPT must be initialized with an API key first' });
  }

  logger.log('Processing prompt:', prompt.substring(0, 100) + (prompt.length > 100 ? '...' : ''));

  const data = JSON.stringify({
    model: 'gpt-4o-mini', // Upgraded model for better reasoning
    messages: [{
      role: 'system',
      content: `You are a Homey home automation expert. Your task is to convert natural language commands into valid JSON that instructs Homey to control devices.

CRITICAL RULES:
1. ALWAYS output valid JSON only - no explanations or markdown
2. For SINGLE commands, use one of these formats:
   - Room command: {"room": "<roomName>", "command": "<action>"}
   - Device IDs: {"device_ids": ["id1", "id2"], "command": "<action>"}
   - Single device: {"device_id": "<deviceId>", "command": "<action>"}
   - Error: {"error": "<description>"}

3. For MULTIPLE commands (connected by "and", "then", etc.), use:
   - Multi-command: {"commands": [{"room": "<room1>", "command": "<action1>"}, {"room": "<room2>", "command": "<action2>"}]}

4. If a room is mentioned, ALWAYS use room format (never device_ids)
5. Commands must be: "turn_on", "turn_off", "dim", "set_temperature", "play_music", "stop_music", etc.
6. For ambiguous requests, prefer "turn_on" for lights
7. If unsure about device capabilities, use the most common action for that device type

Examples:
- "Turn on living room lights" → {"room": "living room", "command": "turn_on"}
- "Turn off bedroom lamp" → {"room": "bedroom", "command": "turn_off"}
- "Turn on lights and play music in living room" → {"commands": [{"room": "living room", "command": "turn_on", "device_filter": "light"}, {"room": "living room", "command": "play_music", "device_filter": "speaker"}]}
- "Dim kitchen lights and set temperature to 22" → {"commands": [{"room": "kitchen", "command": "dim", "device_filter": "light"}, {"room": "kitchen", "command": "set_temperature", "parameters": {"temperature": 22}}]}
- "Turn on bedroom lights then lock the front door" → {"commands": [{"room": "bedroom", "command": "turn_on", "device_filter": "light"}, {"device_id": "front_door_lock", "command": "lock"}]}`
    }, {
      role: 'user',
      content: prompt
    }],
    temperature: 0.1, // Slightly higher for more natural responses while maintaining consistency
  });

  logger.log('Sending request to ChatGPT API with configuration:', {
    model: 'gpt-4o-mini',
    messageCount: 2,
    temperature: 0.1
  });

  // Create secure authorization header
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
      let responseSize = 0;
      const MAX_RESPONSE_SIZE = 1024 * 1024; // 1MB limit

      res.on('data', chunk => {
        responseSize += chunk.length;

        // Check response size limit
        if (responseSize > MAX_RESPONSE_SIZE) {
          logger.error(`Response size exceeded limit: ${responseSize} bytes`);
          const error = ErrorHandler.api('Response from ChatGPT API too large', {
            responseSize,
            maxSize: MAX_RESPONSE_SIZE
          });
          resolve({ error: error.toUserMessage() });
          return;
        }

        responseBody += chunk;
      });

      res.on('end', () => {
        try {
          logger.log('Received raw response from ChatGPT API');

          // Validate response size before parsing
          if (responseBody.length === 0) {
            logger.error('Empty response from ChatGPT API');
            const error = ErrorHandler.api('Empty response from ChatGPT API');
            resolve({ error: error.toUserMessage() });
            return;
          }

          if (responseBody.length > MAX_RESPONSE_SIZE) {
            logger.error(`Response body too large: ${responseBody.length} bytes`);
            const error = ErrorHandler.api('Response from ChatGPT API too large', {
              responseSize: responseBody.length,
              maxSize: MAX_RESPONSE_SIZE
            });
            resolve({ error: error.toUserMessage() });
            return;
          }

          // Safe JSON parsing with validation
          const response = safeJsonParse(responseBody, 'ChatGPT API response');
          if (response.error) {
            resolve({ error: response.error });
            return;
          }

          // Validate response structure with comprehensive schema validation
          const validationResult = validateChatGPTResponse(response.data);
          if (!validationResult.isValid) {
            logger.error('Invalid response structure from ChatGPT API:', validationResult.errors);
            const error = ErrorHandler.api(`Invalid response structure: ${validationResult.errors.join(', ')}`);
            resolve({ error: error.toUserMessage() });
            return;
          }

          if (response.data.error) {
            logger.error('ChatGPT API error:', response.data.error);
            const error = ErrorHandler.api(`ChatGPT API error: ${response.data.error.message}`, {
              errorCode: response.data.error.code,
              errorType: response.data.error.type
            });
            resolve({ error: error.toUserMessage() });
            return;
          }

          try {
            const commandText = response.data.choices[0].message.content.trim();
            logger.log('Received command text from ChatGPT:', commandText.substring(0, 200) + (commandText.length > 200 ? '...' : ''));

            // Validate command text before parsing
            if (!commandText || typeof commandText !== 'string') {
              logger.error('Invalid command text from ChatGPT: not a string');
              const error = ErrorHandler.parsing('Invalid command text from ChatGPT response');
              resolve({ error: error.toUserMessage() });
              return;
            }

            if (commandText.length > 10000) {
              logger.error(`Command text too long: ${commandText.length} characters`);
              const error = ErrorHandler.parsing('Command text from ChatGPT too long', {
                commandLength: commandText.length,
                maxLength: 10000
              });
              resolve({ error: error.toUserMessage() });
              return;
            }

            // Safe JSON parsing for command
            const commandResult = safeJsonParse(commandText, 'ChatGPT command');
            if (commandResult.error) {
              resolve({ error: commandResult.error });
              return;
            }

            // Validate command structure
            const commandValidation = validateCommandStructure(commandResult.data);
            if (!commandValidation.isValid) {
              logger.error('Invalid command structure:', commandValidation.errors);
              const error = ErrorHandler.parsing(`Invalid command structure: ${commandValidation.errors.join(', ')}`);
              resolve({ error: error.toUserMessage() });
              return;
            }

            logger.log('Successfully parsed command:', JSON.stringify(commandResult.data, null, 2));
            resolve(commandResult.data);
          } catch (parseError) {
            logger.error('Failed to parse command from ChatGPT response:', parseError);
            const error = ErrorHandler.parsing('Failed to parse command from ChatGPT response', {
              originalError: parseError.message,
              responseLength: responseBody.length
            });
            resolve({ error: error.toUserMessage() });
          }
        } catch (error) {
          logger.error('Failed to process ChatGPT response:', error);
          const wrappedError = ErrorHandler.wrap(error, ErrorTypes.API_ERROR, 'Failed to process ChatGPT response');
          resolve({ error: wrappedError.toUserMessage() });
        }
      });
    });

    req.on('error', error => {
      logger.error('Network error during ChatGPT API request:', error);
      const networkError = ErrorHandler.network(`Network error during ChatGPT API request: ${error.message}`);
      resolve({ error: networkError.toUserMessage() });
    });

    req.write(data);
    req.end();
  });
}

module.exports = {
  initChatGPT,
  parseCommand
};
