'use strict';

/**
 * Regression Tests for Previously Fixed Bugs
 * Ensures that previously reported and fixed issues don't reoccur
 */

const { expect, TEST_CONFIG } = require('../utils/testSetup');
const { createMockHomeState, createMockLLMFunction } = require('../utils/mockHomeyAPI');
const { handleStatusQuery } = require('../../modules/statusQueryHandler');
const { processMultilingualCommand } = require('../../modules/multilingualProcessor');
const { preprocessCommand, detectMultiCommand, parseMultiCommand } = require('../../modules/commandProcessor');

describe('Regression Tests - Fixed Bugs', function() {
  this.timeout(TEST_CONFIG.timeout.unit);

  let mockHomeState;
  let mockLLMFunction;

  beforeEach(function() {
    mockHomeState = createMockHomeState();
    mockLLMFunction = createMockLLMFunction();
  });

  describe('Swedish Kitchen Light Status Bug', function() {
    // Bug: Swedish 'livingroom' incorrectly translated to 'Vardagsrummet' causing validation failures
    it('should not incorrectly translate English livingroom to Swedish', function() {
      const command = 'Turn on livingroom lights';

      const result = processMultilingualCommand(command, 'en');

      expect(result).to.have.property('rooms').that.is.not.empty;
      expect(result.rooms[0]).to.not.equal('Vardagsrummet');
      expect(result.rooms[0]).to.include('living');
    });

    it('should handle Swedish kitchen light status correctly', async function() {
      const result = await handleStatusQuery(
        'Vad är status på kök ljus?',
        'sv',
        mockHomeState,
        mockLLMFunction
      );

      expect(result).to.have.property('success', true);
      expect(result.formattedText).to.include('Kitchen');
      expect(result.formattedText).to.not.include('not found');
      expect(result.formattedText).to.not.include('error');
    });
  });

  describe('Swedish Room Name Translation Bug', function() {
    // Bug: Swedish 'trädgården' incorrectly translated to English 'garden' instead of matching 'Trägården'
    it('should not translate Swedish trädgården to English garden', function() {
      const command = 'Visa enheter i trädgården';

      const result = processMultilingualCommand(command, 'sv');

      expect(result).to.have.property('rooms').that.is.not.empty;
      expect(result.rooms[0]).to.not.equal('garden');
      expect(result.rooms[0]).to.include('träd');
    });

    it('should match trädgården to Trägården correctly', async function() {
      const result = await handleStatusQuery(
        'Visa enheter i trädgården',
        'sv',
        mockHomeState,
        mockLLMFunction
      );

      expect(result).to.have.property('success', true);
      expect(result.formattedText).to.include('Trägården');
      expect(result.formattedText).to.not.include('garden');
    });
  });

  describe('Multi-Command Validation Bug', function() {
    // Bug: Multi-command structures were rejected by validation logic
    it('should accept multi-command JSON structures', function() {
      const multiCommandJSON = {
        commands: [
          { room: 'living room', command: 'turn_on', device_filter: 'light' },
          { room: 'living room', command: 'play_music', device_filter: 'speaker' }
        ]
      };

      // Simulate the validation logic that was fixed
      const hasValidTarget = multiCommandJSON.room
                           || multiCommandJSON.device_ids
                           || multiCommandJSON.device_id
                           || multiCommandJSON.commands;

      const hasValidCommand = multiCommandJSON.command || multiCommandJSON.commands;

      expect(hasValidTarget).to.be.true;
      expect(hasValidCommand).to.be.true;
    });

    it('should detect and parse multi-commands correctly', function() {
      const command = 'Turn on lights and play music in living room';

      const isMulti = detectMultiCommand(command);
      expect(isMulti).to.be.true;

      const parsed = parseMultiCommand(command);
      expect(parsed).to.have.property('isMultiCommand', true);
      expect(parsed).to.have.property('commands').that.is.an('array');
      expect(parsed.commands).to.have.length.above(1);
    });
  });

  describe('Device Type Filtering Bug', function() {
    // Bug: When user says "turn on lights", system should filter to only light devices, not all devices
    it('should filter to lights only when lights are mentioned', function() {
      const command = 'turn on lights in living room';

      const result = processMultilingualCommand(command, 'en');

      expect(result).to.have.property('deviceTypes').that.includes('light');
      expect(result.deviceTypes).to.not.include('camera');
      expect(result.deviceTypes).to.not.include('sensor');
    });

    it('should filter to lights for typo "ligt"', function() {
      const command = 'turn on the ligt in the livingroom';

      const processed = preprocessCommand(command);

      expect(processed.entities.deviceTypes).to.include('light');
      expect(processed.entities.rooms).to.include('living room');
    });

    it('should prefer lights for generic room commands', function() {
      const command = 'turn on living room';

      const result = processMultilingualCommand(command, 'en');

      expect(result).to.have.property('deviceTypes').that.includes('light');
      expect(result).to.have.property('rooms').that.includes('living room');
    });
  });

  describe('Status Query Single Device Bug', function() {
    // Bug: Status queries for device types in rooms should return all matching devices, not just one
    it('should return all lights when asking about lights in a room', async function() {
      // Add multiple lights to the same room for testing
      const testHomeState = createMockHomeState();
      testHomeState.devices.kitchen_light_2 = {
        id: 'kitchen_light_2',
        name: 'Kitchen Light 2',
        class: 'light',
        zone: 'kitchen_zone',
        available: true,
        capabilities: ['onoff', 'dim'],
        capabilitiesObj: { onoff: { value: true }, dim: { value: 0.6 } },
        getCapabilityValue: async cap => {
          if (cap === 'onoff') return true;
          if (cap === 'dim') return 0.6;
          return null;
        },
        setCapabilityValue: async () => true
      };

      const result = await handleStatusQuery(
        'What\'s the status of lights in kitchen?',
        'en',
        testHomeState,
        mockLLMFunction
      );

      expect(result).to.have.property('success', true);

      // Should include multiple light devices
      const lightCount = (result.formattedText.match(/Kitchen Light/g) || []).length;
      expect(lightCount).to.be.above(1);
    });
  });

  describe('Language Detection Edge Cases', function() {
    // Bug: Mixed language commands could cause language detection failures
    it('should handle mixed language commands without crashing', function() {
      const mixedCommands = [
        'Turn on vardagsrum lights',
        'Encender bedroom lights',
        'Allumer kök lights',
        'Licht einschalten in kitchen'
      ];

      mixedCommands.forEach(command => {
        const result = processMultilingualCommand(command, 'auto');

        expect(result).to.have.property('confidence').that.is.a('number');
        expect(result).to.have.property('rooms').that.is.an('array');
        expect(result).to.have.property('actions').that.is.an('array');
        expect(result).to.have.property('deviceTypes').that.is.an('array');
      });
    });
  });

  describe('Unicode Character Handling Bug', function() {
    // Bug: Swedish characters (ä, ö, å) could cause matching failures
    it('should handle Swedish characters in room names correctly', async function() {
      const result = await handleStatusQuery(
        'Visa enheter i trädgården',
        'sv',
        mockHomeState,
        mockLLMFunction
      );

      expect(result).to.have.property('success', true);
      expect(result.formattedText).to.include('Trägården');
    });

    it('should normalize unicode characters for matching', function() {
      const command = 'Sätt på ljus i kök';

      const result = processMultilingualCommand(command, 'sv');

      expect(result).to.have.property('rooms').that.is.not.empty;
      expect(result).to.have.property('actions').that.includes('turn_on');
      expect(result).to.have.property('deviceTypes').that.includes('light');
    });
  });

  describe('Empty Response Bug', function() {
    // Bug: Some queries could return empty responses instead of proper error messages
    it('should provide meaningful error messages for failed queries', async function() {
      const result = await handleStatusQuery(
        'Show me devices in nonexistent room',
        'en',
        mockHomeState,
        mockLLMFunction
      );

      expect(result).to.have.property('success', false);
      expect(result).to.have.property('error').that.is.a('string');
      expect(result.error.length).to.be.above(0);
      expect(result.error).to.include('not found');
    });

    it('should handle empty home state gracefully', async function() {
      const emptyHomeState = { devices: {}, zones: {} };

      const result = await handleStatusQuery(
        'Show me all devices',
        'en',
        emptyHomeState,
        mockLLMFunction
      );

      expect(result).to.have.property('success', true);
      expect(result).to.have.property('formattedText').that.is.a('string');
      expect(result.formattedText).to.include('No devices');
    });
  });

  describe('Confidence Score Bug', function() {
    // Bug: Some valid commands were getting very low confidence scores
    it('should assign reasonable confidence to clear commands', function() {
      const clearCommands = [
        'Turn on kitchen lights',
        'Dim bedroom to 50%',
        'Set temperature to 22',
        'Play music in living room'
      ];

      clearCommands.forEach(command => {
        const result = processMultilingualCommand(command, 'en');
        expect(result.confidence).to.be.above(0.7);
      });
    });

    it('should assign reasonable confidence to Swedish commands', function() {
      const swedishCommands = [
        'Sätt på kök ljus',
        'Dimma sovrum till 50%',
        'Sätt temperaturen till 22',
        'Spela musik i vardagsrummet'
      ];

      swedishCommands.forEach(command => {
        const result = processMultilingualCommand(command, 'sv');
        expect(result.confidence).to.be.above(0.6);
      });
    });
  });

  describe('Performance Regression', function() {
    // Ensure fixes didn't introduce performance regressions
    it('should process commands within reasonable time limits', function() {
      const commands = [
        'Turn on all lights in the house',
        'Show me status of all devices',
        'Sätt på alla ljus i huset',
        'Visa status för alla enheter'
      ];

      commands.forEach(command => {
        const startTime = Date.now();

        if (command.includes('status') || command.includes('Show')) {
          // Status queries are async, but we can test the synchronous parts
          const processed = preprocessCommand(command);
          expect(processed).to.have.property('confidence');
        } else {
          const result = processMultilingualCommand(command, 'auto');
          expect(result).to.have.property('confidence');
        }

        const endTime = Date.now();
        expect(endTime - startTime).to.be.below(500); // Should complete within 500ms
      });
    });
  });
});
