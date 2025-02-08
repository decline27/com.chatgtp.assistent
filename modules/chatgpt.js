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
    model: "gpt-3.5-turbo",
    messages: [{
      role: "system",
      content: "You are a home automation assistant. Convert natural language commands into JSON format with device_id and command fields. Example: {\"device_id\": \"light1\", \"command\": \"turn_on\"}"
    }, {
      role: "user",
      content: prompt
    }],
    temperature: 0,
  });

  logger.log('Sending request to ChatGPT API with configuration:', {
    model: 'gpt-3.5-turbo',
    messageCount: 2,
    temperature: 0
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
