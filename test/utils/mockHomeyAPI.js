'use strict';

/**
 * Mock Homey API System
 * Provides realistic mocks for Homey devices, zones, and API interactions
 */

const { sinon } = require('./testSetup');

/**
 * Create a mock Homey device with realistic capabilities
 * @param {object} config - Device configuration
 * @returns {object} Mock device
 */
function createMockDevice(config = {}) {
  const defaults = {
    id: `device_${Math.random().toString(36).substr(2, 9)}`,
    name: 'Test Device',
    class: 'light',
    zone: 'zone_1',
    available: true,
    capabilities: ['onoff'],
    capabilitiesObj: {
      onoff: { value: false }
    }
  };

  const device = { ...defaults, ...config };

  // Add realistic capability values based on device class
  if (device.class === 'light') {
    device.capabilities = ['onoff', 'dim'];
    device.capabilitiesObj = {
      onoff: { value: config.onoff || false },
      dim: { value: config.dim || 0.0 }
    };
  } else if (device.class === 'thermostat') {
    device.capabilities = ['target_temperature', 'measure_temperature'];
    device.capabilitiesObj = {
      target_temperature: { value: config.target_temperature || 20 },
      measure_temperature: { value: config.measure_temperature || 19.5 }
    };
  } else if (device.class === 'speaker') {
    device.capabilities = ['speaker_playing', 'volume_set'];
    device.capabilitiesObj = {
      speaker_playing: { value: config.speaker_playing || false },
      volume_set: { value: config.volume_set || 0.5 }
    };
  } else if (device.class === 'lock') {
    device.capabilities = ['locked'];
    device.capabilitiesObj = {
      locked: { value: config.locked || true }
    };
  }

  // Add mock methods
  device.setCapabilityValue = sinon.stub().resolves(true);
  device.getCapabilityValue = sinon.stub().callsFake((capability) => {
    return Promise.resolve(device.capabilitiesObj[capability]?.value || null);
  });

  return device;
}

/**
 * Create a mock Homey zone
 * @param {object} config - Zone configuration
 * @returns {object} Mock zone
 */
function createMockZone(config = {}) {
  const defaults = {
    id: `zone_${Math.random().toString(36).substr(2, 9)}`,
    name: 'Test Zone'
  };

  return { ...defaults, ...config };
}

/**
 * Create a comprehensive mock home state
 * @param {object} config - Configuration options
 * @returns {object} Mock home state
 */
function createMockHomeState(config = {}) {
  const zones = {
    'kitchen_zone': createMockZone({ id: 'kitchen_zone', name: 'Kitchen' }),
    'living_room_zone': createMockZone({ id: 'living_room_zone', name: 'Vardagsrummet' }),
    'bedroom_zone': createMockZone({ id: 'bedroom_zone', name: 'Bedroom' }),
    'garden_zone': createMockZone({ id: 'garden_zone', name: 'Trägården' }),
    'bathroom_zone': createMockZone({ id: 'bathroom_zone', name: 'Bathroom' }),
    'office_zone': createMockZone({ id: 'office_zone', name: 'Office' })
  };

  const devices = {
    'kitchen_light': createMockDevice({
      id: 'kitchen_light',
      name: 'Kitchen Light',
      class: 'light',
      zone: 'kitchen_zone',
      onoff: true,
      dim: 0.8
    }),
    'living_room_light': createMockDevice({
      id: 'living_room_light',
      name: 'Vardagsrum Lampa',
      class: 'light',
      zone: 'living_room_zone',
      onoff: false,
      dim: 0.0
    }),
    'bedroom_thermostat': createMockDevice({
      id: 'bedroom_thermostat',
      name: 'Bedroom Thermostat',
      class: 'thermostat',
      zone: 'bedroom_zone',
      target_temperature: 22,
      measure_temperature: 21.5
    }),
    'garden_speaker': createMockDevice({
      id: 'garden_speaker',
      name: 'Trägården Speaker',
      class: 'speaker',
      zone: 'garden_zone',
      speaker_playing: true,
      volume_set: 0.6,
      available: false // Offline device
    }),
    'front_door_lock': createMockDevice({
      id: 'front_door_lock',
      name: 'Front Door Lock',
      class: 'lock',
      zone: 'living_room_zone',
      locked: true
    }),
    'kitchen_socket': createMockDevice({
      id: 'kitchen_socket',
      name: 'Kitchen Socket',
      class: 'socket',
      zone: 'kitchen_zone',
      onoff: false
    }),
    'bedroom_sensor': createMockDevice({
      id: 'bedroom_sensor',
      name: 'Bedroom Motion Sensor',
      class: 'sensor',
      zone: 'bedroom_zone',
      capabilities: ['alarm_motion'],
      capabilitiesObj: {
        alarm_motion: { value: false }
      }
    }),
    'living_room_camera': createMockDevice({
      id: 'living_room_camera',
      name: 'Living Room Camera',
      class: 'camera',
      zone: 'living_room_zone',
      capabilities: ['camera_enabled'],
      capabilitiesObj: {
        camera_enabled: { value: true }
      }
    })
  };

  // Apply any custom configuration
  if (config.customDevices) {
    Object.assign(devices, config.customDevices);
  }
  if (config.customZones) {
    Object.assign(zones, config.customZones);
  }

  return { devices, zones };
}

/**
 * Create a mock ChatGPT API function
 * @param {object} responses - Predefined responses
 * @returns {Function} Mock LLM function
 */
function createMockLLMFunction(responses = {}) {
  const defaultResponses = {
    'kitchen': { match: 'Kitchen', confidence: 0.9, reasoning: 'Exact match' },
    'vardagsrummet': { match: 'Vardagsrummet', confidence: 0.95, reasoning: 'Swedish room name match' },
    'trädgården': { match: 'Trägården', confidence: 0.87, reasoning: 'Character variation match' },
    'bedroom': { match: 'Bedroom', confidence: 0.9, reasoning: 'Exact match' },
    'living room': { match: 'Vardagsrummet', confidence: 0.85, reasoning: 'Translation match' }
  };

  const allResponses = { ...defaultResponses, ...responses };

  return sinon.stub().callsFake(async (prompt) => {
    // Extract room name from prompt for simple matching
    for (const [key, response] of Object.entries(allResponses)) {
      if (prompt.toLowerCase().includes(key.toLowerCase())) {
        return JSON.stringify(response);
      }
    }

    return JSON.stringify({
      match: null,
      confidence: 0.0,
      reasoning: 'No match found'
    });
  });
}

/**
 * Create mock Homey API client
 * @param {object} homeState - Home state to use
 * @returns {object} Mock API client
 */
function createMockHomeyAPI(homeState) {
  return {
    devices: {
      getDevices: sinon.stub().resolves(homeState.devices),
      getDevice: sinon.stub().callsFake((id) => {
        return Promise.resolve(homeState.devices[id] || null);
      })
    },
    zones: {
      getZones: sinon.stub().resolves(homeState.zones),
      getZone: sinon.stub().callsFake((id) => {
        return Promise.resolve(homeState.zones[id] || null);
      })
    }
  };
}

module.exports = {
  createMockDevice,
  createMockZone,
  createMockHomeState,
  createMockLLMFunction,
  createMockHomeyAPI
};
