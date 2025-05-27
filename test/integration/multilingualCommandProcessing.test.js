'use strict';

/**
 * Integration Tests for Multilingual Command Processing
 * Tests complete end-to-end multilingual voice command workflows
 */

const { expect, TEST_CONFIG, TestDataGenerators } = require('../utils/testSetup');
const { createMockHomeState, createMockLLMFunction } = require('../utils/mockHomeyAPI');
const { preprocessCommand, detectMultiCommand, parseMultiCommand } = require('../../modules/commandProcessor');
const { processMultilingualCommand } = require('../../modules/multilingualProcessor');

describe('Multilingual Command Processing Integration', function() {
  this.timeout(TEST_CONFIG.timeout.integration);

  let mockHomeState;
  let mockLLMFunction;

  beforeEach(function() {
    mockHomeState = createMockHomeState();
    mockLLMFunction = createMockLLMFunction();
  });

  describe('Single Language Commands', function() {
    TEST_CONFIG.languages.forEach(language => {
      it(`should process ${language} commands end-to-end`, function() {
        const commands = TestDataGenerators.generateMultilingualCommands(language);

        commands.forEach(command => {
          const result = processMultilingualCommand(command, language);

          expect(result).to.have.property('rooms').that.is.an('array');
          expect(result).to.have.property('actions').that.is.an('array');
          expect(result).to.have.property('deviceTypes').that.is.an('array');
          expect(result).to.have.property('confidence').that.is.a('number');
          expect(result).to.have.property('language', language);

          // Should have extracted at least one meaningful element
          const hasContent = result.rooms.length > 0
                           || result.actions.length > 0
                           || result.deviceTypes.length > 0;
          expect(hasContent).to.be.true;
        });
      });
    });
  });

  describe('Multi-Command Processing', function() {
    it('should detect and parse English multi-commands', function() {
      const command = 'Turn on lights and play music in living room';

      const isMulti = detectMultiCommand(command);
      expect(isMulti).to.be.true;

      const parsed = parseMultiCommand(command);
      expect(parsed).to.have.property('isMultiCommand', true);
      expect(parsed).to.have.property('commands').that.is.an('array');
      expect(parsed.commands).to.have.length.above(1);

      // Should contain both light and music commands
      const commandTexts = parsed.commands.map(cmd => cmd.command);
      expect(commandTexts.some(cmd => cmd.includes('light'))).to.be.true;
      expect(commandTexts.some(cmd => cmd.includes('music'))).to.be.true;
    });

    it('should handle Swedish multi-commands', function() {
      const command = 'Sätt på ljus och spela musik i vardagsrummet';

      const isMulti = detectMultiCommand(command);
      expect(isMulti).to.be.true;

      const parsed = parseMultiCommand(command);
      expect(parsed).to.have.property('isMultiCommand', true);
      expect(parsed.commands).to.have.length.above(1);
    });

    it('should process multi-commands with room context', function() {
      const command = 'Turn on lights and speakers in kitchen';

      const processed = preprocessCommand(command);
      expect(processed).to.have.property('entities');
      expect(processed.entities).to.have.property('rooms').that.includes('kitchen');
      expect(processed.entities).to.have.property('deviceTypes').that.is.an('array');

      // Should include both lights and speakers
      const deviceTypes = processed.entities.deviceTypes;
      expect(deviceTypes.some(type => type.includes('light'))).to.be.true;
      expect(deviceTypes.some(type => type.includes('speaker'))).to.be.true;
    });
  });

  describe('Mixed Language Commands', function() {
    it('should handle English commands with Swedish room names', function() {
      const command = 'Turn on vardagsrum lights';

      const result = processMultilingualCommand(command, 'auto');

      expect(result).to.have.property('rooms').that.is.not.empty;
      expect(result).to.have.property('actions').that.includes('turn_on');
      expect(result).to.have.property('deviceTypes').that.includes('light');
      expect(result).to.have.property('confidence').above(0.6);
    });

    it('should handle Swedish commands with English device names', function() {
      const command = 'Sätt på lights i köket';

      const result = processMultilingualCommand(command, 'sv');

      expect(result).to.have.property('actions').that.includes('turn_on');
      expect(result).to.have.property('deviceTypes').that.includes('light');
      expect(result).to.have.property('confidence').above(0.6);
    });

    it('should handle completely mixed language commands', function() {
      const command = 'Allumer ljus kök'; // French + Swedish + Swedish

      const result = processMultilingualCommand(command, 'fr');

      expect(result).to.have.property('actions').that.includes('turn_on');
      expect(result).to.have.property('deviceTypes').that.includes('light');
      expect(result).to.have.property('rooms').that.is.not.empty;
    });
  });

  describe('Device Type Filtering', function() {
    it('should filter to lights when lights are mentioned', function() {
      const commands = [
        'Turn on lights in living room',
        'Sätt på ljus i vardagsrummet',
        'Allumer les lumières du salon',
        'Licht einschalten im Wohnzimmer'
      ];

      commands.forEach(command => {
        const result = processMultilingualCommand(command, 'auto');
        expect(result.deviceTypes).to.include('light');
      });
    });

    it('should distinguish between device types correctly', function() {
      const testCases = [
        { command: 'Turn on speakers in kitchen', expectedType: 'speaker' },
        { command: 'Lock the door', expectedType: 'lock' },
        { command: 'Set temperature to 22', expectedType: 'thermostat' },
        { command: 'Turn on socket in bedroom', expectedType: 'socket' }
      ];

      testCases.forEach(testCase => {
        const result = processMultilingualCommand(testCase.command, 'en');
        expect(result.deviceTypes).to.include(testCase.expectedType);
      });
    });

    it('should handle generic room commands appropriately', function() {
      const command = 'Turn on living room';

      const result = processMultilingualCommand(command, 'en');

      expect(result).to.have.property('rooms').that.includes('living room');
      expect(result).to.have.property('actions').that.includes('turn_on');
      // Should prefer lights for generic room commands
      expect(result.deviceTypes).to.include('light');
    });
  });

  describe('Command Preprocessing', function() {
    it('should improve command clarity through preprocessing', function() {
      const commands = [
        'Please turn on the living room lights',
        'Could you dim bedroom lamp to 50%',
        'I would like to set temperature to 22 degrees'
      ];

      commands.forEach(command => {
        const processed = preprocessCommand(command);

        expect(processed).to.have.property('processed').that.is.a('string');
        expect(processed).to.have.property('intent').that.is.a('string');
        expect(processed).to.have.property('confidence').above(0.5);
        expect(processed).to.have.property('entities');

        // Processed command should be cleaner
        expect(processed.processed.length).to.be.at.most(command.length);
        expect(processed.processed).to.not.include('please');
        expect(processed.processed).to.not.include('could you');
      });
    });

    it('should handle typos and spelling errors', function() {
      const typoCommands = [
        'turn on the ligt in the livingroom',
        'dim bedrrom lights to 50%',
        'set temprature to 22 degres'
      ];

      typoCommands.forEach(command => {
        const processed = preprocessCommand(command);

        expect(processed).to.have.property('confidence').above(0.4);
        expect(processed.entities.rooms).to.not.be.empty;
        expect(processed.entities.deviceTypes).to.not.be.empty;
      });
    });

    it('should suggest improvements for unclear commands', function() {
      const unclearCommands = [
        'lights',
        'bedroom',
        'on'
      ];

      unclearCommands.forEach(command => {
        const processed = preprocessCommand(command);

        if (processed.confidence < 0.6) {
          expect(processed).to.have.property('suggestion').that.is.a('string');
          expect(processed.suggestion.length).to.be.above(0);
        }
      });
    });
  });

  describe('Performance and Scalability', function() {
    it('should process commands efficiently', function() {
      const commands = TestDataGenerators.generateMultilingualCommands('en');

      const startTime = Date.now();

      commands.forEach(command => {
        processMultilingualCommand(command, 'en');
      });

      const endTime = Date.now();
      const avgTime = (endTime - startTime) / commands.length;

      expect(avgTime).to.be.below(100); // Should process each command in under 100ms
    });

    it('should handle concurrent command processing', async function() {
      const commands = [
        'Turn on kitchen lights',
        'Dim bedroom to 50%',
        'Play music in living room',
        'Set temperature to 22',
        'Lock the door'
      ];

      const promises = commands.map(command => Promise.resolve(processMultilingualCommand(command, 'en')));

      const results = await Promise.all(promises);

      results.forEach(result => {
        expect(result).to.have.property('confidence').above(0.5);
        expect(result).to.have.property('actions').that.is.not.empty;
      });
    });

    it('should handle very long commands', function() {
      const longCommand = 'Could you please turn on all the lighting devices that are currently installed in the living room area and also please start playing some relaxing background music on the speakers that are located in the same room';

      const result = processMultilingualCommand(longCommand, 'en');

      expect(result).to.have.property('rooms').that.includes('living room');
      expect(result).to.have.property('actions').that.is.not.empty;
      expect(result).to.have.property('deviceTypes').that.is.not.empty;
      expect(result.confidence).to.be.above(0.6);
    });
  });

  describe('Error Handling and Edge Cases', function() {
    it('should handle empty commands gracefully', function() {
      const result = processMultilingualCommand('', 'en');

      expect(result).to.have.property('rooms').that.is.empty;
      expect(result).to.have.property('actions').that.is.empty;
      expect(result).to.have.property('deviceTypes').that.is.empty;
      expect(result).to.have.property('confidence', 0);
    });

    it('should handle unknown languages', function() {
      const result = processMultilingualCommand('Turn on lights', 'unknown');

      expect(result).to.have.property('language', 'unknown');
      expect(result).to.have.property('confidence').above(0);
    });

    it('should handle commands with no recognizable elements', function() {
      const nonsenseCommand = 'asdfghjkl qwertyuiop';

      const result = processMultilingualCommand(nonsenseCommand, 'en');

      expect(result).to.have.property('confidence', 0);
      expect(result).to.have.property('rooms').that.is.empty;
      expect(result).to.have.property('actions').that.is.empty;
    });

    it('should handle special characters and emojis', function() {
      const specialCommand = '💡 Turn on lights! 🏠 @home #automation';

      const result = processMultilingualCommand(specialCommand, 'en');

      expect(result).to.have.property('actions').that.includes('turn_on');
      expect(result).to.have.property('deviceTypes').that.includes('light');
      expect(result.confidence).to.be.above(0.6);
    });
  });
});
