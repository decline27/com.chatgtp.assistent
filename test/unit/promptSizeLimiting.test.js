'use strict';

const { expect } = require('chai');
const { constructPrompt } = require('../../modules/chatgptHelper');

describe('Prompt Size Limiting', function() {
  describe('constructPrompt', function() {
    it('should limit prompt size when home state is large', function() {
      // Create a large home state with many devices
      const largeHomeState = {
        zones: {},
        devices: {}
      };

      // Add many zones
      for (let i = 1; i <= 20; i++) {
        largeHomeState.zones[`zone_${i}`] = { name: `Room ${i}` };
      }

      // Add many devices (100 devices)
      for (let i = 1; i <= 100; i++) {
        largeHomeState.devices[`device_${i}`] = {
          id: `device_${i}`,
          name: `Device ${i}`,
          zone: `zone_${(i % 20) + 1}`,
          class: 'light'
        };
      }

      const commandText = 'Turn on all lights';
      const prompt = constructPrompt(commandText, largeHomeState);

      // Prompt should be under the limit
      expect(prompt.length).to.be.below(10000);

      // Should still contain the command
      expect(prompt).to.include(commandText);

      // Should contain some room information
      expect(prompt).to.include('Room 1');
    });

    it('should use minimal prompt when full prompt is too large', function() {
      // Create an extremely large home state
      const extremeHomeState = {
        zones: {},
        devices: {}
      };

      // Add many zones with long names
      for (let i = 1; i <= 50; i++) {
        extremeHomeState.zones[`zone_${i}`] = {
          name: `Very Long Room Name That Takes Up Space ${i}`
        };
      }

      // Add many devices with long names (500 devices)
      for (let i = 1; i <= 500; i++) {
        extremeHomeState.devices[`device_${i}`] = {
          id: `device_${i}`,
          name: `Very Long Device Name That Takes Up A Lot Of Space ${i}`,
          zone: `zone_${(i % 50) + 1}`,
          class: 'light'
        };
      }

      const commandText = 'Turn on all lights';
      const prompt = constructPrompt(commandText, extremeHomeState);

      // Prompt should be under the limit
      expect(prompt.length).to.be.below(10000);

      // Should still contain the command
      expect(prompt).to.include(commandText);

      // Should be a minimal prompt (shorter than full prompt)
      expect(prompt.length).to.be.below(5000); // Minimal prompt should be much shorter than full
    });

    it('should handle normal sized home state without truncation', function() {
      const normalHomeState = {
        zones: {
          'zone_1': { name: 'Living Room' },
          'zone_2': { name: 'Bedroom' },
          'zone_3': { name: 'Kitchen' }
        },
        devices: {
          'device_1': {
            id: 'device_1',
            name: 'Living Room Light',
            zone: 'zone_1',
            class: 'light'
          },
          'device_2': {
            id: 'device_2',
            name: 'Bedroom Light',
            zone: 'zone_2',
            class: 'light'
          }
        }
      };

      const commandText = 'Turn on living room lights';
      const prompt = constructPrompt(commandText, normalHomeState);

      // Should contain full device information
      expect(prompt).to.include('Living Room Light');
      expect(prompt).to.include('Bedroom Light');
      expect(prompt).to.include('device_1');
      expect(prompt).to.include('device_2');

      // Should be under the limit
      expect(prompt.length).to.be.below(10000);
    });

    it('should include device limit note when devices are truncated', function() {
      const homeStateWithManyDevices = {
        zones: {
          'zone_1': { name: 'Living Room' }
        },
        devices: {}
      };

      // Add 60 devices (more than default limit of 50)
      for (let i = 1; i <= 60; i++) {
        homeStateWithManyDevices.devices[`device_${i}`] = {
          id: `device_${i}`,
          name: `Device ${i}`,
          zone: 'zone_1',
          class: 'light'
        };
      }

      const commandText = 'Turn on lights';
      // Use a higher maxPromptLength to ensure we get the full prompt with device note
      const prompt = constructPrompt(commandText, homeStateWithManyDevices, { maxPromptLength: 15000 });

      // Should include a note about device limiting
      expect(prompt).to.include('Showing');
      expect(prompt).to.include('of 60 total devices');
    });

    it('should respect custom maxDevices option', function() {
      const homeState = {
        zones: { 'zone_1': { name: 'Living Room' } },
        devices: {}
      };

      // Add 20 devices
      for (let i = 1; i <= 20; i++) {
        homeState.devices[`device_${i}`] = {
          id: `device_${i}`,
          name: `Device ${i}`,
          zone: 'zone_1',
          class: 'light'
        };
      }

      const commandText = 'Turn on lights';
      const prompt = constructPrompt(commandText, homeState, { maxDevices: 5 });

      // Should only include 5 devices
      expect(prompt).to.include('Device 1');
      expect(prompt).to.include('Device 5');
      expect(prompt).to.not.include('Device 6');

      // Should include limiting note
      expect(prompt).to.include('Showing 5 of 20 total devices');
    });
  });
});
