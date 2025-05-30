'use strict';

const { onMessage } = require('./telegram');
const { ErrorHandler } = require('./errorHandler');

// Rate limiting map: chatId -> { count, resetTime }
const rateLimits = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const DEFAULT_RATE_LIMIT = 10; // 10 commands per minute

/**
 * Check if user is authorized to use the bot
 * @param {number} chatId - Telegram chat ID
 * @param {object} app - Homey app instance
 * @returns {boolean} - Whether user is authorized
 */
function isUserAuthorized(chatId, app) {
  const allowedUsers = app.homey?.settings?.get('allowedTelegramUsers');
  
  // If no restrictions are set, allow all users
  if (!allowedUsers || allowedUsers.length === 0) {
    return true;
  }
  
  // Check if user is in allowed list
  return allowedUsers.includes(chatId.toString()) || allowedUsers.includes(chatId);
}

/**
 * Check rate limiting for user
 * @param {number} chatId - Telegram chat ID
 * @param {object} app - Homey app instance
 * @returns {boolean} - Whether user is within rate limits
 */
function checkRateLimit(chatId, app) {
  const now = Date.now();
  const userLimit = app.homey?.settings?.get('telegramRateLimit') || DEFAULT_RATE_LIMIT;
  
  if (!rateLimits.has(chatId)) {
    rateLimits.set(chatId, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return true;
  }
  
  const userRateData = rateLimits.get(chatId);
  
  // Reset if window has passed
  if (now > userRateData.resetTime) {
    rateLimits.set(chatId, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return true;
  }
  
  // Check if under limit
  if (userRateData.count < userLimit) {
    userRateData.count++;
    return true;
  }
  
  return false;
}

module.exports = function initTelegramListener(app) {
  // Sets up the Telegram message listener
  onMessage(async msg => {
    const chatId = msg.chat.id;
    
    try {
      // Check user authorization
      if (!isUserAuthorized(chatId, app)) {
        await app.telegram.sendMessage(chatId, '❌ Unauthorized: You are not allowed to use this bot.');
        app.log(`Unauthorized access attempt from chat ID: ${chatId}`);
        return;
      }
      
      // Check rate limiting
      if (!checkRateLimit(chatId, app)) {
        await app.telegram.sendMessage(chatId, '⏰ Rate limit exceeded. Please wait before sending more commands.');
        app.log(`Rate limit exceeded for chat ID: ${chatId}`);
        return;
      }
      
      let commandText = '';

      // Handle different message types
      let detectedLanguage = 'en'; // Default language

      if (msg.voice) {
        const fileId = msg.voice.file_id;
        app.log(`Processing voice message: ${fileId}`);

        // Send typing indicator for voice processing
        await app.telegram.sendMessage(chatId, '🎤 Processing voice message...');

        const fileInfo = await app.telegram.getFileInfo(fileId);
        
        // Use secure key manager instead of direct Homey settings access
        const { getKeyManager } = require('./secureKeyManager');
        const keyManager = getKeyManager();
        const botToken = keyManager.getKey('telegram');
        const fileUrl = `https://api.telegram.org/file/bot${botToken}/${fileInfo.file_path}`;

        // Use helper method to download file data as Buffer
        const buffer = await app.downloadBuffer(fileUrl);

        // Get devices for enhanced speech recognition context
        const devices = await app.getDevicesMapping();

        // Transcribe the voice message with multilingual support and device context
        const transcriptionResult = await app.transcribeVoice(buffer, 'auto', devices);
        app.log(`Voice transcription result:`, transcriptionResult);

        // Handle both old string format and new object format for backward compatibility
        if (typeof transcriptionResult === 'string') {
          commandText = transcriptionResult;
          detectedLanguage = 'en'; // Default to English for backward compatibility
        } else if (transcriptionResult && transcriptionResult.text) {
          commandText = transcriptionResult.text;
          detectedLanguage = transcriptionResult.language || 'en';


        } else {
          commandText = '';
        }

        app.log(`Voice transcribed: "${commandText}" (Language: ${detectedLanguage})`);

      } else if (msg.text) {
        commandText = msg.text;

        // Handle special commands
        if (commandText.toLowerCase().startsWith('/help')) {
          // Generate dynamic help text based on available devices
          const homeState = await app.getHomeState();
          const deviceClasses = [...new Set(Object.values(homeState.devices || {}).map(device => device.class))];
          const roomNames = Object.values(homeState.zones || {}).map(zone => zone.name).slice(0, 3); // Show first 3 rooms
          
          const helpText = `🏠 Homey Assistant Help

I can help you control your smart home devices! Here are some examples based on your setup:

🔹 Room commands:
${roomNames.map(room => `• "Turn on ${room} lights"`).join('\n')}
• "Turn off bedroom"
• "Dim kitchen lights"

🔹 Device commands:
${deviceClasses.includes('thermostat') ? '• "Set temperature to 22 degrees"\n' : ''}${deviceClasses.includes('lock') ? '• "Lock the front door"\n' : ''}${deviceClasses.includes('curtain') ? '• "Open the curtains"\n' : ''} 
🔹 Voice messages:
• Send a voice message with your command

🔹 Status queries:
• "What's the status of the living room?"
• "Show me all lights"
• "/status" for system status

Available device types: ${deviceClasses.join(', ')}
Available rooms: ${roomNames.join(', ')}${Object.keys(homeState.zones || {}).length > 3 ? ' and more...' : ''}

Tips for better results:
• Be specific about rooms and devices
• Use clear action words (turn on/off, set, open/close)
• Mention the room name when possible

Try saying something like "Turn on the living room lights" or send a voice message!`;

          await app.telegram.sendMessage(chatId, helpText);
          return;
        }

        if (commandText.toLowerCase().startsWith('/status')) {
          // Provide system status
          const homeState = await app.getHomeState();
          const deviceCount = Object.keys(homeState.devices || {}).length;
          const zoneCount = Object.keys(homeState.zones || {}).length;

          const statusText = `🏠 System Status

📱 Devices: ${deviceCount} connected
🏠 Rooms: ${zoneCount} configured
✅ ChatGPT: Connected
✅ Telegram: Connected

Ready to process commands!`;

          await app.telegram.sendMessage(chatId, statusText);
          return;
        }

      } else {
        await app.telegram.sendMessage(chatId, '❌ Unsupported message type. Please send text or voice messages.');
        return;
      }

      if (!commandText || commandText.trim() === '') {
        await app.telegram.sendMessage(chatId, '❌ Empty command. Please tell me what you\'d like to do!');
        return;
      }

      // Send processing indicator for complex commands (configurable threshold)
      const processingThreshold = app.homey?.settings?.get('processingIndicatorThreshold') || 50;
      if (commandText.length > processingThreshold) {
        await app.telegram.sendMessage(chatId, '🤔 Processing your request...');
      }

      // Parse and execute command with language information
      const jsonCommand = await app.parseCommandWithState(commandText, detectedLanguage);

      if (jsonCommand.error) {
        const errorMsg = `❌ ${jsonCommand.error}`;
        await app.telegram.sendMessage(chatId, errorMsg);
        return;
      }

      const resultMessage = await app.executeHomeyCommand(jsonCommand);
      await app.telegram.sendMessage(chatId, resultMessage);
      app.log(`Command executed successfully: ${resultMessage}`);

    } catch (error) {
      // Log error with standardized format
      ErrorHandler.log(error, app, { context: 'telegram_message_processing', chatId });

      // Provide user-friendly error messages based on error type
      let errorMsg;

      if (error.name === 'StandardError') {
        // Use the standardized user message
        errorMsg = error.toUserMessage();
      } else {
        // Handle legacy errors with improved categorization
        if (error.message.includes('API') || error.message.includes('api')) {
          errorMsg = '❌ Service error: There was an issue connecting to the service. Please try again.';
        } else if (error.message.includes('not found') || error.message.includes('Not found')) {
          errorMsg = '❌ Not found: I couldn\'t find that device or room. Try \'/status\' to see available devices.';
        } else if (error.message.includes('timeout') || error.message.includes('Timeout')) {
          errorMsg = '❌ Timeout: The request timed out. Please try again.';
        } else if (error.message.includes('network') || error.message.includes('Network')) {
          errorMsg = '❌ Connection error: Network issue detected. Please check your connection and try again.';
        } else if (error.message.includes('validation') || error.message.includes('Invalid')) {
          errorMsg = '❌ Invalid input: Please check your command and try again.';
        } else {
          errorMsg = `❌ Error: ${error.message}`;
        }
      }

      try {
        await app.telegram.sendMessage(chatId, errorMsg);
      } catch (sendError) {
        // If we can't send the error message, log it but don't throw
        app.error('Failed to send error message to user:', sendError);
      }
    }
  });
};
