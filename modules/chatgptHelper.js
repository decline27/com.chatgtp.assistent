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
	
	// Device class mapping for context.
	const deviceClassMapping = {
		"light": {
			"capabilities": ["onoff", "dim", "light_hue", "light_saturation", "light_temperature", "light_mode"],
			"actions": {
				"turn_on": { "type": "boolean", "description": "Turn the light on" },
				"turn_off": { "type": "boolean", "description": "Turn the light off" },
				"dim": { "type": "number", "range": [0, 1], "description": "Set brightness level" },
				"light_hue": { "type": "number", "range": [0, 1], "description": "Set light color hue" },
				"light_saturation": { "type": "number", "range": [0, 1], "description": "Set color saturation" },
				"light_temperature": { "type": "number", "range": [0, 1], "description": "Set white light temperature" },
				"light_mode": { "type": "string", "values": ["color", "temperature"], "description": "Set light mode" }
			}
		},
		// ...other device classes as before...
	};

	const summary = {
		zones: zonesSummary,
		devices: devicesSummary,
		deviceClassMapping: deviceClassMapping
	};

	return `
You are a Homey automation expert. Your task is to convert the following natural language command into valid JSON that instructs Homey to control devices.
The JSON must follow one of these formats:
  - For an entire room: { "room": "<roomName>", "command": "<action>" }
  - For specific devices: { "device_ids": [ "deviceID1", "deviceID2", ... ], "command": "<action>" }
Important: If the input command mentions a room (e.g. "vardagsrummet"), output JSON ONLY with a "room" property – do not output "device_ids".
If the command refers to a room and includes lighting terms (like "ljus", "lamp"), output a command that turns on (or off) all light devices in that room.
If ambiguous, default to "turn_on" for lights and return an error for unsupported commands.
Always use explicit actions such as "turn_on" or "turn_off" based on the device capabilities described below.
Home state summary: ${JSON.stringify(summary)}
Command: "${commandText}"
Output only valid JSON.
`;
}

module.exports = { constructPrompt };
