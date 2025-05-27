'use strict';

/**
 * Unit Tests for Device Status Retriever
 * Tests device status retrieval and formatting functionality
 */

const { expect, sinon, TEST_CONFIG } = require('../utils/testSetup');
const { createMockHomeState, createMockDevice, createMockLLMFunction } = require('../utils/mockHomeyAPI');
const {
  getDeviceStatus,
  getRoomStatus,
  getDeviceTypeStatus,
  generateDeviceSummary
} = require('../../modules/deviceStatusRetriever');

describe('Device Status Retriever', function() {
  this.timeout(TEST_CONFIG.timeout.unit);

  let mockHomeState;
  let mockLLMFunction;

  beforeEach(function() {
    mockHomeState = createMockHomeState();
    mockLLMFunction = createMockLLMFunction();
  });

  afterEach(function() {
    sinon.restore();
  });

  describe('getDeviceStatus', function() {
    it('should retrieve status for a light device', async function() {
      const lightDevice = createMockDevice({
        name: 'Test Light',
        class: 'light',
        onoff: true,
        dim: 0.75
      });

      const status = await getDeviceStatus(lightDevice);

      expect(status).to.have.property('id', lightDevice.id);
      expect(status).to.have.property('name', 'Test Light');
      expect(status).to.have.property('class', 'light');
      expect(status).to.have.property('isOnline', true);
      expect(status).to.have.property('capabilities');
      expect(status.capabilities).to.have.property('onoff', true);
      expect(status.capabilities).to.have.property('dim', 0.75);
      expect(status).to.have.property('summary').that.is.a('string');
    });

    it('should retrieve status for a thermostat device', async function() {
      const thermostatDevice = createMockDevice({
        name: 'Test Thermostat',
        class: 'thermostat',
        target_temperature: 22,
        measure_temperature: 21.5
      });

      const status = await getDeviceStatus(thermostatDevice);

      expect(status).to.have.property('class', 'thermostat');
      expect(status.capabilities).to.have.property('target_temperature', 22);
      expect(status.capabilities).to.have.property('measure_temperature', 21.5);
      expect(status.summary).to.include('22');
      expect(status.summary).to.include('21.5');
    });

    it('should handle offline devices', async function() {
      const offlineDevice = createMockDevice({
        name: 'Offline Device',
        class: 'speaker',
        available: false
      });

      const status = await getDeviceStatus(offlineDevice);

      expect(status).to.have.property('isOnline', false);
      expect(status.summary).to.include('Offline');
    });

    it('should handle devices with no capabilities', async function() {
      const deviceWithoutCaps = createMockDevice({
        name: 'Simple Device',
        class: 'sensor',
        capabilities: []
      });

      const status = await getDeviceStatus(deviceWithoutCaps);

      expect(status).to.have.property('capabilities').that.is.empty;
      expect(status).to.have.property('summary');
    });
  });

  describe('getRoomStatus', function() {
    it('should retrieve status for a room with exact name match', async function() {
      const result = await getRoomStatus(
        'Kitchen',
        ['Kitchen', 'Bedroom', 'Living Room'],
        mockHomeState.devices,
        mockHomeState.zones,
        'en'
      );

      expect(result).to.have.property('success', true);
      expect(result).to.have.property('roomName', 'Kitchen');
      expect(result).to.have.property('matchedRoom', 'Kitchen');
      expect(result).to.have.property('deviceCount').above(0);
      expect(result).to.have.property('devices').that.is.an('array');
      expect(result).to.have.property('matchConfidence').above(0.9);
    });

    it('should handle Swedish room names with fuzzy matching', async function() {
      const result = await getRoomStatus(
        'vardagsrummet',
        ['Kitchen', 'Vardagsrummet', 'Bedroom'],
        mockHomeState.devices,
        mockHomeState.zones,
        'sv',
        mockLLMFunction
      );

      expect(result).to.have.property('success', true);
      expect(result).to.have.property('matchedRoom', 'Vardagsrummet');
      expect(result).to.have.property('matchConfidence').above(0.8);
    });

    it('should handle room names with character variations', async function() {
      const result = await getRoomStatus(
        'trädgården',
        ['Kitchen', 'Trägården', 'Bedroom'],
        mockHomeState.devices,
        mockHomeState.zones,
        'sv',
        mockLLMFunction
      );

      expect(result).to.have.property('success', true);
      expect(result).to.have.property('matchedRoom', 'Trägården');
    });

    it('should return error for non-existent room', async function() {
      const result = await getRoomStatus(
        'NonExistentRoom',
        ['Kitchen', 'Bedroom'],
        mockHomeState.devices,
        mockHomeState.zones,
        'en'
      );

      expect(result).to.have.property('success', false);
      expect(result).to.have.property('error').that.includes('not found');
    });

    it('should handle rooms with no devices', async function() {
      const emptyZone = { 'empty_zone': { id: 'empty_zone', name: 'Empty Room' } };

      const result = await getRoomStatus(
        'Empty Room',
        ['Empty Room'],
        {},
        emptyZone,
        'en'
      );

      expect(result).to.have.property('success', true);
      expect(result).to.have.property('deviceCount', 0);
      expect(result).to.have.property('devices').that.is.empty;
    });
  });

  describe('getDeviceTypeStatus', function() {
    it('should retrieve all lights in the home', async function() {
      const result = await getDeviceTypeStatus(
        'light',
        mockHomeState.devices,
        mockHomeState.zones,
        null,
        'en'
      );

      expect(result).to.have.property('success', true);
      expect(result).to.have.property('deviceType', 'light');
      expect(result).to.have.property('deviceCount').above(0);
      expect(result.devices).to.be.an('array');

      // All returned devices should be lights
      result.devices.forEach(device => {
        expect(device).to.have.property('class', 'light');
      });
    });

    it('should filter lights by room', async function() {
      const result = await getDeviceTypeStatus(
        'light',
        mockHomeState.devices,
        mockHomeState.zones,
        'Kitchen',
        'en',
        mockLLMFunction
      );

      expect(result).to.have.property('success', true);
      expect(result).to.have.property('roomFilter', 'Kitchen');

      // Should only return lights from kitchen
      result.devices.forEach(device => {
        expect(device).to.have.property('class', 'light');
        expect(device).to.have.property('zone', 'kitchen_zone');
      });
    });

    it('should handle device types with no matches', async function() {
      const result = await getDeviceTypeStatus(
        'nonexistent',
        mockHomeState.devices,
        mockHomeState.zones,
        null,
        'en'
      );

      expect(result).to.have.property('success', true);
      expect(result).to.have.property('deviceCount', 0);
      expect(result).to.have.property('devices').that.is.empty;
      expect(result.summary).to.include('No nonexistent devices found');
    });

    it('should handle thermostats correctly', async function() {
      const result = await getDeviceTypeStatus(
        'thermostat',
        mockHomeState.devices,
        mockHomeState.zones,
        null,
        'en'
      );

      expect(result).to.have.property('success', true);
      result.devices.forEach(device => {
        expect(device).to.have.property('class', 'thermostat');
        expect(device.capabilities).to.have.property('target_temperature');
      });
    });
  });

  describe('generateDeviceSummary', function() {
    it('should generate summary for light device', function() {
      const lightDevice = createMockDevice({
        class: 'light',
        name: 'Test Light'
      });
      const capabilities = { onoff: true, dim: 0.8 };

      const summary = generateDeviceSummary(lightDevice, capabilities);

      expect(summary).to.include('On');
      expect(summary).to.include('80%');
    });

    it('should generate summary for thermostat device', function() {
      const thermostatDevice = createMockDevice({
        class: 'thermostat',
        name: 'Test Thermostat'
      });
      const capabilities = { target_temperature: 22, measure_temperature: 21.5 };

      const summary = generateDeviceSummary(thermostatDevice, capabilities);

      expect(summary).to.include('22');
      expect(summary).to.include('21.5');
    });

    it('should handle devices with missing capabilities', function() {
      const device = createMockDevice({
        class: 'unknown',
        name: 'Unknown Device'
      });
      const capabilities = {};

      const summary = generateDeviceSummary(device, capabilities);

      expect(summary).to.be.a('string');
      expect(summary.length).to.be.above(0);
    });

    it('should handle offline devices in summary', function() {
      const offlineDevice = createMockDevice({
        class: 'speaker',
        name: 'Offline Speaker',
        available: false
      });
      const capabilities = { speaker_playing: false };

      const summary = generateDeviceSummary(offlineDevice, capabilities);

      expect(summary).to.include('Offline');
    });
  });

  describe('Error Handling', function() {
    it('should handle device capability retrieval errors', async function() {
      const faultyDevice = createMockDevice({
        name: 'Faulty Device',
        class: 'light'
      });

      // Make getCapabilityValue throw an error
      faultyDevice.getCapabilityValue.rejects(new Error('Device error'));

      const status = await getDeviceStatus(faultyDevice);

      expect(status).to.have.property('id', faultyDevice.id);
      expect(status).to.have.property('capabilities').that.is.empty;
    });

    it('should handle null device input', async function() {
      try {
        await getDeviceStatus(null);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).to.be.an('error');
      }
    });

    it('should handle invalid room matching', async function() {
      const result = await getRoomStatus(
        null,
        ['Kitchen'],
        mockHomeState.devices,
        mockHomeState.zones,
        'en'
      );

      expect(result).to.have.property('success', false);
      expect(result).to.have.property('error');
    });
  });
});
