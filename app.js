'use strict';

const Homey = require('homey');
const fs = require('fs');
const path = require('path');
const https = require('https');  // Use native https module for HTTP requests

// Require our modules
const { onMessage, sendMessage, getFileInfo, initBot } = require('./modules/telegram');
const { transcribeVoice, initWhisper } = require('./modules/speech');
const { initChatGPT, parseCommand } = require('./modules/chatgpt');
// Import the Homey API client from homey-api (v3.0.0-rc.19)
const { HomeyAPIV3 } = require('homey-api');

/**
 * Helper: Download a file using native https.
 * @param {string} fileUrl - The URL to download.
 * @param {string} outputPath - The local file path to write to.
 */
async function downloadFile(fileUrl, outputPath) {
  return new Promise((resolve, reject) => {
    const dest = fs.createWriteStream(outputPath);
    https.get(fileUrl, (response) => {
      if (response.statusCode !== 200) {
        dest.end();
        reject(new Error(`HTTP error! status: ${response.statusCode}`));
        return;
      }
      response.pipe(dest);
      dest.on('finish', () => {
        dest.close();
        resolve();
      });
    }).on('error', (err) => {
      dest.end();
      reject(err);
    });
  });
}

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

class ChatGPTAssistant extends Homey.App {
  constructor(...args) {
    super(...args);
    // Attach helper functions
    this.chatgpt = { initChatGPT, parseCommand };
    this.telegram = { onMessage, sendMessage, getFileInfo, initBot };
    this._apiClient = null;
  }

  /**
   * Retrieves the full home state (devices and zones) using homey-api.
   */
  async getHomeState() {
    try {
      if (!this._apiClient) {
        this._apiClient = await HomeyAPIV3.createAppAPI({ homey: this.homey });
        this.log('Connected to Homey via homey-api.');
      }
      const devicesObj = await this._apiClient.devices.getDevices();
      const zones = await this._apiClient.zones.getZones();
      return { devices: devicesObj, zones: zones };
    } catch (error) {
      this.error('Failed to retrieve home state:', error);
      throw error;
    }
  }

  /**
   * Retrieves a mapping of devices as an object (id → device).
   */
  async getDevicesMapping() {
    try {
      const homeState = await this.getHomeState();
      return homeState.devices;
    } catch (error) {
      this.log('Falling back to drivers API for devices.');
      let devicesObj = {};
      if (this.homey.drivers && typeof this.homey.drivers.getDrivers === 'function') {
        const drivers = this.homey.drivers.getDrivers();
        for (const driver of Object.values(drivers)) {
          if (typeof driver.ready === 'function') await driver.ready();
          const driverDevices = await driver.getDevices();
          driverDevices.forEach(device => { devicesObj[device.id] = device; });
        }
      }
      return devicesObj;
    }
  }

  /**
   * Constructs a prompt for ChatGPT that includes a summarized home state.
   * The summary includes zones, devices, and a mapping of device classes to common capabilities.
   * The prompt instructs ChatGPT to output explicit commands (like "turn_on" or "turn_off")
   * and to only include devices that are applicable.
   */
  async parseCommandWithState(commandText) {
    const homeState = await this.getHomeState();
    
    // Summarize zones (only id and name)
    const zonesSummary = {};
    for (const [zoneId, zone] of Object.entries(homeState.zones || {})) {
      zonesSummary[zoneId] = zone.name;
    }
    
    // Summarize devices: include id, name, zone, and class.
    const devicesSummary = Object.values(homeState.devices || {}).map(device => ({
      id: device.id,
      name: device.name,
      zone: device.zone,
      class: device.class
    }));
    
    // Device class mapping for context.
    const deviceClassMapping = {
      "light": {
        "capabilities": ["onoff", "dim", "light_hue", "light_saturation", "light_temperature", "light_mode"],
        "actions": {
          "turn_on": { "type": "boolean", "description": "Turn the light on" },
          "turn_off": { "type": "boolean", "description": "Turn the light off" },
          "dim": { "type": "number", "range": [0, 1], "description": "Set brightness level" },
          "light_hue": { "type": "number", "range": [0, 1], "description": "Set light color hue" },
          "light_saturation": { "type": "number", "range": [0, 1], "description": "Set color saturation" },
          "light_temperature": { "type": "number", "range": [0, 1], "description": "Set white light temperature" },
          "light_mode": { "type": "string", "values": ["color", "temperature"], "description": "Set light mode" }
        }
      },
      "thermostat": {
        "capabilities": ["target_temperature", "measure_temperature", "thermostat_mode"],
        "actions": {
          "set_temperature": { "type": "number", "range": [5, 35], "description": "Set target temperature" },
          "measure_temperature": { "type": "number", "readable": true, "description": "Current temperature" },
          "thermostat_mode": { "type": "string", "values": ["heat", "cool", "auto"], "description": "Set thermostat mode" }
        }
      },
      "sensor": {
        "capabilities": ["alarm_contact", "alarm_battery", "measure_battery", "alarm_motion", "measure_temperature"],
        "actions": {
          "alarm_contact": { "type": "boolean", "readable": true, "description": "Contact sensor state" },
          "alarm_battery": { "type": "boolean", "readable": true, "description": "Low battery warning" },
          "measure_battery": { "type": "number", "readable": true, "description": "Battery level percentage" },
          "alarm_motion": { "type": "boolean", "readable": true, "description": "Motion detection state" },
          "measure_temperature": { "type": "number", "readable": true, "description": "Current temperature" }
        }
      },
      "speaker": {
        "capabilities": ["speaker_album", "speaker_artist", "speaker_duration", "speaker_playing", "volume_set", "volume_mute"],
        "actions": {
          "turn_on": { "type": "boolean", "description": "Start playback" },
          "turn_off": { "type": "boolean", "description": "Stop playback" },
          "volume_set": { "type": "number", "range": [0, 1], "description": "Set volume level" },
          "volume_mute": { "type": "boolean", "description": "Mute/unmute speaker" }
        }
      },
      "lock": {
        "capabilities": ["locked", "measure_battery"],
        "actions": {
          "turn_on": { "type": "boolean", "description": "Lock the device" },
          "turn_off": { "type": "boolean", "description": "Unlock the device" },
          "measure_battery": { "type": "number", "readable": true, "description": "Battery level percentage" }
        }
      },
      "camera": {
        "capabilities": ["onoff", "CMD_START_STREAM", "CMD_SNAPSHOT"],
        "actions": {
          "turn_on": { "type": "boolean", "description": "Turn camera on" },
          "turn_off": { "type": "boolean", "description": "Turn camera off" },
          "CMD_START_STREAM": { "type": "command", "description": "Start video stream" },
          "CMD_SNAPSHOT": { "type": "command", "description": "Take a snapshot" }
        }
      },
      "button": {
        "capabilities": ["click", "dclick", "hclick"],
        "actions": {
          "click": { "type": "trigger", "description": "Single click event" },
          "dclick": { "type": "trigger", "description": "Double click event" },
          "hclick": { "type": "trigger", "description": "Hold click event" }
        }
      },
      "socket": {
        "capabilities": ["onoff"],
        "actions": {
          "turn_on": { "type": "boolean", "description": "Turn socket on" },
          "turn_off": { "type": "boolean", "description": "Turn socket off" }
        }
      },
      "vacuumcleaner": {
        "capabilities": ["command_start_clean", "command_stop"],
        "actions": {
          "command_start_clean": { "type": "command", "description": "Start cleaning" },
          "command_stop": { "type": "command", "description": "Stop cleaning" }
        }
      },
      "evcharger": {
        "capabilities": ["onoff", "charging", "charge_mode", "measure_power", "measure_current"],
        "actions": {
          "turn_on": { "type": "boolean", "description": "Enable charger" },
          "turn_off": { "type": "boolean", "description": "Disable charger" },
          "charging": { "type": "boolean", "description": "Start/stop charging" },
          "charge_mode": { "type": "string", "values": ["fast", "eco", "scheduled"], "description": "Set charging mode" },
          "measure_power": { "type": "number", "readable": true, "description": "Current power usage in watts" },
          "measure_current": { "type": "number", "readable": true, "description": "Current amperage" }
        }
      },
      "doorbell": {
        "capabilities": ["button", "alarm_generic", "measure_battery", "CMD_SNAPSHOT"],
        "actions": {
          "click": { "type": "trigger", "description": "Doorbell press event" },
          "alarm_generic": { "type": "boolean", "description": "Doorbell chime control" },
          "measure_battery": { "type": "number", "readable": true, "description": "Battery level percentage" },
          "CMD_SNAPSHOT": { "type": "command", "description": "Take a snapshot" }
        }
      }
    };

    const summary = {
      zones: zonesSummary,
      devices: devicesSummary,
      deviceClassMapping: deviceClassMapping
    };

    // Improved prompt for ChatGPT:
    const prompt = `
You are a Homey automation expert. Your task is to convert the following natural language command into valid JSON that instructs Homey to control devices.
The JSON must follow one of these formats:
- For an entire room: { "room": "<roomName>", "command": "<action>" }
- For specific devices: { "device_ids": [ "deviceID1", "deviceID2", ... ], "command": "<action>" }
Always use explicit commands such as "turn_on" or "turn_off" for on/off actions.
Only include devices that support the required capabilities (for example, only devices that support on/off control for lights or sockets).
Ensure the command and parameters match the device capabilities described below.
Home state summary: ${JSON.stringify(summary)}
Command: "${commandText}"
Output only valid JSON.
`;
    this.log("Processing prompt for:", commandText);
    return await this.chatgpt.parseCommand(prompt);
  }

  /**
   * Lists devices organized by zones with clean logging.
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
   * Maps devices using a simple iteration.
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
   * Dummy method to simulate adding a device to HomeKit.
   */
  async addDeviceToHomeKit(device) {
    return true;
  }

  /**
   * Executes a JSON command returned by ChatGPT.
   * Supports:
   * - Room commands (with "room"): updates all devices in that room that support the intended action.
   * - Multiple device_ids commands.
   * - Single device commands.
   *
   * This function now uses a helper (getCapabilityForCommand) that maps a generic command like
   * "turn_on"/"turn_off" to the actual capability each device supports.
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
      const targetZoneIds = Object.keys(zones).filter(zoneId =>
        zones[zoneId].name.toLowerCase() === jsonCommand.room.toLowerCase()
      );
      if (targetZoneIds.length === 0) throw new Error(`No zone matching "${jsonCommand.room}" found.`);
      const devicesObj = await this.getDevicesMapping();
      const devices = Object.values(devicesObj);
      
      // Filter devices that are in the target zones and have a valid capability.
      let targetDevices = devices.filter(device => {
        if (!targetZoneIds.includes(device.zone)) return false;
        return getCapabilityForCommand(device, jsonCommand.command) !== null;
      });

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

      await this.initTelegramBot();
      this.log('Telegram listener set.');
      this.log('ChatGPT Assistant initialized.');
    } catch (error) {
      this.error('Initialization failed:', error.message);
      throw error;
    }
  }

  initTelegramBot() {
    return new Promise((resolve) => {
      onMessage(async (msg) => {
        const chatId = msg.chat.id;
        try {
          let commandText = "";
          if (msg.voice) {
            const fileId = msg.voice.file_id;
            this.log(`Voice msg: ${fileId}`);
            const fileInfo = await this.telegram.getFileInfo(fileId);
            const fileUrl = `https://api.telegram.org/file/bot${this.homey.settings.get('telegramBotToken')}/${fileInfo.file_path}`;
            
            // Download the file data directly as a Buffer
            const buffer = await new Promise((resolve, reject) => {
              let data = [];
              https.get(fileUrl, (response) => {
                if (response.statusCode !== 200) {
                  reject(new Error(`Failed to download voice file, status: ${response.statusCode}`));
                  return;
                }
                response.on('data', chunk => data.push(chunk));
                response.on('end', () => resolve(Buffer.concat(data)));
              }).on('error', reject);
            });
            
            // Transcribe the voice message (ensure transcribeVoice supports Buffer input)
            commandText = await transcribeVoice(buffer);
          } else if (msg.text) {
            commandText = msg.text;
          } else {
            await this.telegram.sendMessage(chatId, "Unsupported msg type.");
            return;
          }
          if (!commandText || commandText.trim() === "") {
            await this.telegram.sendMessage(chatId, "Empty command.");
            return;
          }
          const jsonCommand = await this.parseCommandWithState(commandText);
          if (jsonCommand.error) {
            await this.telegram.sendMessage(chatId, `Error parsing command: ${jsonCommand.error}`);
            return;
          }
          const resultMessage = await this.executeHomeyCommand(jsonCommand);
          await this.telegram.sendMessage(chatId, `Success: ${resultMessage}`);
          this.log(`Command executed successfully: ${resultMessage}`);
        } catch (error) {
          this.error("Error processing msg:", error);
          await this.telegram.sendMessage(chatId, `Error: ${error.message}`);
        }
      });
      resolve();
    });
  }
}

module.exports = ChatGPTAssistant;
