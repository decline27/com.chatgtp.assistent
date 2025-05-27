'use strict';

const crypto = require('crypto');
const { ErrorHandler, ErrorTypes } = require('./errorHandler');

/**
 * Secure API Key Manager
 * Provides secure storage and handling of sensitive API keys
 */
class SecureKeyManager {
  constructor() {
    this.keys = new Map();
    this.keyHashes = new Map();
    this.encryptionKey = this.generateEncryptionKey();
    this.algorithm = 'aes-256-cbc';
  }

  /**
   * Generate a secure encryption key for this session
   * @returns {Buffer} Encryption key
   */
  generateEncryptionKey() {
    return crypto.randomBytes(32);
  }

  /**
   * Validate API key format
   * @param {string} key - API key to validate
   * @param {string} type - Type of key ('openai' or 'telegram')
   * @returns {boolean} True if valid
   */
  validateApiKey(key, type) {
    if (!key || typeof key !== 'string') {
      return false;
    }

    switch (type) {
      case 'openai':
        // OpenAI keys support multiple formats as of 2024:
        // - Traditional: sk-[alphanumeric+underscores]
        // - Project keys: sk-proj-[alphanumeric+underscores]
        // - User keys: sk-None-[alphanumeric+underscores]
        // - Service account: sk-svcacct-[alphanumeric+underscores]
        // Length varies from 40 to 156+ characters
        const openaiPrefixes = ['sk-', 'sk-proj-', 'sk-None-', 'sk-svcacct-'];
        const hasValidPrefix = openaiPrefixes.some(prefix => key.startsWith(prefix));

        // More specific format validation based on prefix
        let hasValidFormat = false;
        if (key.startsWith('sk-proj-')) {
          hasValidFormat = /^sk-proj-[A-Za-z0-9_-]+$/.test(key);
        } else if (key.startsWith('sk-None-')) {
          hasValidFormat = /^sk-None-[A-Za-z0-9_-]+$/.test(key);
        } else if (key.startsWith('sk-svcacct-')) {
          hasValidFormat = /^sk-svcacct-[A-Za-z0-9_-]+$/.test(key);
        } else if (key.startsWith('sk-')) {
          // Traditional format - must not have other known prefixes or invalid patterns
          // Should be sk- followed directly by alphanumeric characters (no additional hyphens in prefix)
          hasValidFormat = /^sk-[A-Za-z0-9_-]+$/.test(key) &&
                          !key.startsWith('sk-proj-') &&
                          !key.startsWith('sk-None-') &&
                          !key.startsWith('sk-svcacct-') &&
                          !key.match(/^sk-[a-zA-Z]+-/); // Reject patterns like sk-invalid-prefix-
        }

        const hasValidLength = key.length >= 40 && key.length <= 200; // Allow up to 200 chars for future expansion

        return hasValidPrefix && hasValidFormat && hasValidLength;

      case 'telegram':
        // Telegram bot tokens are in format: number:alphanumeric (e.g., 123456789:ABC-DEF1234ghIkl-zyx57W2v1u123ew11)
        return /^\d+:[A-Za-z0-9_-]+$/.test(key) && key.length >= 35;

      default:
        return key.length >= 10; // Generic minimum length
    }
  }

  /**
   * Encrypt a value using AES-256-CBC
   * @param {string} value - Value to encrypt
   * @returns {Object} Encrypted data with IV
   */
  encrypt(value) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.algorithm, this.encryptionKey, iv);

    let encrypted = cipher.update(value, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    return {
      encrypted,
      iv: iv.toString('hex')
    };
  }

  /**
   * Decrypt a value using AES-256-CBC
   * @param {Object} encryptedData - Encrypted data with IV
   * @returns {string} Decrypted value
   */
  decrypt(encryptedData) {
    const iv = Buffer.from(encryptedData.iv, 'hex');
    const decipher = crypto.createDecipheriv(this.algorithm, this.encryptionKey, iv);

    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  /**
   * Generate a hash for key identification (for logging/debugging)
   * @param {string} key - API key
   * @returns {string} Hash of the key (first 8 characters)
   */
  generateKeyHash(key) {
    return crypto.createHash('sha256').update(key).digest('hex').substring(0, 8);
  }

  /**
   * Store an API key securely
   * @param {string} keyId - Identifier for the key
   * @param {string} key - API key to store
   * @param {string} type - Type of key ('openai' or 'telegram')
   * @throws {StandardError} When validation fails
   */
  setKey(keyId, key, type) {
    // Input validation
    ErrorHandler.validateInput(keyId && typeof keyId === 'string', 'Key ID must be a non-empty string');
    ErrorHandler.validateInput(key && typeof key === 'string', 'API key must be a non-empty string');
    ErrorHandler.validateInput(type && typeof type === 'string', 'Key type must be specified');

    // Validate API key format
    if (!this.validateApiKey(key, type)) {
      throw ErrorHandler.validation(`Invalid ${type} API key format`, { keyId, type });
    }

    try {
      // Encrypt the key
      const encryptedData = this.encrypt(key);

      // Store encrypted key
      this.keys.set(keyId, {
        ...encryptedData,
        type,
        timestamp: new Date().toISOString()
      });

      // Store hash for identification
      this.keyHashes.set(keyId, this.generateKeyHash(key));

      console.log(`Securely stored ${type} API key with ID: ${keyId} (hash: ${this.keyHashes.get(keyId)})`);
    } catch (error) {
      throw ErrorHandler.api(`Failed to store API key: ${error.message}`, { keyId, type });
    }
  }

  /**
   * Retrieve an API key
   * @param {string} keyId - Identifier for the key
   * @returns {string} Decrypted API key
   * @throws {StandardError} When key not found or decryption fails
   */
  getKey(keyId) {
    ErrorHandler.validateInput(keyId && typeof keyId === 'string', 'Key ID must be a non-empty string');

    const encryptedData = this.keys.get(keyId);
    if (!encryptedData) {
      throw ErrorHandler.notFound(`API key not found: ${keyId}`);
    }

    try {
      return this.decrypt(encryptedData);
    } catch (error) {
      throw ErrorHandler.api(`Failed to decrypt API key: ${error.message}`, { keyId });
    }
  }

  /**
   * Check if a key exists
   * @param {string} keyId - Identifier for the key
   * @returns {boolean} True if key exists
   */
  hasKey(keyId) {
    return this.keys.has(keyId);
  }

  /**
   * Get key information without exposing the actual key
   * @param {string} keyId - Identifier for the key
   * @returns {Object} Key metadata
   */
  getKeyInfo(keyId) {
    const encryptedData = this.keys.get(keyId);
    if (!encryptedData) {
      return null;
    }

    return {
      keyId,
      type: encryptedData.type,
      hash: this.keyHashes.get(keyId),
      timestamp: encryptedData.timestamp,
      exists: true
    };
  }

  /**
   * Remove an API key
   * @param {string} keyId - Identifier for the key
   * @returns {boolean} True if key was removed
   */
  removeKey(keyId) {
    const removed = this.keys.delete(keyId);
    this.keyHashes.delete(keyId);

    if (removed) {
      console.log(`Removed API key: ${keyId}`);
    }

    return removed;
  }

  /**
   * Clear all stored keys (for cleanup)
   */
  clearAll() {
    const keyCount = this.keys.size;
    this.keys.clear();
    this.keyHashes.clear();

    console.log(`Cleared ${keyCount} stored API keys`);
  }

  /**
   * Get list of stored key IDs (without exposing actual keys)
   * @returns {Array} Array of key information objects
   */
  listKeys() {
    return Array.from(this.keys.keys()).map(keyId => this.getKeyInfo(keyId));
  }

  /**
   * Validate that a key is still accessible
   * @param {string} keyId - Identifier for the key
   * @returns {boolean} True if key can be decrypted successfully
   */
  validateKey(keyId) {
    try {
      const key = this.getKey(keyId);
      return key && key.length > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Create a secure authorization header for API requests
   * @param {string} keyId - Identifier for the key
   * @param {string} prefix - Authorization prefix (e.g., 'Bearer', 'Bot')
   * @returns {string} Authorization header value
   */
  createAuthHeader(keyId, prefix = 'Bearer') {
    const key = this.getKey(keyId);
    return `${prefix} ${key}`;
  }

  /**
   * Get statistics about stored keys
   * @returns {Object} Statistics object
   */
  getStats() {
    const keys = this.listKeys();
    const typeCount = {};

    keys.forEach(keyInfo => {
      typeCount[keyInfo.type] = (typeCount[keyInfo.type] || 0) + 1;
    });

    return {
      totalKeys: keys.length,
      typeCount,
      encryptionAlgorithm: this.algorithm
    };
  }
}

// Singleton instance
let keyManagerInstance = null;

/**
 * Get the singleton instance of SecureKeyManager
 * @returns {SecureKeyManager} Key manager instance
 */
function getKeyManager() {
  if (!keyManagerInstance) {
    keyManagerInstance = new SecureKeyManager();
  }
  return keyManagerInstance;
}

/**
 * Initialize and store API keys securely
 * @param {Object} keys - Object containing API keys
 * @param {string} keys.openaiApiKey - OpenAI API key
 * @param {string} keys.telegramBotToken - Telegram bot token
 */
function initializeKeys(keys) {
  const manager = getKeyManager();

  if (keys.openaiApiKey) {
    manager.setKey('openai', keys.openaiApiKey, 'openai');
  }

  if (keys.telegramBotToken) {
    manager.setKey('telegram', keys.telegramBotToken, 'telegram');
  }
}

module.exports = {
  SecureKeyManager,
  getKeyManager,
  initializeKeys
};
