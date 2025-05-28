'use strict';

const { expect } = require('chai');
const { constructPrompt } = require('../../modules/chatgptHelper');

describe('Swedish Light Command Filtering', function() {
  describe('constructPrompt for Swedish light commands', function() {

    let largeHomeState;

    beforeEach(function() {
      // Create a large home state to force minimal prompt usage
      largeHomeState = {
        zones: {},
        devices: {}
      };

      // Add many zones
      for (let i = 1; i <= 20; i++) {
        largeHomeState.zones[`zone_${i}`] = { name: `Room ${i}` };
      }

      // Add many devices (100 devices) to force minimal prompt
      for (let i = 1; i <= 100; i++) {
        largeHomeState.devices[`device_${i}`] = {
          id: `device_${i}`,
          name: `Device ${i}`,
          zone: `zone_${(i % 20) + 1}`,
          class: 'light'
        };
      }
    });

    it('should include device_filter guidance for Swedish "ljus" commands', function() {
      const commandText = 'Tänd ljuset i hela huset';
      const prompt = constructPrompt(commandText, largeHomeState);

      // Should be minimal prompt due to large home state
      expect(prompt.length).to.be.below(1000);

      // Should include device_filter guidance
      expect(prompt).to.include('device_filter');
      expect(prompt).to.include('"light"');

      // Should include specific guidance for light commands
      expect(prompt).to.include('Add "device_filter": "light" for light commands');

      // Should include Swedish example
      expect(prompt).to.include('Tänd ljuset i hela huset');
    });

    it('should include device_filter guidance for Swedish "lampor" commands', function() {
      const commandText = 'Sätt på lamporna';
      const prompt = constructPrompt(commandText, largeHomeState);

      // Should include device_filter guidance for lamp commands
      expect(prompt).to.include('device_filter');
      expect(prompt).to.include('Add "device_filter": "light" for light commands');
    });

    it('should include device_filter guidance for Swedish "belysning" commands', function() {
      const commandText = 'Tänd belysningen';
      const prompt = constructPrompt(commandText, largeHomeState);

      // Should include device_filter guidance for lighting commands
      expect(prompt).to.include('device_filter');
      expect(prompt).to.include('Add "device_filter": "light" for light commands');
    });

    it('should NOT include light-specific guidance for non-light commands', function() {
      const commandText = 'Sätt på musiken';
      const prompt = constructPrompt(commandText, largeHomeState);

      // Should not include light-specific guidance for music commands
      expect(prompt).to.not.include('Add "device_filter": "light" for light commands');

      // But should still include general device_filter info
      expect(prompt).to.include('device_filter');
    });

    it('should include multi-room examples with device_filter', function() {
      const commandText = 'Tänd ljuset i hela huset';
      const prompt = constructPrompt(commandText, largeHomeState);

      // Should include multi-room example format
      expect(prompt).to.include('Multi-room');
      expect(prompt).to.include('device_filter');

      // Should include specific Swedish multi-room example
      expect(prompt).to.include('{"room": "Room1", "command": "turn_on", "device_filter": "light"}');
    });

    it('should handle English light commands correctly', function() {
      const commandText = 'Turn on all the lights';
      const prompt = constructPrompt(commandText, largeHomeState);

      // Should include device_filter guidance for English light commands too
      expect(prompt).to.include('device_filter');
      expect(prompt).to.include('Add "device_filter": "light" for light commands');
    });

    it('should include all necessary device filter types', function() {
      const commandText = 'Tänd ljuset';
      const prompt = constructPrompt(commandText, largeHomeState);

      // Should include all device filter types
      expect(prompt).to.include('DEVICE FILTERS: light, speaker, socket, thermostat');
    });

    it('should provide clear output format examples', function() {
      const commandText = 'Slå på allt ljuset';
      const prompt = constructPrompt(commandText, largeHomeState);

      // Should include clear format examples
      expect(prompt).to.include('OUTPUT FORMATS:');
      expect(prompt).to.include('device_filter');
      expect(prompt).to.include('Multi-room');
    });
  });
});
