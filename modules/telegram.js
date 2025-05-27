'use strict';

const https = require('https');
const { ErrorHandler, ErrorTypes } = require('./errorHandler');
const { getKeyManager } = require('./secureKeyManager');

let messageCallback = null;
const POLL_INTERVAL = 1000; // 1 second

/**
 * Simple mutex implementation for synchronization
 */
class SimpleMutex {
  constructor() {
    this.locked = false;
    this.queue = [];
  }

  async acquire() {
    return new Promise((resolve) => {
      if (!this.locked) {
        this.locked = true;
        resolve();
      } else {
        this.queue.push(resolve);
      }
    });
  }

  release() {
    if (this.queue.length > 0) {
      const next = this.queue.shift();
      next();
    } else {
      this.locked = false;
    }
  }
}

/**
 * TelegramState class for thread-safe state management
 */
class TelegramState {
  constructor() {
    this.lastUpdateId = 0;
    this.isPolling = false;
    this.mutex = new SimpleMutex();
  }

  async updateLastId(newId) {
    await this.mutex.acquire();
    try {
      if (newId > this.lastUpdateId) {
        this.lastUpdateId = newId;
      }
    } finally {
      this.mutex.release();
    }
  }

  async getLastId() {
    await this.mutex.acquire();
    try {
      return this.lastUpdateId;
    } finally {
      this.mutex.release();
    }
  }

  async setPollingState(state) {
    await this.mutex.acquire();
    try {
      this.isPolling = state;
    } finally {
      this.mutex.release();
    }
  }

  async getPollingState() {
    await this.mutex.acquire();
    try {
      return this.isPolling;
    } finally {
      this.mutex.release();
    }
  }
}

/**
 * TelegramPoller class to handle polling with proper cleanup
 */
class TelegramPoller {
  constructor() {
    this.pollTimeout = null;
    this.abortController = new AbortController();
    this.state = new TelegramState();
  }

  async startPolling() {
    const isCurrentlyPolling = await this.state.getPollingState();
    if (isCurrentlyPolling) {
      console.log('Polling already active');
      return;
    }
    await this.state.setPollingState(true);
    console.log('Starting Telegram polling...');
    this.poll();
  }

  async stopPolling() {
    console.log('Stopping Telegram polling...');
    await this.state.setPollingState(false);
    if (this.pollTimeout) {
      clearTimeout(this.pollTimeout);
      this.pollTimeout = null;
    }
    this.abortController.abort();
    // Create new AbortController for future use
    this.abortController = new AbortController();
  }

  async poll() {
    const isPolling = await this.state.getPollingState();
    if (!isPolling) return;

    try {
      const lastId = await this.state.getLastId();
      const updates = await getUpdates(lastId + 1, this.abortController.signal);

      // Process updates with thread-safe state updates
      for (const update of updates) {
        if (messageCallback && update.message) {
          console.log('Received Telegram message:', update.message);
          messageCallback(update.message);
        }
        await this.state.updateLastId(update.update_id);
      }

      // Clear references to help garbage collection
      updates.length = 0;

    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Polling error:', error);
      }
    }

    // Schedule next poll if still active
    const stillPolling = await this.state.getPollingState();
    if (stillPolling) {
      this.pollTimeout = setTimeout(() => this.poll(), POLL_INTERVAL);
    }
  }

  async getLastUpdateId() {
    return await this.state.getLastId();
  }
}

// Global poller instance
let telegramPoller = null;

/**
 * Initialize the Telegram bot with the provided token.
 * @param {String} token - The Telegram bot token
 * @throws {StandardError} When validation fails
 * @returns {Promise<boolean>} - True if initialization was successful
 */
async function initBot(token) {
  // Input validation
  ErrorHandler.validateInput(token && typeof token === 'string', 'Telegram bot token is required and must be a string');

  try {
    // Store bot token securely
    const keyManager = getKeyManager();
    keyManager.setKey('telegram', token, 'telegram');

    // Verify the token by making a test request
    const response = await httpGet(`https://api.telegram.org/bot${token}/getMe`);
    const data = JSON.parse(response);
    if (!data.ok) {
      throw ErrorHandler.authentication(data.description || 'Invalid bot token');
    }

    const keyInfo = keyManager.getKeyInfo('telegram');
    console.log(`Telegram bot initialized successfully: ${data.result.username} (token hash: ${keyInfo.hash})`);
    return true;
  } catch (error) {
    if (error.name === 'StandardError') {
      throw error; // Re-throw StandardError as-is
    }
    throw ErrorHandler.wrap(error, ErrorTypes.AUTHENTICATION_ERROR, 'Failed to initialize Telegram bot');
  }
}

/**
 * Listen for incoming messages.
 * @param {Function} callback - Callback function receiving the message object.
 * @throws {StandardError} When bot not initialized
 */
function onMessage(callback) {
  const keyManager = getKeyManager();
  if (!keyManager.hasKey('telegram')) {
    throw ErrorHandler.authentication('Bot must be initialized before setting up message listener');
  }

  ErrorHandler.validateInput(callback && typeof callback === 'function', 'Callback must be a function');

  console.log('Setting up Telegram message listener...');
  messageCallback = callback;

  // Initialize poller if not exists
  if (!telegramPoller) {
    telegramPoller = new TelegramPoller();
  }

  telegramPoller.startPolling();
}

/**
 * Stop polling for messages (cleanup function)
 */
function stopPolling() {
  if (telegramPoller) {
    telegramPoller.stopPolling();
  }
}

/**
 * Get updates from Telegram API.
 * @param {Number} offset - Identifier of the first update to be returned.
 * @param {AbortSignal} signal - AbortController signal for cancellation.
 * @throws {StandardError} When bot not initialized or API call fails
 * @returns {Promise<Array>} Array of updates.
 */
async function getUpdates(offset = 0, signal = null) {
  const keyManager = getKeyManager();
  if (!keyManager.hasKey('telegram')) {
    throw ErrorHandler.authentication('Bot token not initialized');
  }

  const botToken = keyManager.getKey('telegram');
  const url = `https://api.telegram.org/bot${botToken}/getUpdates?offset=${offset}&timeout=10`;

  try {
    const response = await httpGet(url, signal);
    const data = JSON.parse(response);
    if (!data.ok) {
      console.error('Telegram API error:', data);
      return [];
    }
    return data.result;
  } catch (error) {
    if (error.name === 'StandardError') {
      throw error; // Re-throw StandardError as-is
    }
    throw ErrorHandler.wrap(error, ErrorTypes.API_ERROR, 'Failed to get updates from Telegram');
  }
}

/**
 * Send a message back to the user.
 * @param {Number} chatId - The Telegram chat ID.
 * @param {String} text - The message text.
 * @throws {StandardError} When input validation fails or sending fails
 * @returns {Promise<Object>} Telegram API response
 */
async function sendMessage(chatId, text) {
  // Input validation
  ErrorHandler.validateInput(chatId && (typeof chatId === 'number' || typeof chatId === 'string'), 'Chat ID must be a valid number or string');
  ErrorHandler.validateInput(text && typeof text === 'string', 'Message text must be a non-empty string');
  ErrorHandler.validateInput(text.length <= 4096, 'Message text must be 4096 characters or less');

  const keyManager = getKeyManager();
  if (!keyManager.hasKey('telegram')) {
    throw ErrorHandler.authentication('Bot token not initialized');
  }

  const botToken = keyManager.getKey('telegram');

  const data = JSON.stringify({
    chat_id: chatId,
    text
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
    const req = https.request(options, res => {
      let responseData = '';
      res.on('data', chunk => (responseData += chunk));
      res.on('end', () => {
        try {
          const parsedData = JSON.parse(responseData);
          if (!parsedData.ok) {
            const errorMessage = parsedData.description || 'Failed to send message';
            const error = ErrorHandler.api(`Telegram API error: ${errorMessage}`, {
              chatId,
              text: text.substring(0, 100), // Truncate for logging
              telegramError: parsedData
            });
            reject(error);
          } else {
            console.log(`Sent message to chat ${chatId}: "${text}"`);
            resolve(parsedData);
          }
        } catch (parseError) {
          const error = ErrorHandler.parsing('Failed to parse Telegram API response', {
            chatId,
            responseData: responseData.substring(0, 200) // Truncate for logging
          });
          reject(error);
        }
      });
    });
    req.on('error', err => {
      console.error('Error sending message:', err);
      const error = ErrorHandler.network(`Network error sending message: ${err.message}`, {
        chatId,
        text: text.substring(0, 100) // Truncate for logging
      });
      reject(error);
    });
    req.write(data);
    req.end();
  });
}

/**
 * Retrieve file information from Telegram (used for downloading voice files).
 * @param {String} fileId - File identifier from a voice message.
 * @throws {StandardError} When file retrieval fails
 * @returns {Promise<Object>} File information object
 */
async function getFileInfo(fileId) {
  // Input validation
  ErrorHandler.validateInput(fileId && typeof fileId === 'string', 'File ID must be a non-empty string');

  const keyManager = getKeyManager();
  if (!keyManager.hasKey('telegram')) {
    throw ErrorHandler.authentication('Bot token not initialized');
  }

  const botToken = keyManager.getKey('telegram');
  const url = `https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`;

  try {
    const response = await httpGet(url);
    const data = JSON.parse(response);

    if (data.ok) {
      console.log(`Retrieved file info for file_id ${fileId}:`, data.result);
      return data.result;
    } else {
      const errorMessage = data.description || 'Unknown error from Telegram API';
      console.error(`Failed to get file info for file_id ${fileId}:`, data);
      throw ErrorHandler.api(`Failed to get file info: ${errorMessage}`, {
        fileId,
        telegramError: data
      });
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'StandardError') {
      throw error; // Re-throw StandardError as-is
    }

    // Handle JSON parsing errors
    if (error instanceof SyntaxError) {
      throw ErrorHandler.parsing('Invalid response from Telegram API', { fileId, originalError: error.message });
    }

    // Handle network errors
    throw ErrorHandler.network(`Failed to retrieve file info: ${error.message}`, { fileId });
  }
}

/**
 * Helper function to make HTTP GET requests.
 * @param {String} url - The URL to request.
 * @param {AbortSignal} signal - AbortController signal for cancellation.
 * @throws {StandardError} When request fails
 * @returns {Promise<String>} Response body.
 */
function httpGet(url, signal = null) {
  // Input validation
  ErrorHandler.validateInput(url && typeof url === 'string', 'URL must be a non-empty string');

  return new Promise((resolve, reject) => {
    const req = https
      .get(url, res => {
        let data = '';
        res.on('data', chunk => (data += chunk));
        res.on('end', () => resolve(data));
      })
      .on('error', err => {
        console.error('HTTP GET error:', err);
        const error = ErrorHandler.network(`HTTP GET request failed: ${err.message}`, { url });
        reject(error);
      });

    // Handle abort signal
    if (signal) {
      signal.addEventListener('abort', () => {
        req.destroy();
        const error = ErrorHandler.timeout('Request was aborted', { url });
        reject(error);
      });
    }
  });
}

module.exports = { initBot, onMessage, sendMessage, getFileInfo, stopPolling };
