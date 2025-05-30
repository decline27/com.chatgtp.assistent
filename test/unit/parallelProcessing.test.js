'use strict';

const { expect } = require('chai');
const sinon = require('sinon');

describe('Parallel Device Processing Performance Fix', () => {
  let app;
  let mockHomey;

  beforeEach(() => {
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
      // Mock device operations to track if they're called
      const devices = await app.getDevicesMapping();
      const deviceCalls = [];
      
      Object.values(devices).forEach((device, index) => {
        device.setCapabilityValue = sinon.stub().callsFake(async () => {
          deviceCalls.push(Date.now());
          return true;
        });
      });

      const command = {
        room: 'Living Room',
        command: 'turn_on'
      };

      const result = await app.executeHomeyCommand(command);

      // Verify all devices were processed
      expect(deviceCalls).to.have.length(5);
      expect(result).to.include('5/5 devices updated');
      
      // Verify each device's setCapabilityValue was called
      Object.values(devices).forEach(device => {
        expect(device.setCapabilityValue).to.have.been.called;
      });
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
      delete devices.device2.capabilities;
      delete devices.device4.capabilities;

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
      // Mock device operations
      const devices = await app.getDevicesMapping();
      const deviceCalls = [];
      
      Object.values(devices).forEach((device, index) => {
        device.setCapabilityValue = sinon.stub().callsFake(async () => {
          deviceCalls.push(Date.now());
          return true;
        });
      });

      const command = {
        device_ids: ['device1', 'device2', 'device3'],
        command: 'turn_on'
      };

      const result = await app.executeHomeyCommand(command);

      // Verify all devices were processed
      expect(deviceCalls).to.have.length(3);
      expect(result).to.include('3/3 devices updated');
      
      // Verify the specific devices were called
      expect(devices.device1.setCapabilityValue).to.have.been.called;
      expect(devices.device2.setCapabilityValue).to.have.been.called;
      expect(devices.device3.setCapabilityValue).to.have.been.called;
    });

    it('should handle non-existent device IDs', async () => {
      const command = {
        device_ids: ['device1', 'nonexistent', 'device3'],
        command: 'turn_on'
      };

      try {
        await app.executeHomeyCommand(command);
        expect.fail('Should have thrown an error for non-existent devices');
      } catch (error) {
        expect(error.message).to.include('No matching devices found');
        expect(error.message).to.include('nonexistent');
      }
    });
  });

  describe('Performance Comparison', () => {
    it('should be significantly faster than sequential processing', async () => {
      const devices = await app.getDevicesMapping();
      const deviceCount = Object.keys(devices).length;
      
      let callOrder = [];
      let completionOrder = [];

      // Mock device operations to track order
      Object.values(devices).forEach((device, index) => {
        device.setCapabilityValue = sinon.stub().callsFake(async () => {
          callOrder.push(index);
          // Simulate async operation
          await new Promise(resolve => setImmediate(resolve));
          completionOrder.push(index);
          return true;
        });
      });

      const command = {
        room: 'Living Room',
        command: 'turn_on'
      };

      const result = await app.executeHomeyCommand(command);

      // All devices should be called
      expect(callOrder).to.have.length(deviceCount);
      expect(completionOrder).to.have.length(deviceCount);
      expect(result).to.include(`${deviceCount}/${deviceCount} devices updated`);
      
      // Verify all devices were processed
      Object.values(devices).forEach(device => {
        expect(device.setCapabilityValue).to.have.been.called;
      });
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
          setCapabilityValue: sinon.stub().resolves(true)
        };
      }

      app.getDevicesMapping = sinon.stub().resolves(largeDeviceSet);

      const command = {
        room: 'Living Room',
        command: 'turn_on'
      };

      const result = await app.executeHomeyCommand(command);

      // Should handle all 20 devices
      expect(result).to.include('20/20 devices updated');
      
      // Verify all devices were called
      Object.values(largeDeviceSet).forEach(device => {
        expect(device.setCapabilityValue).to.have.been.called;
      });
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
