'use strict';

/**
 * Construct a ChatGPT prompt with size limits to prevent exceeding API limits
 * @param {string} commandText - The command text to process
 * @param {Object} homeState - The home state containing devices and zones
 * @param {Object} options - Optional configuration
 * @returns {string} The constructed prompt
 */
function constructPrompt(commandText, homeState, options = {}) {
  const { maxPromptLength = 9500, maxDevices = 50 } = options; // Leave buffer for safety

  // Summarize zones (only id and name)
  const zonesSummary = {};
  for (const [zoneId, zone] of Object.entries(homeState.zones || {})) {
    zonesSummary[zoneId] = zone.name;
  }

  // Summarize devices: include id, name, zone, and class.
  // Limit the number of devices to prevent prompt overflow
  const allDevices = Object.values(homeState.devices || {});
  const limitedDevices = allDevices.slice(0, maxDevices);

  const devicesSummary = limitedDevices.map(device => ({
    id: device.id,
    name: device.name,
    zone: device.zone,
    class: device.class
  }));

  // Enhanced device class mapping for better context and capability understanding
  const deviceClassMapping = {
    'light': {
      'capabilities': ['onoff', 'dim', 'light_hue', 'light_saturation', 'light_temperature', 'light_mode'],
      'common_commands': ['turn_on', 'turn_off', 'dim'],
      'description': 'Lighting devices that can be turned on/off and often dimmed'
    },
    'socket': {
      'capabilities': ['onoff'],
      'common_commands': ['turn_on', 'turn_off'],
      'description': 'Power outlets and smart plugs'
    },
    'speaker': {
      'capabilities': ['speaker_playing', 'speaker_next', 'speaker_prev', 'volume_set'],
      'common_commands': ['turn_on', 'turn_off', 'speaker_next', 'speaker_prev'],
      'description': 'Audio devices and speakers'
    },
    'thermostat': {
      'capabilities': ['target_temperature', 'measure_temperature'],
      'common_commands': ['set_temperature'],
      'description': 'Temperature control devices'
    },
    'sensor': {
      'capabilities': ['measure_temperature', 'measure_humidity', 'alarm_motion', 'alarm_contact'],
      'common_commands': [],
      'description': 'Sensors for monitoring (read-only)'
    },
    'fan': {
      'capabilities': ['onoff', 'fan_speed'],
      'common_commands': ['turn_on', 'turn_off'],
      'description': 'Fans and ventilation devices'
    },
    'curtain': {
      'capabilities': ['windowcoverings_set', 'windowcoverings_state'],
      'common_commands': ['open', 'close'],
      'description': 'Window coverings and blinds'
    },
    'lock': {
      'capabilities': ['locked'],
      'common_commands': ['lock', 'unlock'],
      'description': 'Door locks and security devices'
    },
    'tv': {
      'capabilities': ['onoff', 'volume_set', 'channel_up', 'channel_down'],
      'common_commands': ['turn_on', 'turn_off'],
      'description': 'Television and entertainment devices'
    }
  };

  const summary = {
    zones: zonesSummary,
    devices: devicesSummary,
    deviceClassMapping
  };

  // Build the prompt and check size
  let prompt = buildFullPrompt(commandText, summary, allDevices.length, limitedDevices.length);

  // If prompt is too long, try with fewer devices
  if (prompt.length > maxPromptLength) {
    console.log(`Prompt too long (${prompt.length} chars), reducing devices from ${limitedDevices.length} to ${Math.floor(maxDevices / 2)}`);

    const reducedDevices = limitedDevices.slice(0, Math.floor(maxDevices / 2));
    const reducedSummary = {
      zones: zonesSummary,
      devices: reducedDevices.map(device => ({
        id: device.id,
        name: device.name,
        zone: device.zone,
        class: device.class
      })),
      deviceClassMapping
    };

    prompt = buildFullPrompt(commandText, reducedSummary, allDevices.length, reducedDevices.length);
  }

  // If still too long, use minimal prompt
  if (prompt.length > maxPromptLength) {
    console.log(`Prompt still too long (${prompt.length} chars), using minimal prompt`);
    prompt = buildMinimalPrompt(commandText, zonesSummary);
  }

  console.log(`Final prompt length: ${prompt.length} characters`);
  return prompt;
}

/**
 * Build the full prompt with all context
 */
function buildFullPrompt(commandText, summary, totalDevices, includedDevices) {
  const deviceLimitNote = totalDevices > includedDevices ?
    `\n\nNOTE: Showing ${includedDevices} of ${totalDevices} total devices for brevity.` : '';

  return `You are a Homey home automation expert with multilingual support. Convert this natural language command into valid JSON.

AVAILABLE DEVICES AND ROOMS:
${JSON.stringify(summary, null, 2)}${deviceLimitNote}

COMMAND TO PROCESS: "${commandText}"

RESPONSE RULES:
1. Output ONLY valid JSON - no explanations
2. For SINGLE commands, use these formats:
   - Room: {"room": "<exact_room_name>", "command": "<action>"}
   - Multiple devices: {"device_ids": ["id1", "id2"], "command": "<action>"}
   - Single device: {"device_id": "<device_id>", "command": "<action>"}
   - Error: {"error": "<helpful_message>"}

3. For MULTIPLE commands (with "and", "then", etc.), use:
   - Multi-command: {"commands": [{"room": "<room>", "command": "<action>", "device_filter": "<type>"}, ...]}

4. DEVICE FILTERS (CRITICAL for Swedish commands):
   - ALWAYS add "device_filter": "light" when command mentions lights/ljus/lampa
   - Swedish "ljus" = English "light" → MUST use "device_filter": "light"
   - Swedish "lampor" = English "lights" → MUST use "device_filter": "light"

5. For STATUS queries, use:
   - Room status: {"query_type": "status", "room": "<room_name>"}
   - Device status: {"query_type": "status", "device": "<device_name>", "room": "<room_name>"}
   - Device type status: {"query_type": "status", "device_type": "<type>", "room": "<room_name>"}
   - Global status: {"query_type": "status", "scope": "global"}

5. STATUS QUERY INDICATORS:
   - English: "what's", "what is", "show", "status", "state", "how", "is", "are", "check", "tell me"
   - Swedish: "vad är", "visa", "status", "tillstånd", "hur", "är", "kolla"
   - French: "qu'est-ce que", "quel est", "montre", "statut", "état", "comment"
   - German: "was ist", "wie ist", "zeige", "status", "zustand"
   - Spanish: "qué es", "cuál es", "muestra", "estado", "cómo"

6. ROOM PRIORITY: If ANY room is mentioned, use room format (never device_ids)
7. MULTILINGUAL SUPPORT: Understand commands in multiple languages but ALWAYS output English room names:
   - Input "vardagsrum", "salon", "wohnzimmer", "sala de estar" → Output "living room"
   - Input "sovrum", "chambre", "schlafzimmer", "dormitorio" → Output "bedroom"
   - Input "kök", "cuisine", "küche", "cocina" → Output "kitchen"
   - Input "badrum", "salle de bain", "badezimmer", "baño" → Output "bathroom"
   - Input "kontor", "bureau", "büro", "oficina" → Output "office"

6. ROOM NAME RULE: ALWAYS use English room names in JSON output, regardless of input language
7. COMMON COMMANDS: turn_on, turn_off, dim, set_temperature, play_music, stop_music, open, close, lock, unlock
8. DEFAULT BEHAVIOR: For lights without clear on/off, default to "turn_on"
9. DEVICE CONTEXT: Consider device class when choosing commands
10. DEVICE FILTERS: Use "light", "speaker", "socket", "thermostat", etc. to target specific device types

EXAMPLES (English):
- "Turn on living room lights" → {"room": "living room", "command": "turn_on"}
- "Dim bedroom" → {"room": "bedroom", "command": "dim"}
- "Turn on lights and play music in living room" → {"commands": [{"room": "living room", "command": "turn_on", "device_filter": "light"}, {"room": "living room", "command": "play_music", "device_filter": "speaker"}]}

EXAMPLES (Spanish - note English room names in output):
- "Encender las luces de la sala de estar" → {"room": "living room", "command": "turn_on"}
- "Atenuar dormitorio" → {"room": "bedroom", "command": "dim"}

EXAMPLES (French - note English room names in output):
- "Allumer les lumières du salon" → {"room": "living room", "command": "turn_on"}
- "Éteindre chambre" → {"room": "bedroom", "command": "turn_off"}

EXAMPLES (German - note English room names in output):
- "Wohnzimmer Licht einschalten" → {"room": "living room", "command": "turn_on"}
- "Schlafzimmer dimmen" → {"room": "bedroom", "command": "dim"}

EXAMPLES (Swedish - note English room names in output):
- "Sätt på vardagsrummet ljus" → {"room": "living room", "command": "turn_on", "device_filter": "light"}
- "Tänd ljuset i hela huset" → {"commands": [{"room": "living room", "command": "turn_on", "device_filter": "light"}, {"room": "bedroom", "command": "turn_on", "device_filter": "light"}]}
- "Slå på allt ljuset" → {"commands": [{"room": "living room", "command": "turn_on", "device_filter": "light"}, {"room": "kitchen", "command": "turn_on", "device_filter": "light"}]}
- "Stäng av sovrum" → {"room": "bedroom", "command": "turn_off"}

EXAMPLES (Multi-command with English room names):
- "Turn on lights and play music in living room" → {"commands": [{"room": "living room", "command": "turn_on", "device_filter": "light"}, {"room": "living room", "command": "play_music", "device_filter": "speaker"}]}
- "Encender luces y música en sala de estar" → {"commands": [{"room": "living room", "command": "turn_on", "device_filter": "light"}, {"room": "living room", "command": "play_music", "device_filter": "speaker"}]}

EXAMPLES (Status queries):
- "What's the status of kitchen lights?" → {"query_type": "status", "device_type": "light", "room": "kitchen"}
- "Show me all devices in bedroom" → {"query_type": "status", "room": "bedroom"}
- "Is the thermostat on?" → {"query_type": "status", "device_type": "thermostat"}
- "Vad är status på vardagsrummet?" → {"query_type": "status", "room": "living room"}
- "Montre-moi tous les appareils" → {"query_type": "status", "scope": "global"}
- "Wie ist der Status der Lichter im Schlafzimmer?" → {"query_type": "status", "device_type": "light", "room": "bedroom"}

OUTPUT JSON:`;
}

/**
 * Build a minimal prompt when the full prompt is too long
 */
function buildMinimalPrompt(commandText, zonesSummary) {
  // Limit room names to prevent prompt from being too long
  const roomNames = Object.values(zonesSummary).slice(0, 10).join(', ');
  const roomCount = Object.values(zonesSummary).length;
  const roomNote = roomCount > 10 ? ` (showing 10 of ${roomCount} rooms)` : '';

  // Detect if this is a lights command
  const isLightCommand = /light|lights|lamp|lamps|ljus|lampa|lampor|ligt|ligts|belysning/i.test(commandText);
  const deviceFilterNote = isLightCommand ? '\n- Add "device_filter": "light" for light commands' : '';

  return `Convert this command to JSON.

ROOMS: ${roomNames}${roomNote}
COMMAND: "${commandText}"

OUTPUT FORMATS:
- Room: {"room": "<name>", "command": "<action>", "device_filter": "<type>"}
- Multi-room: {"commands": [{"room": "<name>", "command": "<action>", "device_filter": "<type>"}, ...]}
- Status: {"query_type": "status", "room": "<name>"}
- Error: {"error": "<message>"}${deviceFilterNote}

DEVICE FILTERS: light, speaker, socket, thermostat
COMMANDS: turn_on, turn_off, dim, lock, unlock

EXAMPLES:
- "Turn on lights" → {"room": "all", "command": "turn_on", "device_filter": "light"}
- "Tänd ljuset i hela huset" → {"commands": [{"room": "Room1", "command": "turn_on", "device_filter": "light"}, {"room": "Room2", "command": "turn_on", "device_filter": "light"}]}

OUTPUT JSON:`;
}

module.exports = { constructPrompt };
