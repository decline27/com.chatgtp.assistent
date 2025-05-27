'use strict';

/**
 * Integration Tests for Status Query Workflow
 * Tests complete end-to-end status query processing
 */

const { expect, TEST_CONFIG, TestDataGenerators } = require('../utils/testSetup');
const { createMockHomeState, createMockLLMFunction } = require('../utils/mockHomeyAPI');
const { handleStatusQuery } = require('../../modules/statusQueryHandler');

describe('Status Query Workflow Integration', function() {
  this.timeout(TEST_CONFIG.timeout.integration);

  let mockHomeState;
  let mockLLMFunction;

  beforeEach(function() {
    mockHomeState = createMockHomeState();
    mockLLMFunction = createMockLLMFunction();
  });

  describe('English Status Queries', function() {
    it('should handle kitchen lights status query end-to-end', async function() {
      const result = await handleStatusQuery(
        'What\'s the status of kitchen lights?',
        'en',
        mockHomeState,
        mockLLMFunction,
        { includeDetails: true, maxDevices: 10 }
      );

      expect(result).to.have.property('success', true);
      expect(result).to.have.property('type', 'device_type_status');
      expect(result).to.have.property('formattedText').that.is.a('string');
      expect(result.formattedText).to.include('Kitchen');
      expect(result.formattedText).to.include('light');
    });

    it('should handle room status query for bedroom', async function() {
      const result = await handleStatusQuery(
        'Show me all devices in bedroom',
        'en',
        mockHomeState,
        mockLLMFunction,
        { includeDetails: true }
      );

      expect(result).to.have.property('success', true);
      expect(result).to.have.property('type', 'room_status');
      expect(result.formattedText).to.include('Bedroom');
      expect(result.formattedText).to.include('device');
    });

    it('should handle global status query', async function() {
      const result = await handleStatusQuery(
        'Tell me about all devices',
        'en',
        mockHomeState,
        mockLLMFunction,
        { includeDetails: false, maxDevices: 5 }
      );

      expect(result).to.have.property('success', true);
      expect(result).to.have.property('type', 'global_status');
      expect(result.formattedText).to.include('device');
    });
  });

  describe('Swedish Status Queries', function() {
    it('should handle Swedish room status with character variations', async function() {
      const result = await handleStatusQuery(
        'Visa enheter i trädgården',
        'sv',
        mockHomeState,
        mockLLMFunction,
        { includeDetails: true }
      );

      expect(result).to.have.property('success', true);
      expect(result).to.have.property('type', 'room_status');
      expect(result.formattedText).to.include('Trägården');
    });

    it('should handle Swedish device type query', async function() {
      const result = await handleStatusQuery(
        'Hur är ljuset i köket?',
        'sv',
        mockHomeState,
        mockLLMFunction
      );

      expect(result).to.have.property('success', true);
      expect(result.formattedText).to.include('ljus');
    });

    it('should handle Swedish room with definite article', async function() {
      const result = await handleStatusQuery(
        'Vad är status på vardagsrummet?',
        'sv',
        mockHomeState,
        mockLLMFunction
      );

      expect(result).to.have.property('success', true);
      expect(result.formattedText).to.include('Vardagsrummet');
    });
  });

  describe('Multilingual Support', function() {
    TEST_CONFIG.languages.slice(0, 5).forEach(language => {
      it(`should handle ${language} status queries`, async function() {
        const queries = TestDataGenerators.generateStatusQueries(language);
        
        for (const query of queries) {
          const result = await handleStatusQuery(
            query,
            language,
            mockHomeState,
            mockLLMFunction
          );

          expect(result).to.have.property('success');
          if (result.success) {
            expect(result).to.have.property('formattedText').that.is.a('string');
            expect(result.formattedText.length).to.be.above(0);
          }
        }
      });
    });
  });

  describe('Error Handling', function() {
    it('should handle non-existent room gracefully', async function() {
      const result = await handleStatusQuery(
        'Show me devices in nonexistent room',
        'en',
        mockHomeState,
        mockLLMFunction
      );

      expect(result).to.have.property('success', false);
      expect(result).to.have.property('error').that.includes('not found');
    });

    it('should handle malformed queries', async function() {
      const result = await handleStatusQuery(
        'asdfghjkl',
        'en',
        mockHomeState,
        mockLLMFunction
      );

      expect(result).to.have.property('success', false);
      expect(result).to.have.property('error');
    });

    it('should handle empty home state', async function() {
      const emptyHomeState = { devices: {}, zones: {} };
      
      const result = await handleStatusQuery(
        'Show me all devices',
        'en',
        emptyHomeState,
        mockLLMFunction
      );

      expect(result).to.have.property('success', true);
      expect(result.formattedText).to.include('No devices');
    });

    it('should handle LLM function errors', async function() {
      const errorLLM = async () => {
        throw new Error('LLM Error');
      };

      const result = await handleStatusQuery(
        'Show me devices in vardagsrummet',
        'sv',
        mockHomeState,
        errorLLM
      );

      // Should still work with fuzzy matching fallback
      expect(result).to.have.property('success');
    });
  });

  describe('Performance and Limits', function() {
    it('should respect maxDevices limit', async function() {
      const result = await handleStatusQuery(
        'Show me all devices',
        'en',
        mockHomeState,
        mockLLMFunction,
        { maxDevices: 2 }
      );

      expect(result).to.have.property('success', true);
      // Should limit the number of devices shown
      const deviceCount = (result.formattedText.match(/•/g) || []).length;
      expect(deviceCount).to.be.at.most(2);
    });

    it('should handle large home states efficiently', async function() {
      // Create a large home state
      const largeHomeState = createMockHomeState();
      
      // Add many devices
      for (let i = 0; i < 50; i++) {
        largeHomeState.devices[`device_${i}`] = {
          id: `device_${i}`,
          name: `Device ${i}`,
          class: 'light',
          zone: 'kitchen_zone',
          available: true,
          capabilities: ['onoff'],
          capabilitiesObj: { onoff: { value: false } },
          getCapabilityValue: async () => false,
          setCapabilityValue: async () => true
        };
      }

      const startTime = Date.now();
      const result = await handleStatusQuery(
        'Show me all devices in kitchen',
        'en',
        largeHomeState,
        mockLLMFunction
      );
      const endTime = Date.now();

      expect(result).to.have.property('success', true);
      expect(endTime - startTime).to.be.below(5000); // Should complete within 5 seconds
    });

    it('should handle concurrent queries', async function() {
      const queries = [
        'Show me kitchen devices',
        'What\'s the status of bedroom?',
        'Tell me about living room',
        'How are the lights?'
      ];

      const promises = queries.map(query => 
        handleStatusQuery(query, 'en', mockHomeState, mockLLMFunction)
      );

      const results = await Promise.all(promises);

      results.forEach(result => {
        expect(result).to.have.property('success');
      });
    });
  });

  describe('Formatting and Localization', function() {
    it('should format English responses correctly', async function() {
      const result = await handleStatusQuery(
        'Show me kitchen devices',
        'en',
        mockHomeState,
        mockLLMFunction,
        { includeDetails: true }
      );

      expect(result.formattedText).to.include('Kitchen');
      expect(result.formattedText).to.include('device');
      expect(result.formattedText).to.match(/\d+ device/); // Should include device count
    });

    it('should format Swedish responses correctly', async function() {
      const result = await handleStatusQuery(
        'Visa kök enheter',
        'sv',
        mockHomeState,
        mockLLMFunction,
        { includeDetails: true }
      );

      expect(result.formattedText).to.include('Kitchen');
      expect(result.formattedText).to.include('enhet'); // Swedish for device
    });

    it('should include device details when requested', async function() {
      const result = await handleStatusQuery(
        'Show me kitchen lights',
        'en',
        mockHomeState,
        mockLLMFunction,
        { includeDetails: true }
      );

      expect(result.formattedText).to.include('💡'); // Light emoji
      expect(result.formattedText).to.match(/\d+%/); // Brightness percentage
    });

    it('should provide summary when details not requested', async function() {
      const result = await handleStatusQuery(
        'Show me kitchen lights',
        'en',
        mockHomeState,
        mockLLMFunction,
        { includeDetails: false }
      );

      expect(result.formattedText).to.not.include('💡');
      expect(result.formattedText).to.include('light');
    });
  });

  describe('Regression Tests', function() {
    it('should handle the Swedish kitchen light status bug', async function() {
      // This was a previously reported bug
      const result = await handleStatusQuery(
        'Vad är status på kök ljus?',
        'sv',
        mockHomeState,
        mockLLMFunction
      );

      expect(result).to.have.property('success', true);
      expect(result.formattedText).to.include('Kitchen');
      expect(result.formattedText).to.not.include('not found');
    });

    it('should handle character variations in Swedish room names', async function() {
      // Test the trädgården vs Trägården issue
      const result = await handleStatusQuery(
        'Visa enheter i trädgården',
        'sv',
        mockHomeState,
        mockLLMFunction
      );

      expect(result).to.have.property('success', true);
      expect(result.formattedText).to.include('Trägården');
    });

    it('should return all matching devices for device type queries', async function() {
      // Ensure we get all lights, not just one
      const result = await handleStatusQuery(
        'What\'s the status of lights?',
        'en',
        mockHomeState,
        mockLLMFunction
      );

      expect(result).to.have.property('success', true);
      // Should include multiple light devices
      const lightCount = (result.formattedText.match(/light/gi) || []).length;
      expect(lightCount).to.be.above(1);
    });
  });
});
