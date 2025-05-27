'use strict';

/**
 * Multilingual Status Formatting Module
 * Formats device status information for user-friendly display across languages
 */

// Multilingual status text templates
const STATUS_TEMPLATES = {
  'en': {
    room_header: '🏠 **{room}** Status',
    device_count: '📱 {count} devices found',
    no_devices: '❌ No devices found in {room}',
    device_offline: '📴 Offline',
    device_online: '✅ Online',
    summary_header: '📊 **Summary**',
    details_header: '📋 **Device Details**',
    room_not_found: '❌ Room "{room}" not found',
    available_rooms: 'Available rooms: {rooms}',
    global_status: '🌍 **Global Home Status**',
    device_type_status: '🔧 **{type} Devices Status**',
    no_devices_of_type: '❌ No {type} devices found',
    match_info: '🎯 Matched "{input}" → "{matched}" ({confidence}% confidence, {method})'
  },
  'sv': {
    room_header: '🏠 **{room}** Status',
    device_count: '📱 {count} enheter hittade',
    no_devices: '❌ Inga enheter hittade i {room}',
    device_offline: '📴 Offline',
    device_online: '✅ Online',
    summary_header: '📊 **Sammanfattning**',
    details_header: '📋 **Enhetsdetaljer**',
    room_not_found: '❌ Rummet "{room}" hittades inte',
    available_rooms: 'Tillgängliga rum: {rooms}',
    global_status: '🌍 **Global Hemstatus**',
    device_type_status: '🔧 **{type} Enheter Status**',
    no_devices_of_type: '❌ Inga {type} enheter hittade',
    match_info: '🎯 Matchade "{input}" → "{matched}" ({confidence}% säkerhet, {method})'
  },
  'fr': {
    room_header: '🏠 **{room}** Statut',
    device_count: '📱 {count} appareils trouvés',
    no_devices: '❌ Aucun appareil trouvé dans {room}',
    device_offline: '📴 Hors ligne',
    device_online: '✅ En ligne',
    summary_header: '📊 **Résumé**',
    details_header: '📋 **Détails des Appareils**',
    room_not_found: '❌ Pièce "{room}" non trouvée',
    available_rooms: 'Pièces disponibles: {rooms}',
    global_status: '🌍 **Statut Global de la Maison**',
    device_type_status: '🔧 **Statut des Appareils {type}**',
    no_devices_of_type: '❌ Aucun appareil {type} trouvé',
    match_info: '🎯 Correspondance "{input}" → "{matched}" ({confidence}% confiance, {method})'
  },
  'de': {
    room_header: '🏠 **{room}** Status',
    device_count: '📱 {count} Geräte gefunden',
    no_devices: '❌ Keine Geräte in {room} gefunden',
    device_offline: '📴 Offline',
    device_online: '✅ Online',
    summary_header: '📊 **Zusammenfassung**',
    details_header: '📋 **Gerätedetails**',
    room_not_found: '❌ Raum "{room}" nicht gefunden',
    available_rooms: 'Verfügbare Räume: {rooms}',
    global_status: '🌍 **Globaler Hausstatus**',
    device_type_status: '🔧 **{type} Geräte Status**',
    no_devices_of_type: '❌ Keine {type} Geräte gefunden',
    match_info: '🎯 Übereinstimmung "{input}" → "{matched}" ({confidence}% Vertrauen, {method})'
  },
  'es': {
    room_header: '🏠 **{room}** Estado',
    device_count: '📱 {count} dispositivos encontrados',
    no_devices: '❌ No se encontraron dispositivos en {room}',
    device_offline: '📴 Desconectado',
    device_online: '✅ Conectado',
    summary_header: '📊 **Resumen**',
    details_header: '📋 **Detalles de Dispositivos**',
    room_not_found: '❌ Habitación "{room}" no encontrada',
    available_rooms: 'Habitaciones disponibles: {rooms}',
    global_status: '🌍 **Estado Global del Hogar**',
    device_type_status: '🔧 **Estado de Dispositivos {type}**',
    no_devices_of_type: '❌ No se encontraron dispositivos {type}',
    match_info: '🎯 Coincidencia "{input}" → "{matched}" ({confidence}% confianza, {method})'
  }
};

/**
 * Get localized text template
 * @param {string} key - Template key
 * @param {string} language - Language code
 * @param {Object} params - Parameters to substitute
 * @returns {string} Formatted text
 */
function getLocalizedText(key, language = 'en', params = {}) {
  const templates = STATUS_TEMPLATES[language] || STATUS_TEMPLATES.en;
  let text = templates[key] || STATUS_TEMPLATES.en[key] || key;

  // Substitute parameters
  Object.keys(params).forEach(param => {
    text = text.replace(new RegExp(`{${param}}`, 'g'), params[param]);
  });

  return text;
}

/**
 * Format room status for display
 * @param {Object} roomStatus - Room status object from getRoomStatus
 * @param {string} language - Language for formatting
 * @param {boolean} includeDetails - Whether to include detailed device info
 * @returns {string} Formatted status text
 */
function formatRoomStatus(roomStatus, language = 'en', includeDetails = true) {
  if (!roomStatus.success) {
    const errorText = getLocalizedText('room_not_found', language, { room: roomStatus.roomName });
    if (roomStatus.error && roomStatus.error.includes('Available rooms:')) {
      const roomsList = roomStatus.error.split('Available rooms: ')[1];
      const availableText = getLocalizedText('available_rooms', language, { rooms: roomsList });
      return `${errorText}\n${availableText}`;
    }
    return errorText;
  }

  const parts = [];

  // Header
  parts.push(getLocalizedText('room_header', language, { room: roomStatus.matchedRoom }));

  // Match info (if advanced matching was used)
  if (roomStatus.matchConfidence && roomStatus.matchConfidence < 1.0) {
    const matchInfo = getLocalizedText('match_info', language, {
      input: roomStatus.roomName,
      matched: roomStatus.matchedRoom,
      confidence: Math.round(roomStatus.matchConfidence * 100),
      method: roomStatus.matchMethod
    });
    parts.push(matchInfo);
  }

  // Summary
  parts.push(''); // Empty line
  parts.push(getLocalizedText('summary_header', language));

  if (roomStatus.deviceCount === 0) {
    parts.push(getLocalizedText('no_devices', language, { room: roomStatus.matchedRoom }));
    return parts.join('\n');
  }

  parts.push(getLocalizedText('device_count', language, { count: roomStatus.deviceCount }));

  // Quick status overview
  const onlineDevices = roomStatus.devices.filter(d => d.isOnline).length;
  const offlineDevices = roomStatus.deviceCount - onlineDevices;

  if (onlineDevices > 0) {
    parts.push(`${getLocalizedText('device_online', language)}: ${onlineDevices}`);
  }
  if (offlineDevices > 0) {
    parts.push(`${getLocalizedText('device_offline', language)}: ${offlineDevices}`);
  }

  // Device details
  if (includeDetails && roomStatus.devices.length > 0) {
    parts.push(''); // Empty line
    parts.push(getLocalizedText('details_header', language));

    roomStatus.devices.forEach(device => {
      const statusLine = `• **${device.name}** (${device.class}): ${device.summary}`;
      parts.push(statusLine);
    });
  }

  return parts.join('\n');
}

/**
 * Format device type status for display
 * @param {Object} deviceTypeStatus - Device type status object
 * @param {string} language - Language for formatting
 * @param {boolean} includeDetails - Whether to include detailed device info
 * @returns {string} Formatted status text
 */
function formatDeviceTypeStatus(deviceTypeStatus, language = 'en', includeDetails = true) {
  const parts = [];

  // Header
  parts.push(getLocalizedText('device_type_status', language, { type: deviceTypeStatus.deviceType }));

  // Summary
  parts.push(''); // Empty line
  parts.push(getLocalizedText('summary_header', language));

  if (deviceTypeStatus.deviceCount === 0) {
    parts.push(getLocalizedText('no_devices_of_type', language, { type: deviceTypeStatus.deviceType }));
    return parts.join('\n');
  }

  parts.push(getLocalizedText('device_count', language, { count: deviceTypeStatus.deviceCount }));

  // Quick status overview
  const onlineDevices = deviceTypeStatus.devices.filter(d => d.isOnline).length;
  const offlineDevices = deviceTypeStatus.deviceCount - onlineDevices;

  if (onlineDevices > 0) {
    parts.push(`${getLocalizedText('device_online', language)}: ${onlineDevices}`);
  }
  if (offlineDevices > 0) {
    parts.push(`${getLocalizedText('device_offline', language)}: ${offlineDevices}`);
  }

  // Device details
  if (includeDetails && deviceTypeStatus.devices.length > 0) {
    parts.push(''); // Empty line
    parts.push(getLocalizedText('details_header', language));

    deviceTypeStatus.devices.forEach(device => {
      const statusLine = `• **${device.name}**: ${device.summary}`;
      parts.push(statusLine);
    });
  }

  return parts.join('\n');
}

/**
 * Format global home status for display
 * @param {Array} allDevices - Array of all device status objects
 * @param {string} language - Language for formatting
 * @param {boolean} includeDetails - Whether to include detailed device info
 * @returns {string} Formatted status text
 */
function formatGlobalStatus(allDevices, language = 'en', includeDetails = false) {
  const parts = [];

  // Header
  parts.push(getLocalizedText('global_status', language));

  // Summary
  parts.push(''); // Empty line
  parts.push(getLocalizedText('summary_header', language));

  const totalDevices = allDevices.length;
  const onlineDevices = allDevices.filter(d => d.isOnline).length;
  const offlineDevices = totalDevices - onlineDevices;

  parts.push(getLocalizedText('device_count', language, { count: totalDevices }));

  if (onlineDevices > 0) {
    parts.push(`${getLocalizedText('device_online', language)}: ${onlineDevices}`);
  }
  if (offlineDevices > 0) {
    parts.push(`${getLocalizedText('device_offline', language)}: ${offlineDevices}`);
  }

  // Device type breakdown
  const devicesByType = {};
  allDevices.forEach(device => {
    const type = device.class || 'unknown';
    if (!devicesByType[type]) {
      devicesByType[type] = { total: 0, online: 0 };
    }
    devicesByType[type].total++;
    if (device.isOnline) {
      devicesByType[type].online++;
    }
  });

  if (Object.keys(devicesByType).length > 1) {
    parts.push(''); // Empty line
    parts.push('**Device Types:**');
    Object.entries(devicesByType).forEach(([type, counts]) => {
      parts.push(`• ${type}: ${counts.online}/${counts.total} online`);
    });
  }

  // Device details (only if requested and not too many devices)
  if (includeDetails && allDevices.length <= 10) {
    parts.push(''); // Empty line
    parts.push(getLocalizedText('details_header', language));

    allDevices.forEach(device => {
      const statusLine = `• **${device.name}** (${device.class}): ${device.summary}`;
      parts.push(statusLine);
    });
  } else if (includeDetails && allDevices.length > 10) {
    parts.push(''); // Empty line
    parts.push('_Too many devices to show details. Use room-specific queries for details._');
  }

  return parts.join('\n');
}

/**
 * Format a simple device status for display
 * @param {Object} deviceStatus - Single device status object
 * @param {string} language - Language for formatting
 * @returns {string} Formatted status text
 */
function formatSingleDeviceStatus(deviceStatus, language = 'en') {
  const parts = [];

  parts.push(`🔧 **${deviceStatus.name}** (${deviceStatus.class})`);
  parts.push(`Status: ${deviceStatus.summary}`);

  if (!deviceStatus.isOnline) {
    parts.push(`⚠️ ${getLocalizedText('device_offline', language)}`);
  }

  return parts.join('\n');
}

module.exports = {
  STATUS_TEMPLATES,
  getLocalizedText,
  formatRoomStatus,
  formatDeviceTypeStatus,
  formatGlobalStatus,
  formatSingleDeviceStatus
};
