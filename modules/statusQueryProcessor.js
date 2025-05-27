'use strict';

/**
 * Multilingual Status Query Processing Module
 * Handles parsing and processing of device status queries across multiple languages
 */

// const { comprehensiveRoomMatch } = require('./advancedMultilingualMatcher');
// const { normalizeDeviceType } = require('./multilingualProcessor');

// Temporary simple implementation to avoid circular dependency issues
function normalizeDeviceType(deviceType, language = 'en') {
  if (!deviceType) return '';
  return deviceType.toLowerCase().trim();
}

// Multilingual status query patterns
const STATUS_QUERY_PATTERNS = {
  'en': {
    'status': [
      /\b(what'?s|what is|show me|tell me|check|get|display)\s+(?:the\s+)?status\s+(?:of\s+)?(?:the\s+)?(.+?)\s+(lights?|devices?|thermostats?|sensors?)\??$/i,
      /\b(what'?s|what is|show me|tell me|check|get|display)\s+(?:the\s+)?status\s+(?:of\s+)?(.+)/i,
      /\b(how|what)\s+(?:is|are)\s+(?:the\s+)?(.+?)(?:\s+doing|\s+now)?/i,
      /\b(is|are)\s+(?:the\s+)?(.+?)\s+(on|off|open|closed|locked|unlocked)/i,
      /\b(show|list|display)\s+(?:me\s+)?(?:all\s+)?(?:the\s+)?(.+?)(?:\s+in\s+(?:the\s+)?(.+))?/i,
      /\b(tell me about|show me about|what about)\s+(?:the\s+)?(.+)/i
    ],
    'room_status': [
      /\b(?:show|list|display|what'?s|what is)\s+(?:me\s+)?(?:all\s+)?(?:the\s+)?(?:devices|things)\s+in\s+(?:the\s+)?(.+)/i,
      /\b(?:status|state)\s+(?:of\s+)?(?:all\s+)?(?:devices\s+)?in\s+(?:the\s+)?(.+)/i,
      /\b(?:tell me about|show me about|what about)\s+(?:the\s+)?(.+?)(?:\s+room)$/i
    ]
  },
  'sv': {
    'status': [
      /\b(vad är|visa|berätta|kolla|få|visa mig)\s+(?:status|tillstånd)\s+(?:på|för|av)\s+(.+)/i,
      /\b(hur|vad)\s+(?:är|har)\s+(.+?)(?:\s+det|\s+nu)?/i,
      /\b(är|har)\s+(.+?)\s+(på|av|öppen|stängd|låst|olåst)/i,
      /\b(visa|lista|visa mig)\s+(?:alla\s+)?(.+?)(?:\s+i\s+(.+))?/i
    ],
    'room_status': [
      /\b(?:visa|lista|vad är)\s+(?:alla\s+)?(?:enheter|saker|grejer)\s+i\s+(.+)/i,
      /\b(?:status|tillstånd)\s+(?:på|för)\s+(?:alla\s+)?(?:enheter\s+)?i\s+(.+)/i
    ]
  },
  'fr': {
    'status': [
      /\b(quel est|qu'est-ce que|montre|dis-moi|vérifie|affiche)\s+(?:le\s+)?(?:statut|état)\s+(?:de|du|des)\s+(.+)/i,
      /\b(comment|que)\s+(?:est|sont|va|vont)\s+(?:le|la|les)\s+(.+?)(?:\s+maintenant)?/i,
      /\b(?:est|sont)\s+(?:le|la|les)\s+(.+?)\s+(allumé|éteint|ouvert|fermé|verrouillé|déverrouillé)/i,
      /\b(montre|liste|affiche)\s+(?:moi\s+)?(?:tous?\s+)?(?:les?\s+)?(.+?)(?:\s+dans\s+(.+))?/i
    ],
    'room_status': [
      /\b(?:montre|liste|affiche|quel est)\s+(?:tous?\s+)?(?:les?\s+)?(?:appareils|dispositifs)\s+dans\s+(?:le|la|les)\s+(.+)/i,
      /\b(?:statut|état)\s+(?:de|des)\s+(?:tous?\s+)?(?:appareils\s+)?dans\s+(?:le|la|les)\s+(.+)/i
    ]
  },
  'de': {
    'status': [
      /\b(was ist|wie ist|zeige|sage mir|prüfe|zeige mir)\s+(?:der|die|das)?\s+(?:status|zustand)\s+(?:von|der|des)\s+(.+)/i,
      /\b(wie|was)\s+(?:ist|sind|geht|gehen)\s+(?:der|die|das)\s+(.+?)(?:\s+jetzt)?/i,
      /\b(?:ist|sind)\s+(?:der|die|das)\s+(.+?)\s+(an|aus|offen|geschlossen|verschlossen|entsperrt)/i,
      /\b(zeige|liste|zeige mir)\s+(?:alle\s+)?(.+?)(?:\s+im\s+(.+))?/i
    ],
    'room_status': [
      /\b(?:zeige|liste|was ist)\s+(?:alle\s+)?(?:geräte|sachen)\s+im\s+(.+)/i,
      /\b(?:status|zustand)\s+(?:von|der)\s+(?:allen\s+)?(?:geräten\s+)?im\s+(.+)/i
    ]
  },
  'es': {
    'status': [
      /\b(qué es|cuál es|muestra|dime|verifica|muéstrame)\s+(?:el\s+)?(?:estado|estatus)\s+(?:de|del|de la|de los)\s+(.+)/i,
      /\b(cómo|qué)\s+(?:está|están|va|van)\s+(?:el|la|los|las)\s+(.+?)(?:\s+ahora)?/i,
      /\b(?:está|están)\s+(?:el|la|los|las)\s+(.+?)\s+(encendido|apagado|abierto|cerrado|bloqueado|desbloqueado)/i,
      /\b(muestra|lista|muéstrame)\s+(?:todos?\s+)?(?:los?\s+)?(.+?)(?:\s+en\s+(.+))?/i
    ],
    'room_status': [
      /\b(?:muestra|lista|cuál es)\s+(?:todos?\s+)?(?:los?\s+)?(?:dispositivos|aparatos)\s+en\s+(?:el|la|los|las)\s+(.+)/i,
      /\b(?:estado|estatus)\s+(?:de|del)\s+(?:todos?\s+)?(?:dispositivos\s+)?en\s+(?:el|la|los|las)\s+(.+)/i
    ]
  }
};

// Status query types
const QUERY_TYPES = {
  DEVICE_STATUS: 'device_status', // Status of specific device(s)
  ROOM_STATUS: 'room_status', // All devices in a room
  DEVICE_TYPE_STATUS: 'device_type_status', // All devices of a type
  GLOBAL_STATUS: 'global_status' // All devices everywhere
};

/**
 * Parse a multilingual status query
 * @param {string} queryText - The status query text
 * @param {string} language - Detected language
 * @returns {Object} Parsed query information
 */
function parseStatusQuery(queryText, language = 'en') {
  if (!queryText) {
    return { type: null, target: null, room: null, confidence: 0 };
  }

  const lowerQuery = queryText.toLowerCase().trim();
  const patterns = STATUS_QUERY_PATTERNS[language] || STATUS_QUERY_PATTERNS.en;

  // Check for room status queries first
  for (const pattern of patterns.room_status || []) {
    const match = lowerQuery.match(pattern);
    if (match) {
      return {
        type: QUERY_TYPES.ROOM_STATUS,
        target: null,
        room: match[1].trim(),
        confidence: 0.9,
        originalQuery: queryText,
        language
      };
    }
  }

  // Check for device/general status queries
  for (const pattern of patterns.status || []) {
    const match = lowerQuery.match(pattern);
    if (match) {
      let target, room;

      // Handle different regex capture groups
      if (match.length >= 4 && match[3]) {
        // Check which pattern matched based on the regex structure
        const matchedPattern = pattern.source;
        if (matchedPattern.includes('lights?|devices?|thermostats?|sensors?')) {
          // First pattern: "what's the status of kitchen lights?" -> match[2]="kitchen", match[3]="lights"
          room = match[2] ? match[2].trim() : '';
          target = match[3].trim();
        } else {
          // Pattern with room: "show me devices in kitchen"
          target = match[2] ? match[2].trim() : '';
          room = match[3].trim();
        }
      } else if (match.length >= 3 && match[2]) {
        // Standard pattern: "tell me about living room"
        target = match[2].trim();
        room = null;

        // Check if target contains room indicators
        if (target.includes(' in ')) {
          const parts = target.split(' in ');
          target = parts[0].trim();
          room = parts[1].trim();
        }

        // Special handling for device type + room patterns like "kitchen lights"
        const deviceTypes = ['lights?', 'thermostats?', 'sensors?', 'devices?', 'switches?'];
        for (const deviceType of deviceTypes) {
          const deviceRegex = new RegExp(`(.+?)\\s+(${deviceType})$`, 'i');
          const deviceMatch = target.match(deviceRegex);
          if (deviceMatch) {
            room = deviceMatch[1].trim();
            target = deviceMatch[2].trim();
            break;
          }
        }
      } else {
        target = match[1] ? match[1].trim() : '';
        room = null;
      }

      // Determine query type based on target content
      let queryType = QUERY_TYPES.DEVICE_STATUS;

      // Check for global status indicators
      if ((target && (target.includes('all devices') || target.includes('everything') ||
                     target.includes('alla') || target.includes('tout') ||
                     target.includes('alles') || target.includes('todo'))) ||
          (room === 'all' && target === 'devices') ||
          (target === 'devices' && room === 'all')) {
        queryType = QUERY_TYPES.GLOBAL_STATUS;
        // Reset room and target for global queries
        room = null;
        target = 'all devices';
      }

      // Check if target is just a room name (like "living room", "kitchen")
      const roomWords = ['room', 'kitchen', 'bedroom', 'bathroom', 'living', 'dining', 'office', 'garden',
                        'vardagsrum', 'kök', 'sovrum', 'badrum', 'kontor', 'trädgård'];
      const isRoomQuery = target && roomWords.some(word => target.toLowerCase().includes(word)) &&
                         !target.includes('light') && !target.includes('device') && !target.includes('thermostat');

      if (isRoomQuery && !room) {
        queryType = QUERY_TYPES.ROOM_STATUS;
        room = target;
        target = null;
      }

      // Calculate confidence based on query clarity
      let confidence = 0.8; // Default high confidence

      // Adjust confidence based on query characteristics
      if (queryText.length > 100) {
        confidence = 0.7; // Long queries get slightly lower confidence
      }

      // Higher confidence for specific patterns
      if (match[0].includes('status') || match[0].includes('what\'s') || match[0].includes('show me')) {
        confidence = 0.9;
      }

      return {
        type: queryType,
        target,
        room,
        confidence,
        originalQuery: queryText,
        language
      };
    }
  }

  // Fallback: check if it contains status-related keywords
  const statusKeywords = {
    'en': ['status', 'state', 'how', 'what', 'show', 'list', 'check'],
    'sv': ['status', 'tillstånd', 'hur', 'vad', 'visa', 'lista', 'kolla'],
    'fr': ['statut', 'état', 'comment', 'que', 'montre', 'liste', 'vérifie'],
    'de': ['status', 'zustand', 'wie', 'was', 'zeige', 'liste', 'prüfe'],
    'es': ['estado', 'estatus', 'cómo', 'qué', 'muestra', 'lista', 'verifica']
  };

  const keywords = statusKeywords[language] || statusKeywords.en;
  const hasStatusKeyword = keywords.some(keyword => lowerQuery.includes(keyword));

  if (hasStatusKeyword) {
    return {
      type: QUERY_TYPES.DEVICE_STATUS,
      target: queryText,
      room: null,
      confidence: 0.5,
      originalQuery: queryText,
      language
    };
  }

  return {
    type: null,
    target: null,
    room: null,
    confidence: 0,
    originalQuery: queryText,
    language
  };
}

/**
 * Check if a text is a status query
 * @param {string} text - Text to check
 * @param {string} language - Language code
 * @returns {boolean} True if it's a status query
 */
function isStatusQuery(text, language = 'en') {
  const parsed = parseStatusQuery(text, language);
  return parsed.confidence >= 0.5;
}

/**
 * Extract device type from status query
 * @param {string} target - Target from parsed query
 * @param {string} language - Language code
 * @returns {string|null} Normalized device type
 */
function extractDeviceTypeFromQuery(target, language = 'en') {
  if (!target) return null;

  // Use existing multilingual device type normalization
  return normalizeDeviceType(target, language);
}

/**
 * Determine the scope of a status query
 * @param {Object} parsedQuery - Parsed query object
 * @returns {Object} Query scope information
 */
function determineQueryScope(parsedQuery) {
  const scope = {
    includeRooms: [],
    includeDeviceTypes: [],
    includeSpecificDevices: [],
    isGlobal: false
  };

  if (parsedQuery.type === QUERY_TYPES.GLOBAL_STATUS) {
    scope.isGlobal = true;
    return scope;
  }

  if (parsedQuery.room) {
    scope.includeRooms.push(parsedQuery.room);
  }

  if (parsedQuery.target) {
    const deviceType = extractDeviceTypeFromQuery(parsedQuery.target, parsedQuery.language);
    if (deviceType) {
      scope.includeDeviceTypes.push(deviceType);
    }
  }

  return scope;
}

module.exports = {
  STATUS_QUERY_PATTERNS,
  QUERY_TYPES,
  parseStatusQuery,
  isStatusQuery,
  extractDeviceTypeFromQuery,
  determineQueryScope
};
