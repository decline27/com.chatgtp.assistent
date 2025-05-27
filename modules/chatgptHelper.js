'use strict';

function constructPrompt(commandText, homeState) {
	// Summarize zones (only id and name)
	const zonesSummary = {};
	for (const [zoneId, zone] of Object.entries(homeState.zones || {})) {
		zonesSummary[zoneId] = zone.name;
	}

	// Summarize devices: include id, name, zone, and class.
	const devicesSummary = Object.values(homeState.devices || {}).map(device => ({
		id: device.id,
		name: device.name,
		zone: device.zone,
		class: device.class
	}));

	// Enhanced device class mapping for better context and capability understanding
	const deviceClassMapping = {
		"light": {
			"capabilities": ["onoff", "dim", "light_hue", "light_saturation", "light_temperature", "light_mode"],
			"common_commands": ["turn_on", "turn_off", "dim"],
			"description": "Lighting devices that can be turned on/off and often dimmed"
		},
		"socket": {
			"capabilities": ["onoff"],
			"common_commands": ["turn_on", "turn_off"],
			"description": "Power outlets and smart plugs"
		},
		"speaker": {
			"capabilities": ["speaker_playing", "speaker_next", "speaker_prev", "volume_set"],
			"common_commands": ["turn_on", "turn_off", "speaker_next", "speaker_prev"],
			"description": "Audio devices and speakers"
		},
		"thermostat": {
			"capabilities": ["target_temperature", "measure_temperature"],
			"common_commands": ["set_temperature"],
			"description": "Temperature control devices"
		},
		"sensor": {
			"capabilities": ["measure_temperature", "measure_humidity", "alarm_motion", "alarm_contact"],
			"common_commands": [],
			"description": "Sensors for monitoring (read-only)"
		},
		"fan": {
			"capabilities": ["onoff", "fan_speed"],
			"common_commands": ["turn_on", "turn_off"],
			"description": "Fans and ventilation devices"
		},
		"curtain": {
			"capabilities": ["windowcoverings_set", "windowcoverings_state"],
			"common_commands": ["open", "close"],
			"description": "Window coverings and blinds"
		},
		"lock": {
			"capabilities": ["locked"],
			"common_commands": ["lock", "unlock"],
			"description": "Door locks and security devices"
		},
		"tv": {
			"capabilities": ["onoff", "volume_set", "channel_up", "channel_down"],
			"common_commands": ["turn_on", "turn_off"],
			"description": "Television and entertainment devices"
		}
	};

	const summary = {
		zones: zonesSummary,
		devices: devicesSummary,
		deviceClassMapping: deviceClassMapping
	};

	return `You are a Homey home automation expert with multilingual support. Convert this natural language command into valid JSON.

AVAILABLE DEVICES AND ROOMS:
${JSON.stringify(summary, null, 2)}

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

4. For STATUS queries, use:
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
- "Sätt på vardagsrummet ljus" → {"room": "living room", "command": "turn_on"}
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

module.exports = { constructPrompt };
