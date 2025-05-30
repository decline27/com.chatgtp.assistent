'use strict';

/**
 * Device Status Retrieval and Formatting Module
 * Handles getting current device states from Homey API and formatting them for display
 */

const { comprehensiveRoomMatch } = require('./advancedMultilingualMatcher');
const { getSocketDescription, identifySocketDeviceType, SOCKET_CONNECTED_DEVICES } = require('./socketDeviceMapper');

/**
 * Get current capability value from a device
 * @param {Object} device - Homey device object
 * @param {string} capability - Capability name
 * @returns {Promise<any>} Current capability value
 */
async function getDeviceCapabilityValue(device, capability) {
  try {
    if (device.getCapabilityValue && typeof device.getCapabilityValue === 'function') {
      return await device.getCapabilityValue(capability);
    }

    // Fallback: check if value is stored in device object
    if (device.capabilitiesObj && device.capabilitiesObj[capability]) {
      return device.capabilitiesObj[capability].value;
    }

    return null;
  } catch (error) {
    console.warn(`Failed to get capability ${capability} for device ${device.name}:`, error);
    return null;
  }
}

/**
 * Get all relevant capabilities and their values for a device
 * @param {Object} device - Homey device object
 * @returns {Promise<Object>} Device status information
 */
async function getDeviceStatus(device) {
  const capabilities = getCapabilityKeys(device);
  const status = {
    id: device.id,
    name: device.name,
    class: device.class,
    zone: device.zone,
    capabilities: {},
    summary: '',
    isOnline: device.available !== false
  };

  // Get values for all capabilities
  for (const capability of capabilities) {
    const value = await getDeviceCapabilityValue(device, capability);
    if (value !== null) {
      status.capabilities[capability] = value;
    }
  }

  // Generate human-readable summary
  status.summary = generateDeviceSummary(device, status.capabilities);

  return status;
}

/**
 * Helper function to get capability keys (from app.js)
 * @param {Object} device - Device object
 * @returns {Array} Array of capability keys
 */
function getCapabilityKeys(device) {
  if (device.capabilities && Array.isArray(device.capabilities)) {
    return device.capabilities;
  } if (device.capabilitiesObj && typeof device.capabilitiesObj === 'object') {
    return Object.keys(device.capabilitiesObj);
  }
  return [];
}

/**
 * Generate a human-readable summary of device status
 * @param {Object} device - Device object
 * @param {Object} capabilities - Capability values
 * @returns {string} Human-readable status summary
 */
function generateDeviceSummary(device, capabilities) {
  const deviceClass = device.class;
  const parts = [];

  // Handle different device types
  switch (deviceClass) {
    case 'light':
      if (capabilities.onoff !== undefined) {
        parts.push(capabilities.onoff ? '💡 On' : '💡 Off');
      }
      if (capabilities.dim !== undefined && capabilities.onoff) {
        const dimPercent = Math.round(capabilities.dim * 100);
        parts.push(`${dimPercent}% brightness`);
      }
      if (capabilities.light_temperature !== undefined) {
        parts.push(`${capabilities.light_temperature}K color temp`);
      }
      break;

    case 'socket':
      if (capabilities.onoff !== undefined) {
        parts.push(capabilities.onoff ? '🔌 On' : '🔌 Off');
      }
      if (capabilities.measure_power !== undefined) {
        parts.push(`${capabilities.measure_power}W`);
      }
      
      // Enhanced socket device identification using comprehensive mapper
      const connectedDevice = identifySocketDeviceType(device.name);
      if (connectedDevice && SOCKET_CONNECTED_DEVICES[connectedDevice]) {
        const deviceData = SOCKET_CONNECTED_DEVICES[connectedDevice];
        const category = deviceData.category;
        
        // Get first vocabulary term for the device in current language
        const deviceTerms = deviceData.multilingual['en'] || [];
        const deviceTerm = deviceTerms[0] || connectedDevice;
        
        // Create more descriptive status based on category and device type
        switch (category) {
          case 'lighting':
            parts.push(`(controlling ${deviceTerm})`);
            break;
          case 'kitchen':
            parts.push(`(controlling ${deviceTerm} - kitchen appliance)`);
            break;
          case 'entertainment':
            parts.push(`(controlling ${deviceTerm} - entertainment device)`);
            break;
          case 'climate':
            parts.push(`(controlling ${deviceTerm} - climate control)`);
            break;
          case 'laundry':
            parts.push(`(controlling ${deviceTerm} - laundry appliance)`);
            break;
          case 'utility':
            parts.push(`(controlling ${deviceTerm} - utility device)`);
            break;
          default:
            parts.push(`(controlling ${deviceTerm})`);
        }
        
        // Add power usage context for appliances
        if (capabilities.measure_power !== undefined && capabilities.onoff) {
          const powerUsage = capabilities.measure_power;
          if (powerUsage > 100) {
            parts.push('(high power usage)');
          } else if (powerUsage > 10) {
            parts.push('(moderate power usage)');
          } else if (powerUsage > 0) {
            parts.push('(low power usage)');
          }
        }
      } else {
        // Fallback for unidentified sockets - check for common device type patterns
        const name = device.name.toLowerCase();
        if (/light|lamp|ljus|lampa|belysning/i.test(name)) {
          parts.push('(controlling lighting device)');
        } else if (/tv|television|fernseher/i.test(name)) {
          parts.push('(controlling TV/entertainment device)');
        } else if (/speaker|audio|musik|ljud/i.test(name)) {
          parts.push('(controlling audio device)');
        } else {
          parts.push('(smart plug)');
        }
      }
      break;

    case 'thermostat':
      if (capabilities.target_temperature !== undefined) {
        parts.push(`🌡️ Set to ${capabilities.target_temperature}°C`);
      }
      if (capabilities.measure_temperature !== undefined) {
        parts.push(`Currently ${capabilities.measure_temperature}°C`);
      }
      break;

    case 'speaker':
      if (capabilities.speaker_playing !== undefined) {
        parts.push(capabilities.speaker_playing ? '🔊 Playing' : '🔊 Stopped');
      }
      if (capabilities.volume_set !== undefined) {
        const volumePercent = Math.round(capabilities.volume_set * 100);
        parts.push(`Volume ${volumePercent}%`);
      }
      break;

    case 'sensor':
      if (capabilities.measure_temperature !== undefined) {
        parts.push(`🌡️ ${capabilities.measure_temperature}°C`);
      }
      if (capabilities.measure_humidity !== undefined) {
        parts.push(`💧 ${capabilities.measure_humidity}% humidity`);
      }
      if (capabilities.alarm_motion !== undefined) {
        parts.push(capabilities.alarm_motion ? '🚶 Motion detected' : '🚶 No motion');
      }
      if (capabilities.alarm_contact !== undefined) {
        parts.push(capabilities.alarm_contact ? '🚪 Open' : '🚪 Closed');
      }
      break;

    case 'lock':
      if (capabilities.locked !== undefined) {
        parts.push(capabilities.locked ? '🔒 Locked' : '🔓 Unlocked');
      }
      break;

    case 'curtain':
    case 'blinds':
      if (capabilities.windowcoverings_set !== undefined) {
        const position = Math.round(capabilities.windowcoverings_set * 100);
        parts.push(`🪟 ${position}% open`);
      }
      break;

    case 'fan':
      if (capabilities.onoff !== undefined) {
        parts.push(capabilities.onoff ? '🌀 On' : '🌀 Off');
      }
      if (capabilities.fan_speed !== undefined && capabilities.onoff) {
        const speedPercent = Math.round(capabilities.fan_speed * 100);
        parts.push(`Speed ${speedPercent}%`);
      }
      break;

    default:
      // Generic handling for unknown device types
      if (capabilities.onoff !== undefined) {
        parts.push(capabilities.onoff ? '✅ On' : '❌ Off');
      }
      break;
  }

  // Add offline status if device is not available
  if (device.available === false) {
    parts.unshift('📴 Offline');
  }

  return parts.length > 0 ? parts.join(', ') : 'No status available';
}

/**
 * Get status for devices in a specific room
 * @param {string} roomName - Room name to query
 * @param {Array} availableRooms - Available room names from Homey
 * @param {Object} devices - Devices object from Homey
 * @param {Object} zones - Zones object from Homey
 * @param {string} language - Language for room matching
 * @param {Function} llmFunction - Optional LLM function for semantic matching
 * @returns {Promise<Object>} Room status information
 */
async function getRoomStatus(roomName, availableRooms, devices, zones, language = 'en', llmFunction = null) {
  // Use advanced room matching
  const roomMatch = await comprehensiveRoomMatch(roomName, availableRooms, language, llmFunction);

  if (!roomMatch.match || roomMatch.confidence < 0.6) {
    return {
      success: false,
      error: `Room "${roomName}" not found. Available rooms: ${availableRooms.join(', ')}`,
      roomName,
      matchedRoom: null
    };
  }

  const matchedRoomName = roomMatch.match;

  // Find the zone ID for the matched room
  const zoneId = Object.keys(zones).find(id => zones[id].name.toLowerCase() === matchedRoomName.toLowerCase());

  if (!zoneId) {
    return {
      success: false,
      error: `Zone not found for room "${matchedRoomName}"`,
      roomName,
      matchedRoom: matchedRoomName
    };
  }

  // Get all devices in this zone
  const roomDevices = Object.values(devices).filter(device => device.zone === zoneId);

  if (roomDevices.length === 0) {
    return {
      success: true,
      roomName,
      matchedRoom: matchedRoomName,
      deviceCount: 0,
      devices: [],
      summary: `No devices found in ${matchedRoomName}`
    };
  }

  // Get status for each device
  const deviceStatuses = [];
  for (const device of roomDevices) {
    const status = await getDeviceStatus(device);
    deviceStatuses.push(status);
  }

  return {
    success: true,
    roomName,
    matchedRoom: matchedRoomName,
    deviceCount: deviceStatuses.length,
    devices: deviceStatuses,
    summary: `Found ${deviceStatuses.length} devices in ${matchedRoomName}`,
    matchConfidence: roomMatch.confidence,
    matchMethod: roomMatch.method
  };
}

/**
 * Get status for devices of a specific type
 * @param {string} deviceType - Device type to query
 * @param {Object} devices - Devices object from Homey
 * @param {Object} zones - Zones object from Homey (needed for room filtering)
 * @param {string} roomFilter - Optional room filter
 * @param {string} language - Language for device type matching
 * @param {Function} llmFunction - Optional LLM function for room matching
 * @returns {Promise<Object>} Device type status information
 */
async function getDeviceTypeStatus(deviceType, devices, zones = null, roomFilter = null, language = 'en', llmFunction = null) {
  const deviceArray = Object.values(devices);

  // Filter by device type (class) - improved matching with socket integration
  let filteredDevices = deviceArray.filter(device => {
    if (!device.class) return false;

    const deviceClass = device.class.toLowerCase();
    const targetType = deviceType.toLowerCase();

    // Exact match first
    if (deviceClass === targetType) return true;

    // Enhanced socket integration: Include sockets controlling the target device type
    if (deviceClass === 'socket') {
      // Use socket device mapper to identify what the socket controls
      const connectedDeviceType = identifySocketDeviceType(device.name);
      if (connectedDeviceType === targetType) {
        return true;
      }
      
      // Additional socket filtering based on target type
      if (targetType === 'light') {
        // Check if socket is controlling lights using name patterns
        const name = device.name.toLowerCase();
        if (/light|lamp|ljus|lampa|belysning/i.test(name)) {
          return true;
        }
      } else if (targetType === 'speaker') {
        // Include sockets controlling media players/speakers
        if (connectedDeviceType === 'mediaplayer') {
          return true;
        }
      } else if (targetType === 'tv') {
        // Include sockets controlling TVs or media devices
        if (connectedDeviceType === 'tv' || connectedDeviceType === 'mediaplayer') {
          return true;
        }
      }
    }

    // Partial match for common variations
    if (deviceClass.includes(targetType) || targetType.includes(deviceClass)) return true;

    // Handle common device type aliases
    const typeAliases = {
      'light': ['lamp', 'bulb', 'lighting'],
      'speaker': ['audio', 'music', 'sound'],
      'thermostat': ['heating', 'temperature', 'climate'],
      'sensor': ['detector', 'monitor'],
      'lock': ['door', 'security'],
      'socket': ['outlet', 'plug', 'power']
    };

    if (typeAliases[targetType]) {
      return typeAliases[targetType].some(alias => deviceClass.includes(alias));
    }

    return false;
  });

  // Apply room filter if specified
  if (roomFilter && zones) {
    // Use advanced room matching to find the correct zone
    const availableRooms = Object.values(zones).map(zone => zone.name);
    const roomMatch = await comprehensiveRoomMatch(roomFilter, availableRooms, language, llmFunction);

    if (roomMatch.match && roomMatch.confidence >= 0.6) {
      // Find the zone ID for the matched room
      const targetZoneId = Object.keys(zones).find(id => zones[id].name.toLowerCase() === roomMatch.match.toLowerCase());

      if (targetZoneId) {
        // Filter devices by zone ID
        filteredDevices = filteredDevices.filter(device => device.zone === targetZoneId);
      }
    }
  }

  if (filteredDevices.length === 0) {
    return {
      success: true,
      deviceType,
      roomFilter,
      deviceCount: 0,
      devices: [],
      summary: `No ${deviceType} devices found${roomFilter ? ` in ${roomFilter}` : ''}`
    };
  }

  // Get status for each device
  const deviceStatuses = [];
  for (const device of filteredDevices) {
    const status = await getDeviceStatus(device);
    deviceStatuses.push(status);
  }

  return {
    success: true,
    deviceType,
    roomFilter,
    deviceCount: deviceStatuses.length,
    devices: deviceStatuses,
    summary: `Found ${deviceStatuses.length} ${deviceType} devices${roomFilter ? ` in ${roomFilter}` : ''}`
  };
}

module.exports = {
  getDeviceStatus,
  getRoomStatus,
  getDeviceTypeStatus,
  generateDeviceSummary,
  getDeviceCapabilityValue
};
