'use strict';

const Homey = require('homey');
const fs = require('fs');
const path = require('path');
// Removed local https require as HTTP logic is now in httpHelper

// Require our modules
const { onMessage, sendMessage, getFileInfo, initBot } = require('./modules/telegram');
const { transcribeVoice, initWhisper } = require('./modules/speech');
const { initChatGPT, parseCommand } = require('./modules/chatgpt');
const { downloadBuffer } = require('./modules/httpHelper');
const { getHomeState, getDevicesMapping } = require('./modules/homeyApiHelper');
// Import the Homey API client from homey-api (v3.0.0-rc.19)
const { HomeyAPIV3 } = require('homey-api');
const initTelegramListener = require('./modules/telegramBot');
const { constructPrompt } = require('./modules/chatgptHelper');

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
  } else if (device.capabilitiesObj && typeof device.capabilitiesObj === 'object') {
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
   * Constructs a prompt for ChatGPT that includes a summarized home state.
   * @param {string} commandText - The natural language command.
   * @returns {Promise<Object>} A promise resolving to the JSON command parsed by ChatGPT.
   */
  async parseCommandWithState(commandText) {
    const homeState = await this.getHomeState();
    const prompt = constructPrompt(commandText, homeState);
    this.log("Processing prompt for:", commandText);
    const jsonCommand = await this.chatgpt.parseCommand(prompt);
    // If the command text mentions a known room and JSON lacks a room property,
    // convert a device_ids command into a room command.
    if (!jsonCommand.room && jsonCommand.device_ids && homeState.zones) {
      for (const [zoneId, zone] of Object.entries(homeState.zones)) {
        if (commandText.toLowerCase().includes(zone.name.toLowerCase())) {
          jsonCommand.room = zone.name;
          delete jsonCommand.device_ids;
          break;
        }
      }
    }
    return jsonCommand;
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
      for (const [id, device] of Object.entries(devicesObj)) {
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
  async addDeviceToHomeKit(device) {
    return true;
  }

  /**
   * Executes a JSON command returned by ChatGPT.
   * Supports room commands, multiple device_ids commands, or a single device command.
   * @param {object} jsonCommand - The structured command object.
   * @returns {Promise<string>} A promise resolving to a success message or error details.
   */
  async executeHomeyCommand(jsonCommand) {
    if (jsonCommand.error) throw new Error(jsonCommand.error);

    // If ChatGPT returned "onoff", convert it to explicit commands.
    if (jsonCommand.command === "onoff") {
      if (jsonCommand.parameters && typeof jsonCommand.parameters.onoff === 'boolean') {
        jsonCommand.command = jsonCommand.parameters.onoff ? "turn_on" : "turn_off";
      } else {
        throw new Error("Invalid parameters for onoff command.");
      }
    }

    // Helper: Given a device and a generic command (e.g., "turn_on" or "turn_off"),
    // determine the actual capability to set based on the device's class and supported capabilities.
    function getCapabilityForCommand(device, command) {
      const caps = getCapabilityKeys(device);
      if (command === "turn_on" || command === "turn_off") {
        // Prefer the generic onoff capability if available.
        if (caps.includes("onoff")) return "onoff";
        // If the device is a speaker, check for speaker_playing.
        if (device.class === "speaker" && caps.includes("speaker_playing")) return "speaker_playing";
        // For other device types (spa, car, boiler, etc.), add additional mappings here.
        return null; // No valid on/off capability found.
      }
      // For other commands, if the device supports it, return it.
      if (caps.includes(command)) return command;
      return null;
    }

    // Decide the value to set for on/off commands.
    const onoffValue = jsonCommand.command === "turn_on" ? true : false;

    // ---------- Room Command Branch ----------
    if (jsonCommand.room) {
      const homeState = await this.getHomeState();
      const zones = homeState.zones;
      // Use case-insensitive includes for flexible matching
      const targetZoneIds = Object.keys(zones).filter(zoneId =>
        zones[zoneId].name.toLowerCase().includes(jsonCommand.room.toLowerCase())
      );
      this.log("Matched zone IDs:", targetZoneIds);
      targetZoneIds.forEach(zoneId => {
        this.log("Zone:", zones[zoneId]);
      });
      if (targetZoneIds.length === 0) throw new Error(`No zone matching "${jsonCommand.room}" found.`);
      const devicesObj = await this.getDevicesMapping();
      const devices = Object.values(devicesObj);
      
      // Log candidate devices before filtering for light devices
      devices.forEach(device => {
        if (targetZoneIds.includes(device.zone)) {
          this.log("Candidate device:", { id: device.id, name: device.name, zone: zones[device.zone]?.name });
        }
      });
      
      // Filter devices that are in the target zones and have a valid capability.
      let targetDevices = devices.filter(device => {
        if (!targetZoneIds.includes(device.zone)) return false;
        return getCapabilityForCommand(device, jsonCommand.command) !== null;
      });
      
      // If the room command likely relates to lights, filter further
      if (/ljus|lamp/i.test(jsonCommand.room)) {
        targetDevices = targetDevices.filter(device => device.class === "light");
      }
      
      this.log("Final target devices:", targetDevices.map(d => ({ id: d.id, name: d.name, zone: zones[d.zone]?.name })));
      
      if (targetDevices.length === 0) {
        throw new Error(`No devices with required capabilities found in room "${jsonCommand.room}" for command "${jsonCommand.command}".`);
      }
      
      let results = [];
      for (const device of targetDevices) {
        try {
          const cap = getCapabilityForCommand(device, jsonCommand.command);
          if (!cap) {
            results.push(`Device ${device.name} (${device.id}) does not support ${jsonCommand.command}.`);
            continue;
          }
          await device.setCapabilityValue(cap, onoffValue);
          results.push(`Device ${device.name} (${device.id}) updated successfully.`);
        } catch (error) {
          results.push(`Device ${device.name} (${device.id}) failed: ${error.message}`);
        }
      }
      return results.join('\n');
    }
    // ---------- Multiple Device IDs Command Branch ----------
    else if (jsonCommand.device_ids) {
      const devicesObj = await this.getDevicesMapping();
      const devices = Object.values(devicesObj);
      let results = [];
      for (const id of jsonCommand.device_ids) {
        const device = devices.find(d => d.id === id);
        if (!device) {
          results.push(`Device ${id} not found.`);
          continue;
        }
        try {
          const cap = getCapabilityForCommand(device, jsonCommand.command);
          if (!cap) {
            results.push(`Device ${device.name} (${device.id}) does not support ${jsonCommand.command}. Skipping.`);
            continue;
          }
          await device.setCapabilityValue(cap, onoffValue);
          results.push(`Device ${device.id} updated.`);
        } catch (error) {
          results.push(`Device ${device.id} failed: ${error.message}`);
        }
      }
      return results.join('\n');
    }
    // ---------- Single Device Command Branch ----------
    else if (jsonCommand.device_id) {
      const devicesObj = await this.getDevicesMapping();
      const devices = Object.values(devicesObj);
      const device = devices.find(d => d.id === jsonCommand.device_id);
      if (!device) throw new Error(`Device ${jsonCommand.device_id} not found.`);
      try {
        const cap = getCapabilityForCommand(device, jsonCommand.command);
        if (!cap) {
          throw new Error(`Device ${device.name} does not support ${jsonCommand.command}.`);
        }
        await device.setCapabilityValue(cap, onoffValue);
        return `Device ${jsonCommand.device_id} updated.`;
      } catch (error) {
        throw new Error(`Failed to update device ${jsonCommand.device_id}: ${error.message}`);
      }
    } else {
      throw new Error('Invalid command format: must include "room", "device_ids", or "device_id".');
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
