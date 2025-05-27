'use strict';

const https = require('https');

let openaiApiKey = null;
let logger = console;

function initChatGPT(apiKey, customLogger = null) {
  if (!apiKey) {
    throw new Error('OpenAI API key is required');
  }
  openaiApiKey = apiKey;
  if (customLogger) {
    logger = customLogger;
  }
  logger.log('ChatGPT module initialized with API key');
  return Promise.resolve();
}

function parseCommand(prompt) {
  if (!openaiApiKey) {
    logger.error('ChatGPT not initialized - missing API key');
    return Promise.resolve({ error: 'ChatGPT must be initialized with an API key first' });
  }

  logger.log('Processing prompt:', prompt);

  const data = JSON.stringify({
    model: "gpt-4o-mini", // Upgraded model for better reasoning
    messages: [{
      role: "system",
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
      role: "user",
      content: prompt
    }],
    temperature: 0.1, // Slightly higher for more natural responses while maintaining consistency
  });

  logger.log('Sending request to ChatGPT API with configuration:', {
    model: 'gpt-4o-mini',
    messageCount: 2,
    temperature: 0.1
  });

  const options = {
    hostname: 'api.openai.com',
    path: '/v1/chat/completions',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(data),
      'Authorization': `Bearer ${openaiApiKey}`
    }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let responseBody = '';
      res.on('data', chunk => responseBody += chunk);
      res.on('end', () => {
        try {
          logger.log('Received raw response from ChatGPT API');
          const response = JSON.parse(responseBody);

          if (response.error) {
            logger.error('ChatGPT API error:', response.error);
            resolve({ error: response.error.message });
            return;
          }

          if (!response.choices || !response.choices[0] || !response.choices[0].message) {
            logger.error('Invalid response structure from ChatGPT API:', response);
            resolve({ error: 'Invalid response from ChatGPT API' });
            return;
          }

          try {
            const commandText = response.choices[0].message.content.trim();
            logger.log('Received command text from ChatGPT:', commandText);

            const command = JSON.parse(commandText);
            logger.log('Successfully parsed command:', command);
            resolve(command);
          } catch (parseError) {
            logger.error('Failed to parse command from ChatGPT response:', parseError);
            resolve({ error: 'Failed to parse command from ChatGPT response' });
          }
        } catch (error) {
          logger.error('Failed to process ChatGPT response:', error);
          resolve({ error: 'Failed to process ChatGPT response' });
        }
      });
    });

    req.on('error', (error) => {
      logger.error('Network error during ChatGPT API request:', error);
      resolve({ error: error.message });
    });

    req.write(data);
    req.end();
  });
}

module.exports = {
  initChatGPT,
  parseCommand
};
