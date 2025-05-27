'use strict';

const { expect } = require('chai');
const sinon = require('sinon');

describe('Input Validation Security Fix', () => {
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

    // Mock preprocessCommand module
    const mockPreprocessCommand = sinon.stub().returns({
      processed: 'turn on lights',
      intent: 'control',
      confidence: 0.8,
      multilingualData: {}
    });

    // Mock the commandProcessor module
    require.cache[require.resolve('../../modules/commandProcessor')] = {
      exports: {
        preprocessCommand: mockPreprocessCommand,
        suggestImprovement: sinon.stub(),
        detectMultiCommand: sinon.stub(),
        parseMultiCommand: sinon.stub()
      }
    };

    // Mock the chatgptHelper module
    require.cache[require.resolve('../../modules/chatgptHelper')] = {
      exports: {
        constructPrompt: sinon.stub().returns('test prompt')
      }
    };

    // Mock chatgpt.parseCommand
    app.chatgpt = {
      parseCommand: sinon.stub().resolves({
        command: 'turn_on',
        room: 'Living Room'
      })
    };
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('parseCommandWithState Input Validation', () => {
    it('should reject null or undefined input', async () => {
      const result1 = await app.parseCommandWithState(null);
      const result2 = await app.parseCommandWithState(undefined);
      const result3 = await app.parseCommandWithState('');

      expect(result1.error).to.include('Invalid command text');
      expect(result2.error).to.include('Invalid command text');
      expect(result3.error).to.include('Invalid command text');
    });

    it('should reject non-string input', async () => {
      const result1 = await app.parseCommandWithState(123);
      const result2 = await app.parseCommandWithState({});
      const result3 = await app.parseCommandWithState([]);

      expect(result1.error).to.include('Invalid command text');
      expect(result2.error).to.include('Invalid command text');
      expect(result3.error).to.include('Invalid command text');
    });

    it('should reject commands that are too long', async () => {
      const longCommand = 'a'.repeat(1001);
      const result = await app.parseCommandWithState(longCommand);

      expect(result.error).to.include('Command text too long');
    });

    it('should reject commands with invalid characters', async () => {
      const maliciousCommands = [
        '<script>alert("xss")</script>',
        'turn on lights; rm -rf /',
        'command with \x00 null byte',
        'command with \x1b escape sequence'
      ];

      for (const command of maliciousCommands) {
        const result = await app.parseCommandWithState(command);
        expect(result.error).to.include('invalid characters');
      }
    });

    it('should reject commands with suspicious patterns', async () => {
      const suspiciousCommands = [
        'javascript:alert(1)',
        'turn on <script>alert(1)</script>',
        'eval(malicious_code)',
        'function() { return hack; }',
        'setTimeout(hack, 1000)',
        'setInterval(hack, 1000)'
      ];

      for (const command of suspiciousCommands) {
        const result = await app.parseCommandWithState(command);
        expect(result.error).to.include('potentially unsafe content');
      }
    });

    it('should accept valid commands with international characters', async () => {
      const validCommands = [
        'turn on lights in vardagsrum',
        'tänd lamporna i köket',
        'allume les lumières dans le salon',
        'schalte das Licht im Wohnzimmer ein',
        'enciende las luces en la sala',
        'turn on lights, please!'
      ];

      for (const command of validCommands) {
        const result = await app.parseCommandWithState(command);
        expect(result.error).to.be.undefined;
      }
    });

    it('should sanitize input by trimming and normalizing spaces', async () => {
      const messyCommand = '   turn    on     lights   ';
      await app.parseCommandWithState(messyCommand);

      // Verify that the sanitized command was used
      expect(app.lastProcessedCommand).to.equal('turn on lights');
    });

    it('should validate and default invalid languages', async () => {
      const command = 'turn on lights';
      await app.parseCommandWithState(command, 'invalid-lang');

      // Should log the invalid language and default to 'en'
      expect(app.log.calledWith(sinon.match(/Invalid language detected/))).to.be.true;
    });

    it('should accept valid language codes', async () => {
      const validLanguages = ['en', 'sv', 'fr', 'de', 'es', 'it', 'pt', 'nl', 'no', 'da', 'fi'];
      const command = 'turn on lights';

      for (const lang of validLanguages) {
        const result = await app.parseCommandWithState(command, lang);
        expect(result.error).to.be.undefined;
      }
    });

    it('should handle edge cases gracefully', async () => {
      const edgeCases = [
        'a', // Very short command
        'turn on lights'.repeat(10), // Repeated but valid content
        '123 456 789', // Numbers only
        'åäö ÅÄÖ éèê', // International characters only
        'Hello, world! How are you?' // With punctuation
      ];

      for (const command of edgeCases) {
        const result = await app.parseCommandWithState(command);
        if (command.length <= 1000) {
          expect(result.error).to.be.undefined;
        }
      }
    });
  });

  describe('Security Validation', () => {
    it('should prevent script injection attempts', async () => {
      const injectionAttempts = [
        'turn on <script src="evil.js"></script>',
        'lights javascript:void(0)',
        'eval("malicious code")',
        'turn on lights\'); DROP TABLE devices; --'
      ];

      for (const attempt of injectionAttempts) {
        const result = await app.parseCommandWithState(attempt);
        expect(result.error).to.exist;
      }
    });

    it('should handle unicode and special characters safely', async () => {
      const unicodeCommands = [
        'turn on lights 🏠',
        'tänd ljuset 💡',
        'lumière salon ✨'
      ];

      for (const command of unicodeCommands) {
        const result = await app.parseCommandWithState(command);
        // These should be rejected due to emoji characters
        expect(result.error).to.include('invalid characters');
      }
    });
  });
});
