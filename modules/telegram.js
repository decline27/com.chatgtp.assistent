'use strict';

const https = require('https');

let messageCallback = null;
let pollTimeout = null;
let lastUpdateId = 0;
let botToken = null;
const POLL_INTERVAL = 1000; // 1 second

/**
 * Initialize the Telegram bot with the provided token.
 * @param {String} token - The Telegram bot token
 * @returns {Promise<boolean>} - True if initialization was successful
 */
async function initBot(token) {
  if (!token) {
    throw new Error('Telegram bot token is required');
  }
  
  botToken = token;
  
  // Verify the token by making a test request
  try {
    const response = await httpGet(`https://api.telegram.org/bot${token}/getMe`);
    const data = JSON.parse(response);
    if (!data.ok) {
      throw new Error(data.description || 'Invalid bot token');
    }
    console.log('Telegram bot initialized successfully:', data.result.username);
    return true;
  } catch (error) {
    throw new Error(`Failed to initialize Telegram bot: ${error.message}`);
  }
}

/**
 * Listen for incoming messages.
 * @param {Function} callback - Callback function receiving the message object.
 */
function onMessage(callback) {
  if (!botToken) {
    throw new Error('Bot must be initialized before setting up message listener');
  }
  console.log('Setting up Telegram message listener...');
  messageCallback = callback;
  startPolling();
}

function startPolling() {
  getUpdates(lastUpdateId + 1)
    .then(updates => {
      updates.forEach(update => {
        if (messageCallback && update.message) {
          console.log('Received Telegram message:', update.message);
          messageCallback(update.message);
        }
        lastUpdateId = update.update_id;
      });
      // Continue polling
      pollTimeout = setTimeout(startPolling, POLL_INTERVAL);
    })
    .catch(error => {
      console.error('Polling error:', error);
      // Retry after error
      pollTimeout = setTimeout(startPolling, POLL_INTERVAL);
    });
}

/**
 * Get updates from Telegram API.
 * @param {Number} offset - Identifier of the first update to be returned.
 * @returns {Promise<Array>} Array of updates.
 */
async function getUpdates(offset = 0) {
  const url = `https://api.telegram.org/bot${botToken}/getUpdates?offset=${offset}&timeout=10`;
  const response = await httpGet(url);
  const data = JSON.parse(response);
  if (!data.ok) {
    console.error('Telegram API error:', data);
    return [];
  }
  return data.result;
}

/**
 * Send a message back to the user.
 * @param {Number} chatId - The Telegram chat ID.
 * @param {String} text - The message text.
 */
async function sendMessage(chatId, text) {
  const data = JSON.stringify({
    chat_id: chatId,
    text: text
  });

  const options = {
    hostname: 'api.telegram.org',
    path: `/bot${botToken}/sendMessage`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(data)
    }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', chunk => (responseData += chunk));
      res.on('end', () => {
        try {
          const parsedData = JSON.parse(responseData);
          if (!parsedData.ok) {
            reject(new Error(parsedData.description || 'Failed to send message'));
          } else {
            console.log(`Sent message to chat ${chatId}: "${text}"`);
            resolve(parsedData);
          }
        } catch (error) {
          reject(new Error('Failed to parse Telegram API response'));
        }
      });
    });
    req.on('error', (err) => {
      console.error('Error sending message:', err);
      reject(err);
    });
    req.write(data);
    req.end();
  });
}

/**
 * Retrieve file information from Telegram (used for downloading voice files).
 * @param {String} fileId - File identifier from a voice message.
 */
async function getFileInfo(fileId) {
  const url = `https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`;
  const response = await httpGet(url);
  const data = JSON.parse(response);
  if (data.ok) {
    console.log(`Retrieved file info for file_id ${fileId}:`, data.result);
  } else {
    console.error(`Failed to get file info for file_id ${fileId}:`, data);
  }
  return data.ok ? data.result : null;
}

/**
 * Helper function to make HTTP GET requests.
 * @param {String} url - The URL to request.
 * @returns {Promise<String>} Response body.
 */
function httpGet(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        let data = '';
        res.on('data', chunk => (data += chunk));
        res.on('end', () => resolve(data));
      })
      .on('error', (err) => {
        console.error('HTTP GET error:', err);
        reject(err);
      });
  });
}

module.exports = { initBot, onMessage, sendMessage, getFileInfo };
