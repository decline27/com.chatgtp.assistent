'use strict';

/**
 * Testing Framework Demonstration
 * Shows how to use the comprehensive testing framework
 */

const { expect, TEST_CONFIG, TestDataGenerators } = require('../utils/testSetup');
const { createMockHomeState, createMockLLMFunction, createMockDevice } = require('../utils/mockHomeyAPI');

describe('Testing Framework Demo', function() {
  this.timeout(TEST_CONFIG.timeout.unit);

  let mockHomeState;
  let mockLLMFunction;

  beforeEach(function() {
    // Setup runs before each test
    mockHomeState = createMockHomeState();
    mockLLMFunction = createMockLLMFunction();
  });

  describe('Basic Test Structure', function() {
    it('should demonstrate basic assertions', function() {
      const testValue = 'hello world';

      expect(testValue).to.be.a('string');
      expect(testValue).to.include('world');
      expect(testValue).to.have.length(11);
    });

    it('should demonstrate object assertions', function() {
      const testObject = {
        name: 'Test Device',
        type: 'light',
        status: 'on',
        brightness: 75
      };

      expect(testObject).to.have.property('name', 'Test Device');
      expect(testObject).to.have.property('brightness').above(50);
      expect(testObject).to.include.keys(['name', 'type', 'status']);
    });

    it('should demonstrate array assertions', function() {
      const testArray = ['kitchen', 'bedroom', 'living room'];

      expect(testArray).to.be.an('array');
      expect(testArray).to.have.length(3);
      expect(testArray).to.include('kitchen');
      expect(testArray).to.not.include('bathroom');
    });
  });

  describe('Mock System Demo', function() {
    it('should demonstrate device mocking', function() {
      const mockLight = createMockDevice({
        name: 'Demo Light',
        class: 'light',
        onoff: true,
        dim: 0.8
      });

      expect(mockLight).to.have.property('name', 'Demo Light');
      expect(mockLight).to.have.property('class', 'light');
      expect(mockLight).to.have.property('capabilitiesObj');
      expect(mockLight.capabilitiesObj.onoff.value).to.be.true;
      expect(mockLight.capabilitiesObj.dim.value).to.equal(0.8);
    });

    it('should demonstrate home state mocking', function() {
      expect(mockHomeState).to.have.property('devices');
      expect(mockHomeState).to.have.property('zones');

      const deviceCount = Object.keys(mockHomeState.devices).length;
      const zoneCount = Object.keys(mockHomeState.zones).length;

      expect(deviceCount).to.be.above(0);
      expect(zoneCount).to.be.above(0);
    });

    it('should demonstrate LLM function mocking', async function() {
      const response = await mockLLMFunction('test prompt with kitchen');
      const parsed = JSON.parse(response);

      expect(parsed).to.have.property('match');
      expect(parsed).to.have.property('confidence');
      expect(parsed).to.have.property('reasoning');
    });
  });

  describe('Async Testing Demo', function() {
    it('should demonstrate async/await testing', async function() {
      const mockDevice = createMockDevice({
        name: 'Async Test Device',
        class: 'light'
      });

      const capabilityValue = await mockDevice.getCapabilityValue('onoff');
      expect(capabilityValue).to.be.a('boolean');

      const setResult = await mockDevice.setCapabilityValue('onoff', true);
      expect(setResult).to.be.true;
    });

    it('should demonstrate promise testing', function() {
      const mockDevice = createMockDevice({
        name: 'Promise Test Device',
        class: 'thermostat'
      });

      return mockDevice.getCapabilityValue('target_temperature')
        .then(value => {
          expect(value).to.be.a('number');
          expect(value).to.be.above(0);
        });
    });

    it('should demonstrate promise rejection testing', async function() {
      const faultyDevice = createMockDevice({
        name: 'Faulty Device',
        class: 'light'
      });

      // Make the device throw an error
      faultyDevice.getCapabilityValue.rejects(new Error('Device error'));

      await expect(faultyDevice.getCapabilityValue('onoff'))
        .to.be.rejectedWith('Device error');
    });
  });

  describe('Test Data Generation Demo', function() {
    it('should demonstrate multilingual command generation', function() {
      const englishCommands = TestDataGenerators.generateMultilingualCommands('en');
      const swedishCommands = TestDataGenerators.generateMultilingualCommands('sv');

      expect(englishCommands).to.be.an('array');
      expect(englishCommands).to.have.length.above(0);
      expect(swedishCommands).to.be.an('array');
      expect(swedishCommands).to.have.length.above(0);

      // Commands should be different for different languages
      expect(englishCommands[0]).to.not.equal(swedishCommands[0]);
    });

    it('should demonstrate status query generation', function() {
      const statusQueries = TestDataGenerators.generateStatusQueries('en');

      expect(statusQueries).to.be.an('array');
      expect(statusQueries).to.have.length.above(0);

      statusQueries.forEach(query => {
        expect(query).to.be.a('string');
        expect(query.length).to.be.above(0);
      });
    });
  });

  describe('Configuration Demo', function() {
    it('should demonstrate test configuration usage', function() {
      expect(TEST_CONFIG).to.have.property('timeout');
      expect(TEST_CONFIG).to.have.property('languages');
      expect(TEST_CONFIG).to.have.property('deviceClasses');
      expect(TEST_CONFIG).to.have.property('rooms');

      expect(TEST_CONFIG.languages).to.include('en');
      expect(TEST_CONFIG.languages).to.include('sv');
      expect(TEST_CONFIG.deviceClasses).to.include('light');
      expect(TEST_CONFIG.rooms).to.include('kitchen');
    });

    it('should demonstrate timeout configuration', function() {
      expect(TEST_CONFIG.timeout.unit).to.be.a('number');
      expect(TEST_CONFIG.timeout.integration).to.be.a('number');
      expect(TEST_CONFIG.timeout.performance).to.be.a('number');

      expect(TEST_CONFIG.timeout.integration).to.be.above(TEST_CONFIG.timeout.unit);
      expect(TEST_CONFIG.timeout.performance).to.be.above(TEST_CONFIG.timeout.integration);
    });
  });

  describe('Error Handling Demo', function() {
    it('should demonstrate error assertion', function() {
      const errorFunction = () => {
        throw new Error('Test error message');
      };

      expect(errorFunction).to.throw('Test error message');
      expect(errorFunction).to.throw(Error);
    });

    it('should demonstrate graceful error handling', function() {
      const safeFunction = input => {
        try {
          if (!input) throw new Error('No input provided');
          return input.toUpperCase();
        } catch (error) {
          return 'ERROR';
        }
      };

      expect(safeFunction('hello')).to.equal('HELLO');
      expect(safeFunction(null)).to.equal('ERROR');
      expect(safeFunction('')).to.equal('ERROR');
    });
  });

  describe('Performance Testing Demo', function() {
    it('should demonstrate performance measurement', function() {
      const startTime = Date.now();

      // Simulate some work
      for (let i = 0; i < 1000; i++) {
        Math.sqrt(i);
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).to.be.a('number');
      expect(duration).to.be.below(100); // Should complete quickly
    });

    it('should demonstrate memory usage awareness', function() {
      const initialMemory = process.memoryUsage().heapUsed;

      // Create some objects
      const largeArray = new Array(10000).fill('test data');

      const afterMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = afterMemory - initialMemory;

      expect(memoryIncrease).to.be.above(0);
      expect(largeArray).to.have.length(10000);
    });
  });

  describe('Best Practices Demo', function() {
    it('should demonstrate descriptive test names', function() {
      // Test name clearly describes what is being tested
      const deviceName = 'Kitchen Light';
      const expectedClass = 'light';

      expect(deviceName).to.include('Kitchen');
      expect(expectedClass).to.equal('light');
    });

    it('should demonstrate single responsibility testing', function() {
      // Each test should test one specific thing
      const device = createMockDevice({ class: 'light' });

      // Only testing the class property
      expect(device.class).to.equal('light');
    });

    it('should demonstrate clear assertions with messages', function() {
      const result = { success: true, data: 'test' };

      expect(result.success, 'Operation should succeed').to.be.true;
      expect(result.data, 'Should contain test data').to.equal('test');
    });
  });
});
