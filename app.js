// Patch: Make Homey import test-friendly
let Homey;
try {
  Homey = require('homey');
} catch (e) {
  // Provide a mock Homey.App for test environments
  Homey = { App: class {} };
}

'use strict';

const { EventTarget } = require('events');
// Removed local https require as HTTP logic is now in httpHelper

// Increase the default max listeners to prevent warnings during multi-command processing
if (typeof EventTarget !== 'undefined' && EventTarget.setMaxListeners) {
  EventTarget.setMaxListeners(20);
}

// Require our modules
const { onMessage, sendMessage, getFileInfo, initBot } = require('./modules/telegram');
const { transcribeVoice, initWhisper } = require('./modules/speech');
const { initChatGPT, parseCommand } = require('./modules/chatgpt');
const { downloadBuffer } = require('./modules/httpHelper');
const { getHomeState, getDevicesMapping } = require('./modules/homeyApiHelper');
const initTelegramListener = require('./modules/telegramBot');
const { constructPrompt } = require('./modules/chatgptHelper');
const { preprocessCommand, suggestImprovement } = require('./modules/commandProcessor');
const { handleStatusQuery } = require('./modules/statusQueryHandler');
const { initializeKeys } = require('./modules/secureKeyManager');

// Removed redundant downloadFile helper from app.js

/**
 * Helper function that returns an array of capability keys for a device.
 * It supports both the older 'capabilities' array and the newer 'capabilitiesObj' object.
 *
 * @param {object} device - The device object.
 * @returns {Array} Array of capability keys.
 */
function getCapabilityKeys(device) {
  if (device.capabilities && Array.isArray(device.capabilities)) {
    return device.capabilities;
  } if (device.capabilitiesObj && typeof device.capabilitiesObj === 'object') {
    return Object.keys(device.capabilitiesObj);
  }
  return [];
}

/**
 * ChatGPTAssistant
 *
 * Extends Homey.App to integrate Homey devices with ChatGPT command parsing,
 * Telegram messaging and voice transcription. This class provides methods for:
 * - Retrieving and summarizing the Homey home state.
 * - Parsing natural language commands into structured JSON.
 * - Executing commands on devices based on their capabilities.
 */
class ChatGPTAssistant extends Homey.App {
  constructor(...args) {
    super(...args);
    // Attach helper functions
    this.chatgpt = { initChatGPT, parseCommand };
    this.telegram = { onMessage, sendMessage, getFileInfo, initBot };
    this._apiClient = null;
    // Expose helper methods for modular use
    this.downloadBuffer = downloadBuffer;
    this.transcribeVoice = transcribeVoice;
  }

  /**
   * Called when the app is initialized
   */
  async onInit() {
    try {
      this.log('Initializing ChatGPT Assistant...');

      // Initialize secure key manager
      const homeySettings = this.homey.settings;
      const openaiKey = homeySettings.get('openaiApiKey');
      const telegramToken = homeySettings.get('telegramBotToken');

      if (!openaiKey) {
        this.error('OpenAI API key not found in settings. Please configure it in the app settings.');
        this.log('App will remain in standby mode until API keys are configured.');
        this._initializationPending = true;
        this._setupSettingsListener(); // Listen for settings changes
        return; // Don't throw error, just return
      }

      if (!telegramToken) {
        this.error('Telegram bot token not found in settings. Please configure it in the app settings.');
        this.log('App will remain in standby mode until API keys are configured.');
        this._initializationPending = true;
        this._setupSettingsListener(); // Listen for settings changes
        return; // Don't throw error, just return
      }

      // Initialize all modules
      await this._initializeModules(openaiKey, telegramToken);
      this._initializationPending = false;
      this.log('ChatGPT Assistant initialized successfully.');

    } catch (error) {
      this.error('Initialization failed:', error.message);
      this._initializationPending = true;
      this._setupSettingsListener(); // Listen for settings changes even on error
      // Don't throw error to prevent app from crashing
    }
  }

  /**
   * Setup settings listener to reinitialize when API keys are configured
   */
  _setupSettingsListener() {
    if (this._settingsListenerSetup) return; // Prevent multiple listeners

    this.homey.settings.on('set', async (key) => {
      if ((key === 'openaiApiKey' || key === 'telegramBotToken') && this._initializationPending) {
        this.log(`Settings changed: ${key}. Attempting to reinitialize...`);
        
        // Small delay to ensure both keys might be set
        setTimeout(async () => {
          const openaiKey = this.homey.settings.get('openaiApiKey');
          const telegramToken = this.homey.settings.get('telegramBotToken');
          
          if (openaiKey && telegramToken) {
            try {
              this.log('Both API keys configured. Initializing app...');
              await this._initializeModules(openaiKey, telegramToken);
              this._initializationPending = false;
              this.log('ChatGPT Assistant initialized successfully after settings update.');
            } catch (error) {
              this.error('Failed to initialize after settings update:', error.message);
            }
          }
        }, 1000);
      }
    });
    
    this._settingsListenerSetup = true;
  }

  /**
   * Initialize all modules with API keys
   */
  async _initializeModules(openaiKey, telegramToken) {
    // Initialize secure key manager with API keys
    this.log('Initializing secure key manager...');
    await initializeKeys({
      openaiApiKey: openaiKey,
      telegramBotToken: telegramToken
    });

    // Initialize ChatGPT module
    this.log('Initializing ChatGPT module...');
    await this.chatgpt.initChatGPT(openaiKey);
    this.log('ChatGPT module initialized.');

    // Initialize Whisper module
    this.log('Initializing Whisper module...');
    initWhisper(openaiKey);
    this.log('Whisper module initialized.');

    // Initialize Telegram bot
    this.log('Initializing Telegram bot...');
    await this.telegram.initBot(telegramToken);
    this.log('Telegram bot initialized.');

    // Delegate Telegram listener setup to the new module
    initTelegramListener(this);
  }

  /**
   * Check if the app is properly initialized
   * @returns {boolean} True if app is initialized, false otherwise
   */
  isInitialized() {
    return !this._initializationPending;
  }

  /**
   * Get initialization status message
   * @returns {string} Status message
   */
  getInitializationStatus() {
    if (this._initializationPending) {
      const openaiKey = this.homey.settings.get('openaiApiKey');
      const telegramToken = this.homey.settings.get('telegramBotToken');
      
      if (!openaiKey && !telegramToken) {
        return 'Waiting for OpenAI API key and Telegram bot token to be configured in app settings.';
      } else if (!openaiKey) {
        return 'Waiting for OpenAI API key to be configured in app settings.';
      } else if (!telegramToken) {
        return 'Waiting for Telegram bot token to be configured in app settings.';
      }
      return 'Initialization in progress...';
    }
    return 'App is fully initialized and ready.';
  }

  /**
   * Retrieves the full home state by delegating to homeyApiHelper.
   */
  async getHomeState() {
    return await getHomeState(this);
  }

  /**
   * Retrieves a mapping of devices from homeyApiHelper.
   */
  async getDevicesMapping() {
    return await getDevicesMapping(this);
  }

  /**
   * Enhanced command parsing with fallback logic and validation.
   * @param {string} commandText - The natural language command.
   * @param {string} detectedLanguage - The detected language from speech recognition.
   * @returns {Promise<Object>} A promise resolving to the JSON command parsed by ChatGPT.
   */
  async parseCommandWithState(commandText, detectedLanguage = 'en') {
    // Input validation
    if (!commandText || typeof commandText !== 'string') {
      return { error: 'Invalid command text: must be a non-empty string' };
    }

    if (commandText.length > 2000) {
      return { error: 'Command text too long: maximum 2000 characters allowed' };
    }

    // Character filtering - allow most characters except control characters and dangerous patterns
    // Block control characters (except newline, tab, carriage return) and null bytes
    if (/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(commandText)) {
      return { error: 'Command contains invalid control characters' };
    }
    
    // Block potentially dangerous HTML/JS injection patterns
    if (/<script[\s\S]*?>[\s\S]*?<\/script>/i.test(commandText) || 
        /javascript:\s*/.test(commandText) || 
        /data:\s*text\/html/i.test(commandText)) {
      return { error: 'Command contains potentially unsafe content' };
    }

    // Language validation - support major world languages
    const validLanguages = [
      'en', 'sv', 'fr', 'de', 'es', 'it', 'pt', 'nl', 'no', 'da', 'fi', // Original European languages
      'zh', 'ja', 'ko', 'ar', 'ru', 'hi', 'th', 'vi', 'tr', 'pl', 'cs', 'hu', 'ro', 'bg', 'hr', 'sk', 'sl', 'et', 'lv', 'lt' // Additional global languages
    ];
    if (!validLanguages.includes(detectedLanguage)) {
      this.log(`Language not specifically supported: ${detectedLanguage}, defaulting to English but processing anyway`);
      detectedLanguage = 'en'; // Default fallback
    }

    // Sanitize input
    const sanitizedCommand = commandText.trim().replace(/\s+/g, ' ');

    const homeState = await this.getHomeState();

    // Store the original command for device filtering
    this.lastProcessedCommand = sanitizedCommand;

    // Extract available room names for multilingual processing
    const availableRooms = homeState.zones ? Object.values(homeState.zones).map(zone => zone.name) : [];

    // Preprocess the command for better understanding with multilingual support
    const processedCmd = preprocessCommand(sanitizedCommand, detectedLanguage, availableRooms);
    this.log('Processing command:', {
      original: commandText,
      processed: processedCmd.processed,
      intent: processedCmd.intent,
      confidence: processedCmd.confidence,
      language: detectedLanguage,
      multilingualData: processedCmd.multilingualData
    });

    // Use processed command for better results
    const prompt = constructPrompt(processedCmd.processed, homeState);

    try {
      const jsonCommand = await this.chatgpt.parseCommand(prompt);

      // Validate the response
      if (!jsonCommand || typeof jsonCommand !== 'object') {
        throw new Error('Invalid response from ChatGPT');
      }

      // If there's an error in the response, check if we can provide suggestions
      if (jsonCommand.error) {
        if (processedCmd.confidence < 0.5) {
          const suggestion = suggestImprovement(processedCmd);
          if (suggestion) {
            jsonCommand.error += ` Suggestion: ${suggestion}`;
          }
        }
        return jsonCommand;
      }

      // Enhanced room detection fallback
      if (!jsonCommand.room && jsonCommand.device_ids && homeState.zones) {
        for (const [, zone] of Object.entries(homeState.zones)) {
          const zoneName = zone.name.toLowerCase();
          const commandLower = sanitizedCommand.toLowerCase();

          // Check for exact or partial matches
          if (commandLower.includes(zoneName) || zoneName.includes(commandLower.split(' ').find(word => word.length > 3) || '')) {
            this.log(`Fallback: Converting device_ids to room command for "${zone.name}"`);
            jsonCommand.room = zone.name;
            delete jsonCommand.device_ids;
            break;
          }
        }
      }

      // Handle status queries
      if (jsonCommand.query_type === 'status') {
        this.log('Processing status query:', JSON.stringify(jsonCommand, null, 2));
        return jsonCommand; // Return status query for processing in executeHomeyCommand
      }

      // Validate command structure for control commands
      const hasValidTarget = jsonCommand.room || jsonCommand.device_ids || jsonCommand.device_id || jsonCommand.commands;
      if (!hasValidTarget) {
        return { error: 'Command must specify a room, device ID(s), or contain recognizable device/room names' };
      }

      // Validate command type for control commands
      if (!jsonCommand.command && !jsonCommand.commands) {
        return { error: 'No action specified. Please specify what you want to do (turn on/off, dim, etc.)' };
      }

      this.log('Parsed command:', JSON.stringify(jsonCommand, null, 2));
      return jsonCommand;

    } catch (error) {
      this.error('Error parsing command:', error);
      return { error: `Failed to understand command: ${error.message}` };
    }
  }

  /**
   * Lists devices organized by zones and logs them.
   * @returns {Promise<object>} A promise resolving to an object grouping devices by zone.
   */
  async listAllDevices() {
    try {
      const homeState = await this.getHomeState();
      const devices = homeState.devices;
      const zones = homeState.zones;

      // Create a map of zone names for easy lookup
      const zoneNames = {};
      Object.entries(zones).forEach(([zoneId, zone]) => {
        zoneNames[zoneId] = zone.name;
      });

      // Group devices by zone
      const devicesByZone = {};
      Object.values(devices).forEach(device => {
        const zoneName = zoneNames[device.zone] || 'Unassigned';
        if (!devicesByZone[zoneName]) {
          devicesByZone[zoneName] = [];
        }
        devicesByZone[zoneName].push({
          id: device.id,
          name: device.name,
          class: device.class
        });
      });

      // Log devices by zone with clean format
      Object.entries(devicesByZone).forEach(([zoneName, zoneDevices]) => {
        this.log(`\n${zoneName}:`);
        zoneDevices.forEach(device => {
          this.log(`  ${device.name} (${device.class})`);
        });
      });

      return devicesByZone;
    } catch (error) {
      this.error('Failed to list devices:', error);
      return {};
    }
  }

  /**
   * Maps devices by iterating through all available devices and adding them to HomeKit.
   * @returns {Promise<void>}
   */
  async mapDevices() {
    try {
      const devicesObj = await this.getDevicesMapping();
      for (const [, device] of Object.entries(devicesObj)) {
        await this.addDeviceToHomeKit(device);
      }
      this.log('Device mapping completed.');
    } catch (error) {
      this.error('Failed to map devices:', error);
    }
  }

  /**
   * Simulates adding a device to HomeKit.
   * @param {object} device - The device object.
   * @returns {Promise<boolean>} A promise resolving to true upon success.
   */
  async addDeviceToHomeKit() {
    return true;
  }

  /**
   * Executes multiple commands in sequence
   * @param {Array} commands - Array of command objects
   * @returns {Promise<string>} Combined results from all commands
   */
  async executeMultiCommand(commands) {
    const results = [];
    let totalSuccess = 0;
    let totalAttempted = 0;

    this.log(`Executing ${commands.length} commands in sequence`);

    for (let i = 0; i < commands.length; i++) {
      const command = commands[i];
      try {
        this.log(`Executing command ${i + 1}/${commands.length}:`, JSON.stringify(command));
        const result = await this.executeSingleCommand(command);

        // Parse success count from result
        const successMatch = result.match(/(\d+)\/(\d+)/);
        if (successMatch) {
          totalSuccess += parseInt(successMatch[1]);
          totalAttempted += parseInt(successMatch[2]);
        } else {
          // Single device command
          totalAttempted += 1;
          if (result.includes('✅')) totalSuccess += 1;
        }

        results.push(`Command ${i + 1}: ${result}`);
      } catch (error) {
        results.push(`Command ${i + 1}: ❌ ${error.message}`);
        totalAttempted += 1;
      }
    }

    const summary = `🎯 Multi-command completed: ${totalSuccess}/${totalAttempted} actions successful`;
    return `${summary}\n\n${results.join('\n\n')}`;
  }

  /**
   * Executes a status query
   * @param {object} statusQuery - Status query object from ChatGPT
   * @returns {Promise<string>} Formatted status information
   */
  async executeStatusQuery(statusQuery) {
    try {
      const homeState = await this.getHomeState();

      // Create a mock LLM function for semantic matching (using our existing ChatGPT integration)
      const llmFunction = async prompt => {
        try {
          return await this.chatgpt.parseCommand(prompt);
        } catch (error) {
          console.warn('LLM function failed:', error);
          return null;
        }
      };

      // Detect language from the original query if available
      const language = this.detectLanguage(statusQuery.originalQuery || '');

      // Handle JSON status queries directly from ChatGPT
      if (statusQuery.query_type === 'status') {
        return await this.executeDirectStatusQuery(statusQuery, homeState, llmFunction, language);
      }

      // Fallback to text-based status query processing
      const result = await handleStatusQuery(
        statusQuery.originalQuery || this.constructQueryFromJSON(statusQuery),
        language,
        homeState,
        llmFunction,
        { includeDetails: true, maxDevices: 20 }
      );

      if (result.success) {
        return result.formattedText;
      }
      throw new Error(result.error || 'Status query failed');

    } catch (error) {
      this.error('Error executing status query:', error);
      throw new Error(`Failed to get status: ${error.message}`);
    }
  }

  /**
   * Execute a direct JSON status query from ChatGPT
   * @param {object} statusQuery - Status query JSON from ChatGPT
   * @param {object} homeState - Current home state
   * @param {function} llmFunction - LLM function for semantic matching
   * @param {string} language - Detected language
   * @returns {Promise<string>} Formatted status information
   */
  async executeDirectStatusQuery(statusQuery, homeState, llmFunction, language) {
    const { devices, zones } = homeState;
    const availableRooms = Object.values(zones).map(zone => zone.name);

    // Import required modules
    const { getRoomStatus, getDeviceTypeStatus } = require('./modules/deviceStatusRetriever');
    const { formatRoomStatus, formatDeviceTypeStatus } = require('./modules/statusFormatter');

    // Handle different types of status queries
    if (statusQuery.scope === 'global') {
      // Global status query
      const deviceArray = Object.values(devices);
      const limitedDevices = deviceArray.slice(0, 20); // Limit for performance

      const allDeviceStatuses = [];
      for (const device of limitedDevices) {
        const { getDeviceStatus } = require('./modules/deviceStatusRetriever');
        const status = await getDeviceStatus(device);
        allDeviceStatuses.push(status);
      }

      const { formatGlobalStatus } = require('./modules/statusFormatter');
      return formatGlobalStatus(allDeviceStatuses, language, true);
    }

    if (statusQuery.device_type && statusQuery.room) {
      // Device type in specific room query
      const deviceTypeStatus = await getDeviceTypeStatus(
        statusQuery.device_type,
        devices,
        zones,
        statusQuery.room,
        language,
        llmFunction
      );
      return formatDeviceTypeStatus(deviceTypeStatus, language, true);
    }

    if (statusQuery.device_type) {
      // Device type query (all rooms)
      const deviceTypeStatus = await getDeviceTypeStatus(
        statusQuery.device_type,
        devices,
        zones,
        null,
        language,
        llmFunction
      );
      return formatDeviceTypeStatus(deviceTypeStatus, language, true);
    }

    if (statusQuery.room) {
      // Room status query
      const roomStatus = await getRoomStatus(
        statusQuery.room,
        availableRooms,
        devices,
        zones,
        language,
        llmFunction
      );
      return formatRoomStatus(roomStatus, language, true);
    }

    // Fallback
    throw new Error('Invalid status query format');
  }

  /**
   * Construct a query string from JSON status query (fallback)
   * @param {object} statusQuery - Status query JSON
   * @returns {string} Query string
   */
  constructQueryFromJSON(statusQuery) {
    if (statusQuery.scope === 'global') {
      return 'show all devices';
    }
    if (statusQuery.room && statusQuery.device_type) {
      return `status of ${statusQuery.device_type} in ${statusQuery.room}`;
    }
    if (statusQuery.room) {
      return `status of ${statusQuery.room}`;
    }
    if (statusQuery.device) {
      return `status of ${statusQuery.device}`;
    }
    if (statusQuery.device_type) {
      return `status of ${statusQuery.device_type}`;
    }
    return 'status';
  }

  /**
   * Simple language detection based on common words
   * @param {string} text - Text to analyze
   * @returns {string} Language code
   */
  detectLanguage(text) {
    const lowerText = text.toLowerCase();

    // Swedish indicators
    if (/\b(vad är|visa|status|tillstånd|hur|är|kolla|alla|enheter|i)\b/.test(lowerText)) {
      return 'sv';
    }

    // French indicators
    if (/\b(qu'est-ce que|quel est|montre|statut|état|comment|tous|appareils|dans)\b/.test(lowerText)) {
      return 'fr';
    }

    // German indicators
    if (/\b(was ist|wie ist|zeige|status|zustand|alle|geräte|im)\b/.test(lowerText)) {
      return 'de';
    }

    // Spanish indicators
    if (/\b(qué es|cuál es|muestra|estado|cómo|todos|dispositivos|en)\b/.test(lowerText)) {
      return 'es';
    }

    // Default to English
    return 'en';
  }

  /**
   * Executes a single command (used by both single and multi-command execution)
   * @param {object} command - Single command object
   * @returns {Promise<string>} Result message
   */
  async executeSingleCommand(command) {
    // Add device_filter support to the command
    return await this.executeHomeyCommand(command);
  }

  /**
   * Executes a JSON command returned by ChatGPT.
   * Supports room commands, multiple device_ids commands, or a single device command.
   * @param {object} jsonCommand - The structured command object.
   * @returns {Promise<string>} A promise resolving to a success message or error details.
   */
  async executeHomeyCommand(jsonCommand) {
    if (jsonCommand.error) throw new Error(jsonCommand.error);
    if (jsonCommand.query_type === 'status') {
      return await this.executeStatusQuery(jsonCommand);
    }
    if (jsonCommand.commands && Array.isArray(jsonCommand.commands)) {
      return await this.executeMultiCommand(jsonCommand.commands);
    }
    if (jsonCommand.command === 'onoff') {
      if (jsonCommand.parameters && typeof jsonCommand.parameters.onoff === 'boolean') {
        jsonCommand.command = jsonCommand.parameters.onoff ? 'turn_on' : 'turn_off';
      } else {
        throw new Error('Invalid parameters for onoff command.');
      }
    }
    if (jsonCommand.room) {
      return await this.handleRoomCommand(jsonCommand);
    }
    if (jsonCommand.device_ids) {
      return await this.handleMultiDeviceCommand(jsonCommand);
    }
    if (jsonCommand.device_id) {
      return await this.handleSingleDeviceCommand(jsonCommand);
    }
    throw new Error('❌ Invalid command format: must include "room", "device_ids", or "device_id"');
  }

  /**
   * Refactored: Handles Homey commands for a room.
   */
  async handleRoomCommand(jsonCommand) {
    const homeState = await this.getHomeState();
    const zones = homeState.zones;

    // Enhanced room matching with fuzzy logic
    const targetZoneIds = Object.keys(zones).filter(zoneId => {
      const zoneName = zones[zoneId].name.toLowerCase();
      const roomQuery = jsonCommand.room.toLowerCase();

      // Exact match
      if (zoneName === roomQuery) return true;

      // Contains match
      if (zoneName.includes(roomQuery) || roomQuery.includes(zoneName)) return true;

      // Enhanced multilingual translations
      const translations = {
        'vardagsrum': ['living room', 'lounge', 'livingroom'],
        'vardagsrummet': ['living room', 'lounge', 'livingroom'],
        'sovrum': ['bedroom', 'bed room'],
        'sovrummet': ['bedroom', 'bed room'],
        'kök': ['kitchen'],
        'köket': ['kitchen'],
        'badrum': ['bathroom', 'bath room'],
        'badrummet': ['bathroom', 'bath room'],
        'hall': ['hallway', 'entrance'],
        'hallen': ['hallway', 'entrance'],
        'kontor': ['office', 'study'],
        'kontoret': ['office', 'study'],
        'trädgård': ['garden', 'yard', 'trägården'],
        'trädgården': ['garden', 'yard', 'trägården'],
        'garden': ['trädgård', 'trädgården', 'yard'],
        // Spanish
        'sala de estar': ['living room', 'lounge'],
        'dormitorio': ['bedroom'],
        'cocina': ['kitchen'],
        'baño': ['bathroom'],
        'oficina': ['office'],
        // French
        'salon': ['living room', 'lounge'],
        'chambre': ['bedroom'],
        'cuisine': ['kitchen'],
        'salle de bain': ['bathroom'],
        'bureau': ['office'],
        // German
        'wohnzimmer': ['living room', 'lounge'],
        'schlafzimmer': ['bedroom'],
        'küche': ['kitchen'],
        'badezimmer': ['bathroom'],
        'büro': ['office'],
        // Italian
        'soggiorno': ['living room', 'lounge'],
        'camera da letto': ['bedroom'],
        'cucina': ['kitchen'],
        'bagno': ['bathroom'],
        'ufficio': ['office']
      };

      for (const [foreignWord, englishWords] of Object.entries(translations)) {
        // Check if room query is in foreign language and zone name is in English
        if (roomQuery.includes(foreignWord.toLowerCase())
            && englishWords.some(e => zoneName.includes(e.toLowerCase()))) {
          return true;
        }
        // Check if zone name is in foreign language and room query is in English
        if (zoneName.includes(foreignWord.toLowerCase())
            && englishWords.some(e => roomQuery.includes(e.toLowerCase()))) {
          return true;
        }
        // Check if both are in English but different variations
        if (englishWords.some(e => roomQuery.includes(e.toLowerCase()))
            && englishWords.some(e => zoneName.includes(e.toLowerCase()))) {
          return true;
        }
      }

      return false;
    });

    this.log(`Room matching: "${jsonCommand.room}" -> zones:`, targetZoneIds.map(id => zones[id].name));

    if (targetZoneIds.length === 0) {
      const availableRooms = Object.values(zones).map(z => z.name).join(', ');
      throw new Error(`No room matching "${jsonCommand.room}" found. Available rooms: ${availableRooms}`);
    }

    const devicesObj = await this.getDevicesMapping();
    const devices = Object.values(devicesObj);

    // Filter devices in target zones that support the command
    let targetDevices = devices.filter(device => {
      if (!targetZoneIds.includes(device.zone)) return false;
      return ChatGPTAssistant.getCapabilityForCommand(device, jsonCommand.command) !== null;
    });

    // Enhanced smart filtering based on command context and device_filter
    if (jsonCommand.device_filter) {
      // Explicit device filter specified
      const filteredDevices = targetDevices.filter(device => {
        if (jsonCommand.device_filter === 'light') {
          // Include actual lights
          if (device.class === 'light') return true;
          // Include sockets that control lights based on Homey metadata or intelligent analysis
          if (device.class === 'socket' && ChatGPTAssistant.isLightControllingSocket(device)) return true;
          return false;
        } else if (jsonCommand.device_filter === 'socket') {
          // Only sockets, not lights
          return device.class === 'socket' && !ChatGPTAssistant.isLightControllingSocket(device);
        } else if (jsonCommand.device_filter === 'speaker') {
          return device.class === 'speaker';
        } else if (jsonCommand.device_filter === 'thermostat') {
          return device.class === 'thermostat';
        }
        return device.class === jsonCommand.device_filter;
      });

      if (filteredDevices.length > 0) {
        this.log(`Filtering to ${jsonCommand.device_filter} devices only`);
        targetDevices = filteredDevices;
      } else {
        // Log what device classes we found when filtering fails
        const availableClasses = targetDevices.map(d => `${d.name}(${d.class})`).join(', ');
        this.log(`No ${jsonCommand.device_filter} devices found. Available: ${availableClasses}`);
        // When explicit device filter is specified and no matching devices found, don't fall back
        targetDevices = [];
      }
    }
    // Fallback to original smart filtering for commands without explicit filter
    else if (jsonCommand.command === 'turn_on' || jsonCommand.command === 'turn_off') {
      // Get the original command text from the preprocessing
      const originalCommand = this.lastProcessedCommand || '';
      // If the original command mentions lights/lamps specifically, filter to lights only
      if (/light|lights|lamp|lamps|ljus|lampa|lampor|ligt|ligts|belysning/i.test(originalCommand)) {
        const lightDevices = targetDevices.filter(device => device.class === 'light' || (device.class === 'socket' && ChatGPTAssistant.isLightControllingSocket(device)));
        if (lightDevices.length > 0) {
          this.log(`Filtering to lights only based on command: "${originalCommand}"`);
          targetDevices = lightDevices;
        }
      }
      // If no specific device type mentioned, but it's a generic room command, prefer lights (including sockets controlling lights)
      else if (!/socket|speaker|tv|camera|lock|sensor|thermostat/i.test(originalCommand)) {
        const lightDevices = targetDevices.filter(device => device.class === 'light' || (device.class === 'socket' && ChatGPTAssistant.isLightControllingSocket(device)));
        const controllableDevices = targetDevices.filter(device => ChatGPTAssistant.isControllableDeviceClass(device.class));
        if (lightDevices.length > 0 && lightDevices.length >= controllableDevices.length * 0.3) {
          this.log(`Preferring lights for generic room command: "${originalCommand}"`);
          targetDevices = lightDevices;
        } else {
          this.log(`Using controllable devices for generic room command: "${originalCommand}"`);
          targetDevices = controllableDevices;
        }
      }
    }

    // Log details about the devices we're about to process
    const deviceDetails = targetDevices.map(d => `${d.name}(${d.class})`).join(', ');
    this.log(`Found ${targetDevices.length} compatible devices for command "${jsonCommand.command}": ${deviceDetails}`);

    if (targetDevices.length === 0) {
      const deviceClasses = [...new Set(devices
        .filter(d => targetZoneIds.includes(d.zone))
        .map(d => d.class))].join(', ');
      throw new Error(`No devices supporting "${jsonCommand.command}" found in "${jsonCommand.room}". Available device types: ${deviceClasses}`);
    }

    // Parallel device processing for better performance
    const devicePromises = targetDevices.map(async (device) => {
      try {
        const cap = ChatGPTAssistant.getCapabilityForCommand(device, jsonCommand.command);
        if (!cap) {
          return { device: device.name, success: false, message: `doesn't support ${jsonCommand.command}`, icon: '⚠️' };
        }

        const value = ChatGPTAssistant.getValueForCommand(jsonCommand.command, jsonCommand.parameters);
        await device.setCapabilityValue(cap, value);
        return { device: device.name, success: true, message: `${jsonCommand.command} successful`, icon: '✅' };
      } catch (error) {
        return { device: device.name, success: false, message: error.message, icon: '❌' };
      }
    });

    // Wait for all device operations to complete
    const deviceResults = await Promise.allSettled(devicePromises);

    // Process results and count successes
    const results = [];
    let successCount = 0;

    deviceResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        const deviceResult = result.value;
        results.push(`${deviceResult.icon} ${deviceResult.device}: ${deviceResult.message}`);
        if (deviceResult.success) successCount++;
      } else {
        // Handle promise rejection
        const deviceName = targetDevices[index]?.name || `Device ${index}`;
        results.push(`❌ ${deviceName}: Promise rejected - ${result.reason?.message || 'Unknown error'}`);
      }
    });

    const summary = `${successCount}/${targetDevices.length} devices updated in ${jsonCommand.room}`;
    return `${summary}\n${results.join('\n')}`;
  }

  /**
   * Handles Homey commands for multiple device_ids (parallel processing)
   */
  async handleMultiDeviceCommand(jsonCommand) {
    const devicesObj = await this.getDevicesMapping();
    const devices = Object.values(devicesObj);
    const targetIds = Array.isArray(jsonCommand.device_ids) ? jsonCommand.device_ids : [];
    if (targetIds.length === 0) {
      throw new Error('No device_ids specified for multi-device command');
    }
    const targetDevices = devices.filter(d => targetIds.includes(d.id));
    if (targetDevices.length === 0) {
      throw new Error('No matching devices found for device_ids: ' + targetIds.join(', '));
    }
    // Parallel device processing
    const devicePromises = targetDevices.map(async (device) => {
      try {
        const cap = ChatGPTAssistant.getCapabilityForCommand(device, jsonCommand.command);
        if (!cap) {
          return { device: device.name, success: false, message: `doesn't support ${jsonCommand.command}`, icon: '⚠️' };
        }
        const value = ChatGPTAssistant.getValueForCommand(jsonCommand.command, jsonCommand.parameters);
        await device.setCapabilityValue(cap, value);
        return { device: device.name, success: true, message: `${jsonCommand.command} successful`, icon: '✅' };
      } catch (error) {
        return { device: device.name, success: false, message: error.message, icon: '❌' };
      }
    });
    const deviceResults = await Promise.allSettled(devicePromises);
    const results = [];
    let successCount = 0;
    deviceResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        const deviceResult = result.value;
        results.push(`${deviceResult.icon} ${deviceResult.device}: ${deviceResult.message}`);
        if (deviceResult.success) {
          successCount++;
        }
      } else {
        const device = devices[index];
        results.push(`❌ ${device.name}: ${result.reason?.message || 'Unknown error'}`);
      }
    });

    return {
      results,
      successCount,
      totalDevices: devices.length,
      summary: `${successCount}/${devices.length} devices controlled successfully`
    };
  }

  /**
   * Handles Homey commands for a single device_id
   */
  async handleSingleDeviceCommand(jsonCommand) {
    const devicesObj = await this.getDevicesMapping();
    const devices = Object.values(devicesObj);
    const targetDevice = devices.find(d => d.id === jsonCommand.device_id);
    
    if (!targetDevice) {
      throw new Error(`Device with ID "${jsonCommand.device_id}" not found`);
    }

    const cap = ChatGPTAssistant.getCapabilityForCommand(targetDevice, jsonCommand.command);
    if (!cap) {
      throw new Error(`Device "${targetDevice.name}" doesn't support "${jsonCommand.command}"`);
    }

    try {
      const value = ChatGPTAssistant.getValueForCommand(jsonCommand.command, jsonCommand.parameters);
      await targetDevice.setCapabilityValue(cap, value);
      return `✅ ${targetDevice.name}: ${jsonCommand.command} successful`;
    } catch (error) {
      throw new Error(`❌ ${targetDevice.name}: ${error.message}`);
    }
  }

  /**
   * Static helper methods
   */
  static getCapabilityForCommand(device, command) {
    const capabilities = getCapabilityKeys(device);
    
    switch (command) {
      case 'turn_on':
      case 'turn_off':
        return capabilities.find(cap => cap === 'onoff') || null;
      case 'dim':
        return capabilities.find(cap => cap === 'dim') || null;
      case 'set_temperature':
        return capabilities.find(cap => cap === 'target_temperature') || null;
      case 'set_volume':
        return capabilities.find(cap => cap === 'volume_set') || null;
      default:
        return null;
    }
  }

  static getValueForCommand(command, parameters = {}) {
    switch (command) {
      case 'turn_on':
        return true;
      case 'turn_off':
        return false;
      case 'dim':
        return parameters.dim_level || 0.5;
      case 'set_temperature':
        return parameters.temperature || 20;
      case 'set_volume':
        return parameters.volume || 0.5;
      default:
        return null;
    }
  }

  static isLightControllingSocket(device) {
    // Check if socket is controlling lights based on name patterns
    const name = device.name.toLowerCase();
    return /light|lamp|ljus|lampa|belysning/i.test(name);
  }

  static isControllableDeviceClass(deviceClass) {
    const controllableClasses = ['light', 'socket', 'speaker', 'tv', 'thermostat'];
    return controllableClasses.includes(deviceClass);
  }
}

module.exports = ChatGPTAssistant;
