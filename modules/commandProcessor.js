'use strict';

/**
 * Enhanced command preprocessing and natural language understanding
 * This module provides utilities to improve command parsing reliability
 * with multilingual support
 */

const {
  processMultilingualCommand,
  normalizeRoomName,
  normalizeAction,
  normalizeDeviceType
} = require('./multilingualProcessor');

/**
 * Preprocesses natural language commands to normalize and enhance them with multilingual support
 * @param {string} commandText - Raw command text
 * @param {string} detectedLanguage - Language detected from speech recognition
 * @param {Array} availableRooms - Optional array of available room names from Homey
 * @returns {object} Processed command with metadata
 */
function preprocessCommand(commandText, detectedLanguage = 'en', availableRooms = []) {
  const original = commandText;
  let processed = commandText.toLowerCase().trim();

  // First, process with multilingual support
  const multilingualResult = processMultilingualCommand(commandText, detectedLanguage, availableRooms);

  // Remove common filler words (language-agnostic)
  const fillerWords = ['please', 'can you', 'could you', 'would you', 'i want to', 'i need to'];
  fillerWords.forEach(filler => {
    processed = processed.replace(new RegExp(`\\b${filler}\\b`, 'gi'), '');
  });

  // Normalize common phrases
  const normalizations = {
    'switch on': 'turn on',
    'switch off': 'turn off',
    'power on': 'turn on',
    'power off': 'turn off',
    'shut off': 'turn off',
    'shut down': 'turn off',
    'activate': 'turn on',
    'deactivate': 'turn off',
    'enable': 'turn on',
    'disable': 'turn off',
    'brighten': 'turn on',
    'darken': 'turn off',
    'illuminate': 'turn on'
  };

  Object.entries(normalizations).forEach(([from, to]) => {
    processed = processed.replace(new RegExp(`\\b${from}\\b`, 'gi'), to);
  });

  // Apply multilingual normalizations
  if (multilingualResult.actions.length > 0) {
    multilingualResult.actions.forEach(action => {
      const normalizedAction = normalizeAction(action, detectedLanguage);
      if (normalizedAction !== action) {
        processed = processed.replace(new RegExp(`\\b${action}\\b`, 'gi'), normalizedAction);
      }
    });
  }

  if (multilingualResult.rooms.length > 0) {
    multilingualResult.rooms.forEach(room => {
      const normalizedRoom = normalizeRoomName(room, detectedLanguage, availableRooms);
      if (normalizedRoom !== room) {
        processed = processed.replace(new RegExp(`\\b${room}\\b`, 'gi'), normalizedRoom);
      }
    });
  }

  if (multilingualResult.deviceTypes.length > 0) {
    multilingualResult.deviceTypes.forEach(device => {
      const normalizedDevice = normalizeDeviceType(device, detectedLanguage);
      if (normalizedDevice !== device) {
        processed = processed.replace(new RegExp(`\\b${device}\\b`, 'gi'), normalizedDevice);
      }
    });
  }

  // Check for multi-command patterns (now language-aware)
  const isMultiCommand = detectMultiCommand(processed, detectedLanguage);

  // Extract intent and entities (enhanced with multilingual data)
  const intent = extractIntent(processed, multilingualResult);
  const entities = extractEntities(processed, multilingualResult);

  // Calculate confidence with multilingual factors
  const confidence = calculateConfidence(processed, intent, entities, multilingualResult);

  return {
    original,
    processed: processed.trim(),
    intent,
    entities,
    isMultiCommand,
    confidence,
    language: detectedLanguage,
    multilingualData: multilingualResult
  };
}

/**
 * Detects if a command contains multiple actions with multilingual support
 * @param {string} text - Processed command text
 * @param {string} language - Detected language
 * @returns {boolean} True if multiple commands detected
 */
function detectMultiCommand(text, language = 'en') {
  // Multilingual connectors
  const connectors = {
    'en': [/\band\b/i, /\bthen\b/i, /\balso\b/i, /\bplus\b/i, /\bafter that\b/i, /\bnext\b/i],
    'es': [/\by\b/i, /\bentonces\b/i, /\btambién\b/i, /\bademás\b/i, /\bdespués\b/i],
    'fr': [/\bet\b/i, /\bpuis\b/i, /\baussi\b/i, /\bensuite\b/i, /\baprès\b/i],
    'de': [/\bund\b/i, /\bdann\b/i, /\bauch\b/i, /\bdanach\b/i, /\banschließend\b/i],
    'it': [/\be\b/i, /\bpoi\b/i, /\banche\b/i, /\bdopo\b/i, /\bsuccessivamente\b/i],
    'pt': [/\be\b/i, /\bentão\b/i, /\btambém\b/i, /\bdepois\b/i, /\bem seguida\b/i],
    'nl': [/\ben\b/i, /\bdan\b/i, /\book\b/i, /\bdaarna\b/i, /\bvervolgens\b/i],
    'sv': [/\boch\b/i, /\bsedan\b/i, /\bäven\b/i, /\befter det\b/i, /\bdärefter\b/i]
  };

  // Common comma pattern
  const commaPattern = /,\s*(?=\w)/;

  // Get connectors for the detected language, fallback to English
  const languageConnectors = connectors[language] || connectors['en'];
  const allConnectors = [...languageConnectors, commaPattern];

  // Multilingual action verbs
  const actionVerbs = {
    'en': ['turn', 'set', 'dim', 'open', 'close', 'lock', 'unlock', 'play', 'stop', 'start', 'pause'],
    'es': ['encender', 'apagar', 'poner', 'abrir', 'cerrar', 'bloquear', 'reproducir', 'parar'],
    'fr': ['allumer', 'éteindre', 'mettre', 'ouvrir', 'fermer', 'verrouiller', 'jouer', 'arrêter'],
    'de': ['einschalten', 'ausschalten', 'setzen', 'öffnen', 'schließen', 'sperren', 'spielen', 'stoppen'],
    'it': ['accendere', 'spegnere', 'impostare', 'aprire', 'chiudere', 'bloccare', 'suonare', 'fermare'],
    'pt': ['ligar', 'desligar', 'definir', 'abrir', 'fechar', 'trancar', 'tocar', 'parar'],
    'nl': ['aanzetten', 'uitzetten', 'instellen', 'openen', 'sluiten', 'vergrendelen', 'afspelen', 'stoppen'],
    'sv': ['sätta på', 'stänga av', 'ställa in', 'öppna', 'stänga', 'låsa', 'spela', 'stoppa']
  };

  // Get action verbs for the detected language, fallback to English
  const languageActions = actionVerbs[language] || actionVerbs['en'];

  let actionCount = 0;
  languageActions.forEach(verb => {
    const matches = text.match(new RegExp(`\\b${verb}\\b`, 'gi'));
    if (matches) actionCount += matches.length;
  });

  // Multi-command if multiple actions or connectors present
  return actionCount > 1 || allConnectors.some(pattern => pattern.test(text));
}

/**
 * Extracts the primary intent from the command with multilingual support
 * @param {string} text - Processed command text
 * @param {object} multilingualResult - Result from multilingual processing
 * @returns {string} Detected intent
 */
function extractIntent(text, multilingualResult = null) {
  // If we have multilingual data, use it first
  if (multilingualResult && multilingualResult.actions.length > 0) {
    // Map the first detected action to an intent
    const firstAction = multilingualResult.actions[0];
    const normalizedAction = normalizeAction(firstAction, multilingualResult.language);

    // Map normalized actions to intents
    const actionToIntent = {
      'turn_on': 'turn_on',
      'turn_off': 'turn_off',
      'dim': 'dim',
      'brighten': 'brighten',
      'set_temperature': 'set_temperature',
      'play_music': 'play_music',
      'stop_music': 'stop_music',
      'open': 'open',
      'close': 'close',
      'lock': 'lock',
      'unlock': 'unlock'
    };

    if (actionToIntent[normalizedAction]) {
      return actionToIntent[normalizedAction];
    }
  }

  // Fallback to pattern matching
  const intentPatterns = {
    'turn_on': /\b(turn on|switch on|activate|enable|start|open|brighten)\b/i,
    'turn_off': /\b(turn off|switch off|deactivate|disable|stop|close|shut|darken)\b/i,
    'dim': /\b(dim|lower|reduce|decrease)\b/i,
    'brighten': /\b(brighten|increase|raise|boost)\b/i,
    'set_temperature': /\b(set|adjust|change).*(temperature|temp|heat|cool)\b/i,
    'play_music': /\b(play|start).*(music|audio)\b/i,
    'stop_music': /\b(stop|pause).*(music|audio)\b/i,
    'lock': /\b(lock|secure)\b/i,
    'unlock': /\b(unlock|open)\b/i,
    'status': /\b(status|state|check|what|how|is)\b/i
  };

  for (const [intent, pattern] of Object.entries(intentPatterns)) {
    if (pattern.test(text)) {
      return intent;
    }
  }

  // Default intent based on common patterns
  if (/\b(all|everything)\b/i.test(text)) {
    return 'turn_off'; // Conservative default for "all" commands
  }

  return 'turn_on'; // Default to turn_on for ambiguous commands
}

/**
 * Extracts entities (rooms, devices, values) from the command with multilingual support
 * @param {string} text - Processed command text
 * @param {object} multilingualResult - Result from multilingual processing
 * @returns {object} Extracted entities
 */
function extractEntities(text, multilingualResult = null) {
  const entities = {
    rooms: [],
    deviceTypes: [],
    values: {},
    modifiers: []
  };

  // Use multilingual data if available
  if (multilingualResult) {
    // Add normalized rooms from multilingual processing
    multilingualResult.rooms.forEach(room => {
      const normalizedRoom = normalizeRoomName(room, multilingualResult.language);
      if (normalizedRoom && !entities.rooms.includes(normalizedRoom)) {
        entities.rooms.push(normalizedRoom);
      }
    });

    // Add normalized device types from multilingual processing
    multilingualResult.deviceTypes.forEach(device => {
      const normalizedDevice = normalizeDeviceType(device, multilingualResult.language);
      if (normalizedDevice && !entities.deviceTypes.includes(normalizedDevice)) {
        entities.deviceTypes.push(normalizedDevice);
      }
    });
  }

  // Fallback to pattern matching for additional entities
  const roomPatterns = {
    'living room': /\b(living ?room|livingroom|lounge|vardagsrum|vardagsrummet)\b/i,
    'bedroom': /\b(bed ?room|bedroom|sovrum|sovrummet)\b/i,
    'kitchen': /\b(kitchen|kök|köket)\b/i,
    'bathroom': /\b(bath ?room|bathroom|badrum|badrummet)\b/i,
    'hallway': /\b(hallway|hall|hallen|entrance|entré)\b/i,
    'office': /\b(office|kontor|kontoret|study)\b/i,
    'dining room': /\b(dining ?room|diningroom|matrum|matrummet)\b/i,
    'basement': /\b(basement|base ?ment|källare|källaren|cellar)\b/i,
    'attic': /\b(attic|vind|vinden|loft)\b/i,
    'garage': /\b(garage|garaget)\b/i
  };

  Object.entries(roomPatterns).forEach(([room, pattern]) => {
    if (pattern.test(text) && !entities.rooms.includes(room)) {
      entities.rooms.push(room);
    }
  });

  // Device type patterns - improved to handle common misspellings and variations
  const devicePatterns = {
    'light': /\b(light|lights|ligt|ligts|lamp|lamps|ljus|lampa|lampor|belysning)\b/i,
    'speaker': /\b(speaker|speakers|music|audio|högtalare)\b/i,
    'thermostat': /\b(thermostat|heating|temperature|värme|temp)\b/i,
    'fan': /\b(fan|fans|fläkt|fläktar|ventilation)\b/i,
    'curtain': /\b(curtain|curtains|blind|blinds|gardin|gardiner)\b/i,
    'lock': /\b(lock|locks|lås|door|dörr)\b/i,
    'socket': /\b(socket|outlet|plug|uttag|kontakt)\b/i
  };

  Object.entries(devicePatterns).forEach(([device, pattern]) => {
    if (pattern.test(text) && !entities.deviceTypes.includes(device)) {
      entities.deviceTypes.push(device);
    }
  });

  // Extract numeric values
  const tempMatch = text.match(/(\d+)\s*(degrees?|°|celsius|c)\b/i);
  if (tempMatch) {
    entities.values.temperature = parseInt(tempMatch[1]);
  }

  const percentMatch = text.match(/(\d+)\s*%/);
  if (percentMatch) {
    entities.values.percentage = parseInt(percentMatch[1]);
  }

  // Extract modifiers (multilingual)
  const allPatterns = /\b(all|everything|alla|todo|tout|alles|tutto|tudo|alles|alla)\b/i;
  if (allPatterns.test(text)) {
    entities.modifiers.push('all');
  }

  const somePatterns = /\b(some|few|några|algunos|quelques|einige|alcuni|alguns|sommige|några)\b/i;
  if (somePatterns.test(text)) {
    entities.modifiers.push('some');
  }

  return entities;
}

/**
 * Calculates confidence score for the parsed command with multilingual factors
 * @param {string} text - Processed text
 * @param {string} intent - Detected intent
 * @param {object} entities - Extracted entities
 * @param {object} multilingualResult - Result from multilingual processing
 * @returns {number} Confidence score (0-1)
 */
function calculateConfidence(text, intent, entities, multilingualResult = null) {
  let confidence = 0.5; // Base confidence

  // Boost confidence for clear intents
  if (intent !== 'turn_on' || /\b(turn on|switch on|activate)\b/i.test(text)) {
    confidence += 0.2;
  }

  // Boost confidence for identified rooms
  if (entities.rooms.length > 0) {
    confidence += 0.2;
  }

  // Boost confidence for identified device types
  if (entities.deviceTypes.length > 0) {
    confidence += 0.1;
  }

  // Boost confidence for multilingual matches
  if (multilingualResult) {
    // Higher confidence if multilingual processor found matches
    if (multilingualResult.rooms.length > 0) {
      confidence += 0.15;
    }
    if (multilingualResult.actions.length > 0) {
      confidence += 0.15;
    }
    if (multilingualResult.deviceTypes.length > 0) {
      confidence += 0.1;
    }

    // Use multilingual confidence as a factor
    if (multilingualResult.confidence > 0) {
      confidence = Math.max(confidence, multilingualResult.confidence);
    }
  }

  // Reduce confidence for very short or ambiguous commands
  if (text.length < 5) {
    confidence -= 0.2;
  }

  // Reduce confidence for commands with no clear target
  if (entities.rooms.length === 0 && entities.deviceTypes.length === 0) {
    confidence -= 0.3;
  }

  return Math.max(0, Math.min(1, confidence));
}

/**
 * Suggests improvements for low-confidence commands
 * @param {object} processedCommand - Result from preprocessCommand
 * @returns {string} Suggestion text
 */
function suggestImprovement(processedCommand) {
  const { confidence, entities, intent } = processedCommand;

  if (confidence > 0.7) {
    return null; // Command is clear enough
  }

  const suggestions = [];

  if (entities.rooms.length === 0) {
    suggestions.push("specify which room (e.g., 'living room', 'kitchen')");
  }

  if (intent === 'turn_on' && !/\b(turn on|switch on|activate)\b/i.test(processedCommand.original)) {
    suggestions.push("be more specific about the action (e.g., 'turn on', 'turn off')");
  }

  if (entities.deviceTypes.length === 0 && entities.rooms.length === 0) {
    suggestions.push("mention what device or room you want to control");
  }

  if (suggestions.length === 0) {
    return "Try being more specific about what you want to control and what action to take.";
  }

  return `Try to ${suggestions.join(' and ')}.`;
}

/**
 * Parses a multi-command string into individual command components
 * @param {string} text - The multi-command text
 * @returns {Array} Array of individual command objects
 */
function parseMultiCommand(text) {
  // Split on common connectors while preserving context
  const splitPatterns = [
    /\s+and\s+/i,
    /\s*,\s*(?=(?:turn|set|dim|open|close|lock|unlock|play|stop|start|pause))/i,
    /\s+then\s+/i,
    /\s+also\s+/i,
    /\s+plus\s+/i
  ];

  let commands = [text];

  // Split the text using each pattern
  splitPatterns.forEach(pattern => {
    const newCommands = [];
    commands.forEach(cmd => {
      const parts = cmd.split(pattern);
      newCommands.push(...parts);
    });
    commands = newCommands;
  });

  // Clean and process each command
  return commands
    .map(cmd => cmd.trim())
    .filter(cmd => cmd.length > 0)
    .map(cmd => {
      // Try to inherit room context from the original command if not specified
      const processed = preprocessCommand(cmd);
      return {
        text: cmd,
        processed: processed.processed,
        intent: processed.intent,
        entities: processed.entities,
        confidence: processed.confidence
      };
    });
}

module.exports = {
  preprocessCommand,
  extractIntent,
  extractEntities,
  calculateConfidence,
  suggestImprovement,
  detectMultiCommand,
  parseMultiCommand
};
