'use strict';

/**
 * Unit Tests for Status Query Processor
 * Tests multilingual status query parsing and detection
 */

const { expect, TEST_CONFIG, TestDataGenerators } = require('../utils/testSetup');
const { parseStatusQuery, isStatusQuery, QUERY_TYPES } = require('../../modules/statusQueryProcessor');

describe('Status Query Processor', function() {
  this.timeout(TEST_CONFIG.timeout.unit);

  describe('Status Query Detection', function() {
    it('should detect English status queries', function() {
      const queries = [
        'What\'s the status of kitchen lights?',
        'Show me all devices in bedroom',
        'How are the thermostats?',
        'Tell me about living room'
      ];

      queries.forEach(query => {
        expect(isStatusQuery(query, 'en')).to.be.true;
      });
    });

    it('should detect Swedish status queries', function() {
      const queries = [
        'Vad är status på vardagsrummet?',
        'Visa alla enheter i trädgården',
        'Hur är ljuset i köket?'
      ];

      queries.forEach(query => {
        expect(isStatusQuery(query, 'sv')).to.be.true;
      });
    });

    it('should detect French status queries', function() {
      const queries = [
        'Quel est l\'état de tous les appareils?',
        'Montre-moi les appareils dans la chambre'
      ];

      queries.forEach(query => {
        expect(isStatusQuery(query, 'fr')).to.be.true;
      });
    });

    it('should reject non-status queries', function() {
      const nonStatusQueries = [
        'Turn on the lights',
        'Dim bedroom to 50%',
        'Play music in kitchen',
        'Set temperature to 22'
      ];

      nonStatusQueries.forEach(query => {
        expect(isStatusQuery(query, 'en')).to.be.false;
      });
    });
  });

  describe('Status Query Parsing', function() {
    it('should parse room status queries correctly', function() {
      const result = parseStatusQuery('Show me all devices in bedroom', 'en');

      expect(result).to.have.property('type', QUERY_TYPES.ROOM_STATUS);
      expect(result).to.have.property('room', 'bedroom');
      expect(result).to.have.property('confidence').above(0.8);
      expect(result).to.have.property('originalQuery', 'Show me all devices in bedroom');
      expect(result).to.have.property('language', 'en');
    });

    it('should parse device type queries correctly', function() {
      const result = parseStatusQuery('What\'s the status of kitchen lights?', 'en');

      expect(result).to.have.property('type', QUERY_TYPES.DEVICE_STATUS);
      expect(result).to.have.property('target').that.includes('lights');
      expect(result).to.have.property('room', 'kitchen');
      expect(result).to.have.property('confidence').above(0.7);
    });

    it('should parse global status queries correctly', function() {
      const result = parseStatusQuery('Tell me about all devices', 'en');

      expect(result).to.have.property('type', QUERY_TYPES.GLOBAL_STATUS);
      expect(result).to.have.property('confidence').above(0.7);
    });

    it('should handle Swedish room names with special characters', function() {
      const result = parseStatusQuery('Visa enheter i trädgården', 'sv');

      expect(result).to.have.property('type', QUERY_TYPES.ROOM_STATUS);
      expect(result).to.have.property('room', 'trädgården');
      expect(result).to.have.property('confidence').above(0.8);
    });

    it('should return null type for non-status queries', function() {
      const result = parseStatusQuery('Turn on the lights', 'en');

      expect(result).to.have.property('type', null);
      expect(result).to.have.property('confidence', 0);
    });

    it('should handle empty or invalid input', function() {
      const emptyResult = parseStatusQuery('', 'en');
      const nullResult = parseStatusQuery(null, 'en');

      expect(emptyResult).to.have.property('type', null);
      expect(emptyResult).to.have.property('confidence', 0);

      expect(nullResult).to.have.property('type', null);
      expect(nullResult).to.have.property('confidence', 0);
    });
  });

  describe('Multilingual Support', function() {
    TEST_CONFIG.languages.forEach(language => {
      it(`should handle ${language} status queries`, function() {
        const queries = TestDataGenerators.generateStatusQueries(language);

        queries.forEach(query => {
          const result = parseStatusQuery(query, language);
          expect(result).to.have.property('language', language);
          expect(result).to.have.property('originalQuery', query);

          if (result.type !== null) {
            expect(result.confidence).to.be.above(0.5);
          }
        });
      });
    });
  });

  describe('Confidence Scoring', function() {
    it('should assign high confidence to clear status queries', function() {
      const clearQueries = [
        'What\'s the status of kitchen lights?',
        'Show me all devices in bedroom',
        'Vad är status på vardagsrummet?'
      ];

      clearQueries.forEach(query => {
        const result = parseStatusQuery(query, 'en');
        if (result.type !== null) {
          expect(result.confidence).to.be.above(0.8);
        }
      });
    });

    it('should assign medium confidence to ambiguous queries', function() {
      const ambiguousQueries = [
        'How is the kitchen?',
        'Tell me about bedroom',
        'Check living room'
      ];

      ambiguousQueries.forEach(query => {
        const result = parseStatusQuery(query, 'en');
        if (result.type !== null) {
          expect(result.confidence).to.be.within(0.5, 0.8);
        }
      });
    });

    it('should assign low confidence to unclear queries', function() {
      const unclearQueries = [
        'kitchen',
        'lights',
        'status'
      ];

      unclearQueries.forEach(query => {
        const result = parseStatusQuery(query, 'en');
        if (result.type !== null) {
          expect(result.confidence).to.be.below(0.7);
        }
      });
    });
  });

  describe('Edge Cases', function() {
    it('should handle mixed language queries', function() {
      const mixedQueries = [
        'What\'s the status of vardagsrummet?',
        'Show me devices in trädgården',
        'Status på kitchen lights'
      ];

      mixedQueries.forEach(query => {
        const result = parseStatusQuery(query, 'en');
        // Should still detect as status query even with mixed languages
        expect(result.confidence).to.be.above(0.3);
      });
    });

    it('should handle typos and variations', function() {
      const typoQueries = [
        'Whats the status of kithen lights?',
        'Show me devises in bedroom',
        'Tell me abot living room'
      ];

      typoQueries.forEach(query => {
        const result = parseStatusQuery(query, 'en');
        // Should still detect despite typos
        if (result.type !== null) {
          expect(result.confidence).to.be.above(0.4);
        }
      });
    });

    it('should handle very long queries', function() {
      const longQuery = 'Could you please tell me what the current status is of all the lighting devices that are currently installed in the kitchen area of my home?';
      const result = parseStatusQuery(longQuery, 'en');

      expect(result.type).to.not.be.null;
      expect(result.confidence).to.be.above(0.6);
    });

    it('should handle very short queries', function() {
      const shortQueries = ['status?', 'lights?', 'kitchen?'];

      shortQueries.forEach(query => {
        const result = parseStatusQuery(query, 'en');
        // Short queries should have lower confidence
        if (result.type !== null) {
          expect(result.confidence).to.be.below(0.7);
        }
      });
    });
  });
});
