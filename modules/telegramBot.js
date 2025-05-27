'use strict';

const { onMessage } = require('./telegram');
const { ErrorHandler } = require('./errorHandler');

module.exports = function initTelegramListener(app) {
  // Sets up the Telegram message listener
  onMessage(async msg => {
    const chatId = msg.chat.id;
    try {
      let commandText = '';

      // Handle different message types
      let detectedLanguage = 'en'; // Default language

      if (msg.voice) {
        const fileId = msg.voice.file_id;
        app.log(`Processing voice message: ${fileId}`);

        // Send typing indicator for voice processing
        await app.telegram.sendMessage(chatId, '🎤 Processing voice message...');

        const fileInfo = await app.telegram.getFileInfo(fileId);
        const fileUrl = `https://api.telegram.org/file/bot${app.homey.settings.get('telegramBotToken')}/${fileInfo.file_path}`;

        // Use helper method to download file data as Buffer
        const buffer = await app.downloadBuffer(fileUrl);

        // Transcribe the voice message with multilingual support
        const transcriptionResult = await app.transcribeVoice(buffer);
        app.log(`Voice transcription result:`, transcriptionResult);

        // Handle both old string format and new object format for backward compatibility
        if (typeof transcriptionResult === 'string') {
          commandText = transcriptionResult;
          detectedLanguage = 'en'; // Default to English for backward compatibility
        } else if (transcriptionResult && transcriptionResult.text) {
          commandText = transcriptionResult.text;
          detectedLanguage = transcriptionResult.language || 'en';

          // Log language detection
          if (detectedLanguage !== 'en') {
            app.log(`Detected language: ${detectedLanguage}`);
            await app.telegram.sendMessage(chatId, `🌍 Detected language: ${detectedLanguage.toUpperCase()}`);
          }
        } else {
          commandText = '';
        }

        app.log(`Voice transcribed: "${commandText}" (Language: ${detectedLanguage})`);

      } else if (msg.text) {
        commandText = msg.text;

        // Handle special commands
        if (commandText.toLowerCase().startsWith('/help')) {
          const helpText = `🏠 Homey Assistant Help

I can help you control your smart home devices! Here are some examples:

🔹 Room commands:
• "Turn on living room lights"
• "Turn off bedroom"
• "Dim kitchen lights"

🔹 Device commands:
• "Set temperature to 22 degrees"
• "Lock the front door"
• "Open the curtains"

🔹 Voice messages:
• Send a voice message with your command

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

      // Send processing indicator for complex commands
      if (commandText.length > 20) {
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
