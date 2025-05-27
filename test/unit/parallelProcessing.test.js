'use strict';

const { expect } = require('chai');
const sinon = require('sinon');

describe('Parallel Device Processing Performance Fix', () => {
  let app;
  let mockHomey;
  let clock;

  beforeEach(() => {
    clock = sinon.useFakeTimers();

    // Mock Homey environment
    mockHomey = {
      settings: {
        get: sinon.stub()
      },
      managers: {},
      api: { devices: {} },
      drivers: { getDrivers: sinon.stub() }
    };

    // Create app instance with mocked dependencies
    const ChatGPTAssistant = require('../../app');
    app = new ChatGPTAssistant();
    app.homey = mockHomey;
    app.log = sinon.stub();
    app.error = sinon.stub();

    // Mock getHomeState
    app.getHomeState = sinon.stub().resolves({
      devices: {},
      zones: {
        'zone1': { name: 'Living Room' },
        'zone2': { name: 'Kitchen' }
      }
    });

    // Mock required modules
    require.cache[require.resolve('../../modules/commandProcessor')] = {
      exports: {
        preprocessCommand: sinon.stub().returns({
          processed: 'turn on lights',
          intent: 'control',
          confidence: 0.8,
          multilingualData: {}
        }),
        suggestImprovement: sinon.stub(),
        detectMultiCommand: sinon.stub(),
        parseMultiCommand: sinon.stub()
      }
    };

    require.cache[require.resolve('../../modules/chatgptHelper')] = {
      exports: {
        constructPrompt: sinon.stub().returns('test prompt')
      }
    };

    // Mock getDevicesMapping with multiple devices
    app.getDevicesMapping = sinon.stub().resolves({
      'device1': {
        id: 'device1',
        name: 'Light 1',
        class: 'light',
        zone: 'zone1',
        capabilities: ['onoff'],
        setCapabilityValue: sinon.stub().resolves()
      },
      'device2': {
        id: 'device2',
        name: 'Light 2',
        class: 'light',
        zone: 'zone1',
        capabilities: ['onoff'],
        setCapabilityValue: sinon.stub().resolves()
      },
      'device3': {
        id: 'device3',
        name: 'Light 3',
        class: 'light',
        zone: 'zone1',
        capabilities: ['onoff'],
        setCapabilityValue: sinon.stub().resolves()
      },
      'device4': {
        id: 'device4',
        name: 'Light 4',
        class: 'light',
        zone: 'zone1',
        capabilities: ['onoff'],
        setCapabilityValue: sinon.stub().resolves()
      },
      'device5': {
        id: 'device5',
        name: 'Light 5',
        class: 'light',
        zone: 'zone1',
        capabilities: ['onoff'],
        setCapabilityValue: sinon.stub().resolves()
      }
    });
  });

  afterEach(() => {
    clock.restore();
    sinon.restore();
  });

  describe('Room Command Parallel Processing', () => {
    it('should process multiple devices in parallel', async () => {
      const startTime = Date.now();

      // Mock device operations to take 100ms each
      const devices = await app.getDevicesMapping();
      Object.values(devices).forEach(device => {
        device.setCapabilityValue = sinon.stub().callsFake(async () => {
          await new Promise(resolve => setTimeout(resolve, 100));
        });
      });

      const command = {
        room: 'Living Room',
        command: 'turn_on'
      };

      const resultPromise = app.executeHomeyCommand(command);

      // Advance time to simulate async operations
      clock.tick(100);

      const result = await resultPromise;
      const duration = Date.now() - startTime;

      // With parallel processing, total time should be ~100ms, not 500ms (5 * 100ms)
      expect(duration).to.be.below(200); // Allow some overhead
      expect(result).to.include('5/5 devices updated');
    });

    it('should handle mixed success and failure results', async () => {
      const devices = await app.getDevicesMapping();

      // Make some devices succeed and others fail
      devices.device1.setCapabilityValue = sinon.stub().resolves();
      devices.device2.setCapabilityValue = sinon.stub().rejects(new Error('Network error'));
      devices.device3.setCapabilityValue = sinon.stub().resolves();
      devices.device4.setCapabilityValue = sinon.stub().rejects(new Error('Device offline'));
      devices.device5.setCapabilityValue = sinon.stub().resolves();

      const command = {
        room: 'Living Room',
        command: 'turn_on'
      };

      const result = await app.executeHomeyCommand(command);

      expect(result).to.include('3/5 devices updated');
      expect(result).to.include('✅ Light 1: turn_on successful');
      expect(result).to.include('❌ Light 2: Network error');
      expect(result).to.include('✅ Light 3: turn_on successful');
      expect(result).to.include('❌ Light 4: Device offline');
      expect(result).to.include('✅ Light 5: turn_on successful');
    });

    it('should handle devices without required capabilities', async () => {
      const devices = await app.getDevicesMapping();

      // Remove capabilities from some devices
      devices.device2.capabilities = [];
      devices.device4.capabilities = [];

      const command = {
        room: 'Living Room',
        command: 'turn_on'
      };

      const result = await app.executeHomeyCommand(command);

      expect(result).to.include('3/5 devices updated');
      expect(result).to.include('⚠️ Light 2: doesn\'t support turn_on');
      expect(result).to.include('⚠️ Light 4: doesn\'t support turn_on');
    });
  });

  describe('Multiple Device IDs Parallel Processing', () => {
    it('should process device IDs in parallel', async () => {
      const startTime = Date.now();

      // Mock device operations to take 100ms each
      const devices = await app.getDevicesMapping();
      Object.values(devices).forEach(device => {
        device.setCapabilityValue = sinon.stub().callsFake(async () => {
          await new Promise(resolve => setTimeout(resolve, 100));
        });
      });

      const command = {
        device_ids: ['device1', 'device2', 'device3'],
        command: 'turn_on'
      };

      const resultPromise = app.executeHomeyCommand(command);

      // Advance time to simulate async operations
      clock.tick(100);

      const result = await resultPromise;
      const duration = Date.now() - startTime;

      // With parallel processing, total time should be ~100ms, not 300ms (3 * 100ms)
      expect(duration).to.be.below(200); // Allow some overhead
      expect(result).to.include('3/3 devices updated');
    });

    it('should handle non-existent device IDs', async () => {
      const command = {
        device_ids: ['device1', 'nonexistent', 'device3'],
        command: 'turn_on'
      };

      const result = await app.executeHomeyCommand(command);

      expect(result).to.include('2/3 devices updated');
      expect(result).to.include('✅ Light 1: turn_on successful');
      expect(result).to.include('❌ Device nonexistent: not found');
      expect(result).to.include('✅ Light 3: turn_on successful');
    });
  });

  describe('Performance Comparison', () => {
    it('should be significantly faster than sequential processing', async () => {
      const devices = await app.getDevicesMapping();
      const deviceCount = Object.keys(devices).length;
      const operationDelay = 50; // ms per device operation

      // Mock device operations with delay
      Object.values(devices).forEach(device => {
        device.setCapabilityValue = sinon.stub().callsFake(async () => {
          await new Promise(resolve => setTimeout(resolve, operationDelay));
        });
      });

      const command = {
        room: 'Living Room',
        command: 'turn_on'
      };

      const startTime = Date.now();
      const resultPromise = app.executeHomeyCommand(command);

      // Advance time for parallel execution
      clock.tick(operationDelay);

      const result = await resultPromise;
      const parallelDuration = Date.now() - startTime;

      // Parallel execution should take roughly the time of one operation
      // Sequential would take deviceCount * operationDelay
      const sequentialEstimate = deviceCount * operationDelay;

      expect(parallelDuration).to.be.below(sequentialEstimate / 2);
      expect(result).to.include(`${deviceCount}/${deviceCount} devices updated`);
    });

    it('should handle large numbers of devices efficiently', async () => {
      // Create a larger set of devices for stress testing
      const largeDeviceSet = {};
      for (let i = 1; i <= 20; i++) {
        largeDeviceSet[`device${i}`] = {
          id: `device${i}`,
          name: `Light ${i}`,
          class: 'light',
          zone: 'zone1',
          capabilities: ['onoff'],
          setCapabilityValue: sinon.stub().callsFake(async () => {
            await new Promise(resolve => setTimeout(resolve, 10));
          })
        };
      }

      app.getDevicesMapping = sinon.stub().resolves(largeDeviceSet);

      const command = {
        room: 'Living Room',
        command: 'turn_on'
      };

      const startTime = Date.now();
      const resultPromise = app.executeHomeyCommand(command);

      // Advance time for parallel execution
      clock.tick(10);

      const result = await resultPromise;
      const duration = Date.now() - startTime;

      // Should complete in roughly the time of one operation, not 20 operations
      expect(duration).to.be.below(50); // Much less than 20 * 10ms = 200ms
      expect(result).to.include('20/20 devices updated');
    });
  });

  describe('Error Handling in Parallel Processing', () => {
    it('should not fail completely if some devices fail', async () => {
      const devices = await app.getDevicesMapping();

      // Make every other device fail
      Object.values(devices).forEach((device, index) => {
        if (index % 2 === 0) {
          device.setCapabilityValue = sinon.stub().resolves();
        } else {
          device.setCapabilityValue = sinon.stub().rejects(new Error('Device error'));
        }
      });

      const command = {
        room: 'Living Room',
        command: 'turn_on'
      };

      const result = await app.executeHomeyCommand(command);

      // Should have partial success
      expect(result).to.include('3/5 devices updated'); // 3 out of 5 should succeed
      expect(result).to.include('✅');
      expect(result).to.include('❌');
    });

    it('should handle promise rejections gracefully', async () => {
      const devices = await app.getDevicesMapping();

      // Make one device throw an unhandled error
      devices.device3.setCapabilityValue = sinon.stub().callsFake(() => {
        throw new Error('Synchronous error');
      });

      const command = {
        room: 'Living Room',
        command: 'turn_on'
      };

      const result = await app.executeHomeyCommand(command);

      // Should handle the error and continue with other devices
      expect(result).to.include('4/5 devices updated');
      expect(result).to.include('❌ Light 3: Synchronous error');
    });
  });
});
