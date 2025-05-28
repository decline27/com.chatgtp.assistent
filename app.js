'use strict';

const Homey = require('homey');
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

    if (commandText.length > 1000) {
      return { error: 'Command text too long: maximum 1000 characters allowed' };
    }

    // Character filtering - allow alphanumeric, spaces, common punctuation, and international characters
    if (!/^[a-zA-Z0-9\s\-_åäöÅÄÖéèêëíìîïóòôõúùûüñçÉÈÊËÍÌÎÏÓÒÔÕÚÙÛÜÑÇ.,!?'"()]+$/.test(commandText)) {
      return { error: 'Command contains invalid characters: only letters, numbers, spaces, and basic punctuation allowed' };
    }

    // Language validation
    const validLanguages = ['en', 'sv', 'fr', 'de', 'es', 'it', 'pt', 'nl', 'no', 'da', 'fi'];
    if (!validLanguages.includes(detectedLanguage)) {
      this.log(`Invalid language detected: ${detectedLanguage}, defaulting to English`);
      detectedLanguage = 'en'; // Default fallback
    }

    // Sanitize input
    const sanitizedCommand = commandText.trim().replace(/\s+/g, ' ');

    // Additional security check for potential injection patterns
    const suspiciousPatterns = [
      /javascript:/i,
      /<script/i,
      /eval\(/i,
      /function\(/i,
      /setTimeout/i,
      /setInterval/i
    ];

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(sanitizedCommand)) {
        return { error: 'Command contains potentially unsafe content' };
      }
    }

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

    // Handle status queries
    if (jsonCommand.query_type === 'status') {
      return await this.executeStatusQuery(jsonCommand);
    }

    // Handle multi-commands
    if (jsonCommand.commands && Array.isArray(jsonCommand.commands)) {
      return await this.executeMultiCommand(jsonCommand.commands);
    }

    // If ChatGPT returned "onoff", convert it to explicit commands.
    if (jsonCommand.command === 'onoff') {
      if (jsonCommand.parameters && typeof jsonCommand.parameters.onoff === 'boolean') {
        jsonCommand.command = jsonCommand.parameters.onoff ? 'turn_on' : 'turn_off';
      } else {
        throw new Error('Invalid parameters for onoff command.');
      }
    }

    // Helper function to determine if a device class is controllable for on/off commands
    function isControllableDeviceClass(deviceClass) {
      const readOnlyClasses = ['sensor', 'camera', 'button', 'other'];
      const limitedControlClasses = ['thermostat']; // These have specific commands only

      if (readOnlyClasses.includes(deviceClass)) {
        return false;
      }

      // For turn_on/turn_off commands, exclude thermostats as they don't typically support these
      return !limitedControlClasses.includes(deviceClass);
    }

    // Function to detect if a socket is controlling a light based on Homey metadata only
    function isLightControllingSocket(device) {
      if (device.class !== 'socket') return false;

      try {
        // Debug: Log available metadata for socket devices to help users understand what's available
        this.log(`Analyzing socket "${device.name}" for light control. Available metadata:`, {
          settings: device.settings ? Object.keys(device.settings) : 'none',
          data: device.data ? Object.keys(device.data) : 'none',
          store: device.store ? Object.keys(device.store) : 'none',
          capabilities: device.capabilities || 'none'
        });
        // Method 1: Check Homey device settings for user-defined purpose/category
        if (device.settings) {
          // Check for common settings that might indicate light control
          const lightSettings = ['purpose', 'category', 'device_type', 'connected_device', 'usage', 'type'];
          for (const setting of lightSettings) {
            if (device.settings[setting]) {
              const value = device.settings[setting].toString().toLowerCase();
              if (value.includes('light') || value.includes('lamp') || value.includes('ljus') || value.includes('lampa')) {
                this.log(`Socket "${device.name}" identified as light controller via settings.${setting}: ${value}`);
                return true;
              }
            }
          }
        }

        // Method 2: Check device data for metadata
        if (device.data) {
          // Check for device data that might indicate connected device type
          const dataKeys = Object.keys(device.data);
          for (const key of dataKeys) {
            if (typeof device.data[key] === 'string') {
              const value = device.data[key].toLowerCase();
              if (value.includes('light') || value.includes('lamp')) {
                this.log(`Socket "${device.name}" identified as light controller via data.${key}: ${value}`);
                return true;
              }
            }
          }
        }

        // Method 3: Check device store for app-specific metadata
        if (device.store) {
          const storeKeys = Object.keys(device.store);
          for (const key of storeKeys) {
            if (typeof device.store[key] === 'string') {
              const value = device.store[key].toLowerCase();
              if (value.includes('light') || value.includes('lamp')) {
                this.log(`Socket "${device.name}" identified as light controller via store.${key}: ${value}`);
                return true;
              }
            }
          }
        }

        // Method 4: Check if device has light-related capabilities that suggest it controls lighting
        if (device.capabilities) {
          // Some smart sockets might have dim capability when controlling lights
          if (device.capabilities.includes('dim') || device.capabilities.includes('light_hue') ||
              device.capabilities.includes('light_saturation') || device.capabilities.includes('light_temperature')) {
            this.log(`Socket "${device.name}" identified as light controller via lighting capabilities: ${device.capabilities.join(', ')}`);
            return true;
          }
        }

        return false;

      } catch (error) {
        this.error(`Error analyzing socket "${device.name}" for light control:`, error);
        return false;
      }
    }



    // Enhanced capability mapping for better device support
    function getCapabilityForCommand(device, command) {
      const caps = getCapabilityKeys(device);
      const deviceClass = device.class;

      // Handle on/off commands with device-specific logic
      if (command === 'turn_on' || command === 'turn_off') {
        // Standard onoff capability (most common)
        if (caps.includes('onoff')) return 'onoff';

        // Device-specific mappings
        switch (deviceClass) {
          case 'speaker':
            if (caps.includes('speaker_playing')) return 'speaker_playing';
            break;
          case 'curtain':
          case 'blinds':
            if (caps.includes('windowcoverings_set')) return 'windowcoverings_set';
            break;
          case 'lock':
            if (caps.includes('locked')) return 'locked';
            break;
          case 'thermostat':
            // Thermostats don't typically have on/off
            return null;
          case 'sensor':
            // Sensors are read-only
            return null;
        }
        return null;
      }

      // Handle specific commands
      switch (command) {
        case 'dim':
          if (caps.includes('dim')) return 'dim';
          break;
        case 'set_temperature':
          if (caps.includes('target_temperature')) return 'target_temperature';
          break;
        case 'open':
          if (caps.includes('windowcoverings_set')) return 'windowcoverings_set';
          break;
        case 'close':
          if (caps.includes('windowcoverings_set')) return 'windowcoverings_set';
          break;
        case 'lock':
          if (caps.includes('locked')) return 'locked';
          break;
        case 'unlock':
          if (caps.includes('locked')) return 'locked';
          break;
        case 'speaker_next':
          if (caps.includes('speaker_next')) return 'speaker_next';
          break;
        case 'speaker_prev':
          if (caps.includes('speaker_prev')) return 'speaker_prev';
          break;
        case 'play_music':
          if (caps.includes('speaker_playing')) return 'speaker_playing';
          break;
        case 'stop_music':
          if (caps.includes('speaker_playing')) return 'speaker_playing';
          break;
      }

      // Fallback: check if device directly supports the command
      if (caps.includes(command)) return command;
      return null;
    }

    // Enhanced value determination for different command types
    function getValueForCommand(command, parameters = {}) {
      switch (command) {
        case 'turn_on':
          return true;
        case 'turn_off':
          return false;
        case 'open':
          return 1; // Fully open
        case 'close':
          return 0; // Fully closed
        case 'lock':
          return true;
        case 'unlock':
          return false;
        case 'dim':
          // Use provided value or default to 50%
          return parameters.dim_level || 0.5;
        case 'set_temperature':
          // Use provided temperature or default to 21°C
          return parameters.temperature || 21;
        case 'speaker_next':
        case 'speaker_prev':
          return true; // Trigger action
        case 'play_music':
          return true; // Start playing
        case 'stop_music':
          return false; // Stop playing
        default:
          // For boolean capabilities, default to true
          return true;
      }
    }

    // ---------- Room Command Branch ----------
    if (jsonCommand.room) {
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
        return getCapabilityForCommand(device, jsonCommand.command) !== null;
      });

      // Enhanced smart filtering based on command context and device_filter
      if (jsonCommand.device_filter) {
        // Explicit device filter specified
        const filteredDevices = targetDevices.filter(device => {
          if (jsonCommand.device_filter === 'light') {
            // Include actual lights
            if (device.class === 'light') return true;
            // Include sockets that control lights based on Homey metadata or intelligent analysis
            if (device.class === 'socket' && isLightControllingSocket(device)) return true;
            return false;
          } if (jsonCommand.device_filter === 'speaker') {
            return device.class === 'speaker';
          } if (jsonCommand.device_filter === 'socket') {
            return device.class === 'socket';
          } if (jsonCommand.device_filter === 'thermostat') {
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
          const lightDevices = targetDevices.filter(device => device.class === 'light');
          if (lightDevices.length > 0) {
            this.log(`Filtering to lights only based on command: "${originalCommand}"`);
            targetDevices = lightDevices;
          }
        }
        // If no specific device type mentioned, but it's a generic room command, prefer lights
        else if (!/socket|speaker|tv|camera|lock|sensor|thermostat/i.test(originalCommand)) {
          const lightDevices = targetDevices.filter(device => device.class === 'light');
          const controllableDevices = targetDevices.filter(device => isControllableDeviceClass(device.class));

          // If we have lights and the command seems generic, prefer lights
          if (lightDevices.length > 0 && lightDevices.length >= controllableDevices.length * 0.3) {
            this.log(`Preferring lights for generic room command: "${originalCommand}"`);
            targetDevices = lightDevices;
          }
          // Otherwise, exclude read-only devices but keep controllable ones
          else {
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
          const cap = getCapabilityForCommand(device, jsonCommand.command);
          if (!cap) {
            return { device: device.name, success: false, message: `doesn't support ${jsonCommand.command}`, icon: '⚠️' };
          }

          const value = getValueForCommand(jsonCommand.command, jsonCommand.parameters);
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
          // Handle promise rejection (shouldn't happen with our error handling, but safety first)
          const deviceName = targetDevices[index]?.name || 'Unknown device';
          results.push(`❌ ${deviceName}: Promise rejected - ${result.reason?.message || 'Unknown error'}`);
        }
      });

      const summary = `${successCount}/${targetDevices.length} devices updated in ${jsonCommand.room}`;
      return `${summary}\n${results.join('\n')}`;
    }
    // ---------- Multiple Device IDs Command Branch ----------
    if (jsonCommand.device_ids) {
      const devicesObj = await this.getDevicesMapping();
      const devices = Object.values(devicesObj);

      // Parallel processing for multiple device IDs
      const devicePromises = jsonCommand.device_ids.map(async (id) => {
        const device = devices.find(d => d.id === id);
        if (!device) {
          return { device: `Device ${id}`, success: false, message: 'not found', icon: '❌' };
        }

        try {
          const cap = getCapabilityForCommand(device, jsonCommand.command);
          if (!cap) {
            return { device: device.name, success: false, message: `doesn't support ${jsonCommand.command}`, icon: '⚠️' };
          }

          const value = getValueForCommand(jsonCommand.command, jsonCommand.parameters);
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
          const deviceId = jsonCommand.device_ids[index];
          results.push(`❌ Device ${deviceId}: Promise rejected - ${result.reason?.message || 'Unknown error'}`);
        }
      });

      const summary = `${successCount}/${jsonCommand.device_ids.length} devices updated`;
      return `${summary}\n${results.join('\n')}`;
    }
    // ---------- Single Device Command Branch ----------
    if (jsonCommand.device_id) {
      const devicesObj = await this.getDevicesMapping();
      const devices = Object.values(devicesObj);
      const device = devices.find(d => d.id === jsonCommand.device_id);

      if (!device) {
        throw new Error(`❌ Device ${jsonCommand.device_id} not found`);
      }

      try {
        const cap = getCapabilityForCommand(device, jsonCommand.command);
        if (!cap) {
          const availableCaps = getCapabilityKeys(device).join(', ');
          throw new Error(`⚠️ ${device.name} doesn't support "${jsonCommand.command}". Available capabilities: ${availableCaps}`);
        }

        const value = getValueForCommand(jsonCommand.command, jsonCommand.parameters);
        await device.setCapabilityValue(cap, value);
        return `✅ ${device.name}: ${jsonCommand.command} successful`;
      } catch (error) {
        throw new Error(`❌ ${device.name}: ${error.message}`);
      }
    } else {
      throw new Error('❌ Invalid command format: must include "room", "device_ids", or "device_id"');
    }
  }

  /**
   * Homey App initialization method.
   * Performs setup of devices, APIs, and external modules.
   * @returns {Promise<void>}
   */
  async onInit() {
    this.log('ChatGPT Assistant initializing...');
    this.log('Checking environment variables...');

    // Minimal debug logging for Homey properties.
    this.log('Homey properties:', Object.keys(this.homey));
    if (this.homey.managers) this.log('Managers:', Object.keys(this.homey.managers));
    if (this.homey.api && this.homey.api.devices) this.log('Homey API devices available');
    if (this.homey.drivers && typeof this.homey.drivers.getDrivers === 'function') this.log('Drivers API available');

    const telegramToken = this.homey.settings.get('telegramBotToken');
    const openaiKey = this.homey.settings.get('openaiApiKey');
    if (!telegramToken || !openaiKey) {
      this.log('API keys not configured. Running in limited mode.');
      return;
    }
    this.log('Settings loaded.');

    // Initialize secure key management
    try {
      this.log('Initializing secure key management...');
      initializeKeys({
        openaiApiKey: openaiKey,
        telegramBotToken: telegramToken
      });
      this.log('API keys stored securely.');
    } catch (error) {
      this.error('Failed to initialize secure key management:', error.message);
      throw error;
    }

    // List and map devices (minimal logging).
    await this.listAllDevices();
    await this.mapDevices();

    try {
      this.log('Initializing ChatGPT module...');
      await this.chatgpt.initChatGPT(openaiKey);
      this.log('ChatGPT module initialized.');

      this.log('Initializing Whisper module...');
      initWhisper(openaiKey);
      this.log('Whisper module initialized.');

      this.log('Initializing Telegram bot...');
      await this.telegram.initBot(telegramToken);
      this.log('Telegram bot initialized.');

      // Delegate Telegram listener setup to the new module
      initTelegramListener(this);

      this.log('ChatGPT Assistant initialized.');
    } catch (error) {
      this.error('Initialization failed:', error.message);
      throw error;
    }
  }
}

module.exports = ChatGPTAssistant;
