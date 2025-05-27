'use strict';

/**
 * Main Status Query Handler
 * Orchestrates the entire status query process from parsing to formatting
 */

const { parseStatusQuery, isStatusQuery, QUERY_TYPES } = require('./statusQueryProcessor');
const { getRoomStatus, getDeviceTypeStatus, getDeviceStatus } = require('./deviceStatusRetriever');
const {
  formatRoomStatus,
  formatDeviceTypeStatus,
  formatGlobalStatus,
  formatSingleDeviceStatus
} = require('./statusFormatter');
const { comprehensiveRoomMatch } = require('./advancedMultilingualMatcher');

/**
 * Main function to handle status queries
 * @param {string} queryText - The status query text
 * @param {string} language - Detected language
 * @param {Object} homeState - Current home state from Homey
 * @param {Function} llmFunction - Optional LLM function for semantic matching
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} Status query result
 */
async function handleStatusQuery(queryText, language = 'en', homeState, llmFunction = null, options = {}) {
  const { includeDetails = true, maxDevices = 50 } = options;

  try {
    // Parse the status query
    const parsedQuery = parseStatusQuery(queryText, language);

    if (!parsedQuery.type || parsedQuery.confidence < 0.5) {
      return {
        success: false,
        error: 'Not recognized as a status query',
        queryText: queryText,
        confidence: parsedQuery.confidence
      };
    }

    const { devices, zones } = homeState;
    const availableRooms = Object.values(zones).map(zone => zone.name);

    // Handle different query types
    switch (parsedQuery.type) {
      case QUERY_TYPES.ROOM_STATUS:
        return await handleRoomStatusQuery(parsedQuery, availableRooms, devices, zones, language, llmFunction, includeDetails);

      case QUERY_TYPES.DEVICE_TYPE_STATUS:
        return await handleDeviceTypeStatusQuery(parsedQuery, devices, zones, language, llmFunction, includeDetails);

      case QUERY_TYPES.GLOBAL_STATUS:
        return await handleGlobalStatusQuery(devices, language, includeDetails, maxDevices);

      case QUERY_TYPES.DEVICE_STATUS:
      default:
        return await handleDeviceStatusQuery(parsedQuery, availableRooms, devices, zones, language, llmFunction, includeDetails);
    }

  } catch (error) {
    console.error('Error handling status query:', error);
    return {
      success: false,
      error: `Failed to process status query: ${error.message}`,
      queryText: queryText
    };
  }
}

/**
 * Handle room status queries
 */
async function handleRoomStatusQuery(parsedQuery, availableRooms, devices, zones, language, llmFunction, includeDetails) {
  const roomName = parsedQuery.room || parsedQuery.target;

  if (!roomName) {
    return {
      success: false,
      error: 'No room specified in query',
      queryText: parsedQuery.originalQuery
    };
  }

  const roomStatus = await getRoomStatus(roomName, availableRooms, devices, zones, language, llmFunction);
  const formattedStatus = formatRoomStatus(roomStatus, language, includeDetails);

  return {
    success: roomStatus.success,
    type: 'room_status',
    queryText: parsedQuery.originalQuery,
    result: roomStatus,
    formattedText: formattedStatus,
    confidence: parsedQuery.confidence
  };
}

/**
 * Handle device type status queries
 */
async function handleDeviceTypeStatusQuery(parsedQuery, devices, zones, language, llmFunction, includeDetails) {
  // Extract device type from target
  const deviceType = extractDeviceTypeFromTarget(parsedQuery.target, language);

  if (!deviceType) {
    return {
      success: false,
      error: 'Could not identify device type from query',
      queryText: parsedQuery.originalQuery
    };
  }

  const deviceTypeStatus = await getDeviceTypeStatus(deviceType, devices, zones, parsedQuery.room, language, llmFunction);
  const formattedStatus = formatDeviceTypeStatus(deviceTypeStatus, language, includeDetails);

  return {
    success: true,
    type: 'device_type_status',
    queryText: parsedQuery.originalQuery,
    result: deviceTypeStatus,
    formattedText: formattedStatus,
    confidence: parsedQuery.confidence
  };
}

/**
 * Handle global status queries
 */
async function handleGlobalStatusQuery(devices, language, includeDetails, maxDevices) {
  const deviceArray = Object.values(devices);

  if (deviceArray.length === 0) {
    return {
      success: true,
      type: 'global_status',
      result: { devices: [], deviceCount: 0 },
      formattedText: 'No devices found in the system.',
      confidence: 1.0
    };
  }

  // Limit number of devices for performance
  const limitedDevices = deviceArray.slice(0, maxDevices);

  // Get status for all devices
  const allDeviceStatuses = [];
  for (const device of limitedDevices) {
    const status = await getDeviceStatus(device);
    allDeviceStatuses.push(status);
  }

  const formattedStatus = formatGlobalStatus(allDeviceStatuses, language, includeDetails);

  return {
    success: true,
    type: 'global_status',
    result: {
      devices: allDeviceStatuses,
      deviceCount: allDeviceStatuses.length,
      totalDevices: deviceArray.length,
      limited: deviceArray.length > maxDevices
    },
    formattedText: formattedStatus,
    confidence: 1.0
  };
}

/**
 * Handle specific device status queries
 */
async function handleDeviceStatusQuery(parsedQuery, availableRooms, devices, zones, language, llmFunction, includeDetails) {
  const target = parsedQuery.target;

  if (!target) {
    return {
      success: false,
      error: 'No device or target specified in query',
      queryText: parsedQuery.originalQuery
    };
  }

  // Try to find specific device by name
  const deviceArray = Object.values(devices);
  const deviceMatches = deviceArray.filter(device =>
    device.name.toLowerCase().includes(target.toLowerCase()) ||
    target.toLowerCase().includes(device.name.toLowerCase())
  );

  if (deviceMatches.length === 1) {
    // Single device match
    const deviceStatus = await getDeviceStatus(deviceMatches[0]);
    const formattedStatus = formatSingleDeviceStatus(deviceStatus, language);

    return {
      success: true,
      type: 'device_status',
      queryText: parsedQuery.originalQuery,
      result: { device: deviceStatus },
      formattedText: formattedStatus,
      confidence: parsedQuery.confidence
    };
  } else if (deviceMatches.length > 1) {
    // Multiple device matches
    const deviceStatuses = [];
    for (const device of deviceMatches.slice(0, 10)) { // Limit to 10 devices
      const status = await getDeviceStatus(device);
      deviceStatuses.push(status);
    }

    const formattedStatus = formatMultipleDeviceStatus(deviceStatuses, language);

    return {
      success: true,
      type: 'multiple_device_status',
      queryText: parsedQuery.originalQuery,
      result: { devices: deviceStatuses, deviceCount: deviceStatuses.length },
      formattedText: formattedStatus,
      confidence: parsedQuery.confidence
    };
  }

  // No direct device match, try room-based query
  if (parsedQuery.room) {
    return await handleRoomStatusQuery(parsedQuery, availableRooms, devices, zones, language, llmFunction, includeDetails);
  }

  // Try to interpret as device type
  const deviceType = extractDeviceTypeFromTarget(target, language);
  if (deviceType) {
    const deviceTypeStatus = await getDeviceTypeStatus(deviceType, devices, zones, null, language, llmFunction);
    if (deviceTypeStatus.deviceCount > 0) {
      const formattedStatus = formatDeviceTypeStatus(deviceTypeStatus, language, includeDetails);

      return {
        success: true,
        type: 'device_type_status',
        queryText: parsedQuery.originalQuery,
        result: deviceTypeStatus,
        formattedText: formattedStatus,
        confidence: parsedQuery.confidence * 0.8 // Lower confidence for inferred type
      };
    }
  }

  return {
    success: false,
    error: `Could not find device or understand target: "${target}"`,
    queryText: parsedQuery.originalQuery,
    suggestions: generateSuggestions(target, deviceArray, availableRooms)
  };
}

/**
 * Extract device type from target text
 */
function extractDeviceTypeFromTarget(target, language) {
  if (!target) return null;

  const deviceTypeKeywords = {
    'en': {
      'light': ['light', 'lights', 'lamp', 'lamps', 'bulb', 'bulbs'],
      'speaker': ['speaker', 'speakers', 'music', 'audio'],
      'thermostat': ['thermostat', 'heating', 'temperature', 'heat'],
      'sensor': ['sensor', 'sensors', 'detector'],
      'lock': ['lock', 'locks', 'door'],
      'fan': ['fan', 'fans'],
      'socket': ['socket', 'plug', 'outlet']
    },
    'sv': {
      'light': ['ljus', 'lampa', 'lampor', 'belysning'],
      'speaker': ['högtalare', 'musik', 'ljud'],
      'thermostat': ['termostat', 'värme', 'temperatur'],
      'sensor': ['sensor', 'sensorer', 'detektor'],
      'lock': ['lås', 'dörr'],
      'fan': ['fläkt', 'fläktar'],
      'socket': ['uttag', 'kontakt']
    }
    // Add more languages as needed
  };

  const keywords = deviceTypeKeywords[language] || deviceTypeKeywords['en'];
  const lowerTarget = target.toLowerCase();

  for (const [type, typeKeywords] of Object.entries(keywords)) {
    if (typeKeywords.some(keyword => lowerTarget.includes(keyword))) {
      return type;
    }
  }

  return null;
}

/**
 * Format multiple device status
 */
function formatMultipleDeviceStatus(deviceStatuses, language) {
  const parts = [];
  parts.push(`🔧 **Multiple Devices Found** (${deviceStatuses.length})`);
  parts.push('');

  deviceStatuses.forEach(device => {
    parts.push(`• **${device.name}** (${device.class}): ${device.summary}`);
  });

  return parts.join('\n');
}

/**
 * Generate suggestions for failed queries
 */
function generateSuggestions(target, devices, availableRooms) {
  const suggestions = [];

  // Suggest similar device names
  const similarDevices = devices
    .filter(device => {
      const similarity = calculateSimpleSimilarity(target.toLowerCase(), device.name.toLowerCase());
      return similarity > 0.3;
    })
    .slice(0, 3)
    .map(device => device.name);

  if (similarDevices.length > 0) {
    suggestions.push(`Similar devices: ${similarDevices.join(', ')}`);
  }

  // Suggest rooms
  if (availableRooms.length > 0) {
    suggestions.push(`Try asking about a room: ${availableRooms.slice(0, 5).join(', ')}`);
  }

  return suggestions;
}

/**
 * Simple similarity calculation
 */
function calculateSimpleSimilarity(a, b) {
  const longer = a.length > b.length ? a : b;
  const shorter = a.length > b.length ? b : a;

  if (longer.length === 0) return 1.0;

  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

/**
 * Simple Levenshtein distance implementation
 */
function levenshteinDistance(a, b) {
  const matrix = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

module.exports = {
  handleStatusQuery,
  isStatusQuery,
  parseStatusQuery
};
