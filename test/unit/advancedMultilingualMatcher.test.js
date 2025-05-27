'use strict';

/**
 * Unit Tests for Advanced Multilingual Matcher
 * Tests fuzzy matching, LLM integration, and multilingual room matching
 */

const { expect, sinon, TEST_CONFIG } = require('../utils/testSetup');
const { createMockLLMFunction } = require('../utils/mockHomeyAPI');
const {
  levenshteinDistance,
  calculateSimilarity,
  normalizeUnicode,
  removeDefiniteArticles,
  generatePhoneticVariations,
  fuzzyMatch,
  findBestRoomMatch,
  comprehensiveRoomMatch
} = require('../../modules/advancedMultilingualMatcher');

describe('Advanced Multilingual Matcher', function() {
  this.timeout(TEST_CONFIG.timeout.unit);

  let mockLLMFunction;

  beforeEach(function() {
    mockLLMFunction = createMockLLMFunction();
  });

  afterEach(function() {
    sinon.restore();
  });

  describe('String Distance and Similarity', function() {
    it('should calculate Levenshtein distance correctly', function() {
      expect(levenshteinDistance('cat', 'bat')).to.equal(1);
      expect(levenshteinDistance('kitten', 'sitting')).to.equal(3);
      expect(levenshteinDistance('', 'abc')).to.equal(3);
      expect(levenshteinDistance('abc', '')).to.equal(3);
      expect(levenshteinDistance('same', 'same')).to.equal(0);
    });

    it('should calculate similarity scores correctly', function() {
      expect(calculateSimilarity('cat', 'cat')).to.equal(1.0);
      expect(calculateSimilarity('cat', 'bat')).to.be.closeTo(0.67, 0.1);
      expect(calculateSimilarity('', 'abc')).to.equal(0.0);
      expect(calculateSimilarity('completely', 'different')).to.be.below(0.3);
    });
  });

  describe('Unicode Normalization', function() {
    it('should normalize Swedish characters', function() {
      expect(normalizeUnicode('trädgården')).to.equal('tradgarden');
      expect(normalizeUnicode('kök')).to.equal('kok');
      expect(normalizeUnicode('vardagsrummet')).to.equal('vardagsrummet');
    });

    it('should normalize French characters', function() {
      expect(normalizeUnicode('café')).to.equal('cafe');
      expect(normalizeUnicode('naïve')).to.equal('naive');
      expect(normalizeUnicode('résumé')).to.equal('resume');
    });

    it('should normalize German characters', function() {
      expect(normalizeUnicode('müller')).to.equal('muller');
      expect(normalizeUnicode('weiß')).to.equal('weiss');
      expect(normalizeUnicode('größe')).to.equal('grosse');
    });

    it('should handle mixed character sets', function() {
      expect(normalizeUnicode('café-kök')).to.equal('cafe-kok');
      expect(normalizeUnicode('naïve_trädgård')).to.equal('naive_tradgard');
    });
  });

  describe('Definite Article Removal', function() {
    it('should remove English definite articles', function() {
      expect(removeDefiniteArticles('the kitchen', 'en')).to.equal('kitchen');
      expect(removeDefiniteArticles('the living room', 'en')).to.equal('living room');
      expect(removeDefiniteArticles('kitchen', 'en')).to.equal('kitchen');
    });

    it('should remove Swedish definite articles', function() {
      expect(removeDefiniteArticles('vardagsrummet', 'sv')).to.equal('vardagsrum');
      expect(removeDefiniteArticles('köket', 'sv')).to.equal('kök');
      expect(removeDefiniteArticles('sovrummet', 'sv')).to.equal('sovrum');
    });

    it('should remove French definite articles', function() {
      expect(removeDefiniteArticles('la cuisine', 'fr')).to.equal('cuisine');
      expect(removeDefiniteArticles('le salon', 'fr')).to.equal('salon');
      expect(removeDefiniteArticles('les chambres', 'fr')).to.equal('chambres');
    });

    it('should remove German definite articles', function() {
      expect(removeDefiniteArticles('die Küche', 'de')).to.equal('Küche');
      expect(removeDefiniteArticles('das Wohnzimmer', 'de')).to.equal('Wohnzimmer');
      expect(removeDefiniteArticles('der Garten', 'de')).to.equal('Garten');
    });

    it('should handle unknown languages gracefully', function() {
      expect(removeDefiniteArticles('the kitchen', 'unknown')).to.equal('kitchen');
      expect(removeDefiniteArticles('vardagsrummet', 'unknown')).to.equal('vardagsrummet');
    });
  });

  describe('Phonetic Variations', function() {
    it('should generate phonetic variations for common words', function() {
      const variations = generatePhoneticVariations('kitchen');
      expect(variations).to.include('kitchen');
      expect(variations).to.include('kithen'); // Common typo
      expect(variations).to.include('kichen'); // Another typo
    });

    it('should generate variations for Swedish words', function() {
      const variations = generatePhoneticVariations('vardagsrum');
      expect(variations).to.include('vardagsrum');
      expect(variations).to.include('vardagsrumm'); // Double m
      expect(variations).to.include('vardagsrom'); // o instead of u
    });

    it('should handle short words', function() {
      const variations = generatePhoneticVariations('kök');
      expect(variations).to.include('kök');
      expect(variations.length).to.be.above(1);
    });

    it('should handle empty input', function() {
      const variations = generatePhoneticVariations('');
      expect(variations).to.deep.equal(['']);
    });
  });

  describe('Fuzzy Matching', function() {
    const candidates = ['Kitchen', 'Living Room', 'Bedroom', 'Vardagsrummet', 'Trägården'];

    it('should find exact matches with high confidence', function() {
      const result = fuzzyMatch('Kitchen', candidates, 'en');

      expect(result).to.have.property('match', 'Kitchen');
      expect(result).to.have.property('confidence', 1.0);
      expect(result).to.have.property('method', 'exact');
    });

    it('should find close matches with good confidence', function() {
      const result = fuzzyMatch('kithen', candidates, 'en'); // Typo

      expect(result).to.have.property('match', 'Kitchen');
      expect(result).to.have.property('confidence').above(0.8);
      expect(result).to.have.property('method', 'similarity');
    });

    it('should handle Swedish room names', function() {
      const result = fuzzyMatch('vardagsrum', candidates, 'sv');

      expect(result).to.have.property('match', 'Vardagsrummet');
      expect(result).to.have.property('confidence').above(0.7);
    });

    it('should handle character variations', function() {
      const result = fuzzyMatch('tradgarden', candidates, 'sv');

      expect(result).to.have.property('match', 'Trägården');
      expect(result).to.have.property('confidence').above(0.6);
    });

    it('should return null for no good matches', function() {
      const result = fuzzyMatch('completely_different', candidates, 'en');

      expect(result).to.have.property('match', null);
      expect(result).to.have.property('confidence', 0);
    });

    it('should handle empty candidates', function() {
      const result = fuzzyMatch('kitchen', [], 'en');

      expect(result).to.have.property('match', null);
      expect(result).to.have.property('confidence', 0);
      expect(result).to.have.property('method', 'none');
    });

    it('should handle empty input', function() {
      const result = fuzzyMatch('', candidates, 'en');

      expect(result).to.have.property('match', null);
      expect(result).to.have.property('confidence', 0);
    });
  });

  describe('Room Matching', function() {
    const availableRooms = ['Kitchen', 'Living Room', 'Bedroom', 'Vardagsrummet', 'Trägården'];

    it('should find best room match with exact name', function() {
      const result = findBestRoomMatch('Kitchen', availableRooms, 'en');

      expect(result).to.have.property('match', 'Kitchen');
      expect(result).to.have.property('confidence', 1.0);
      expect(result).to.have.property('method', 'exact');
    });

    it('should find best room match with fuzzy matching', function() {
      const result = findBestRoomMatch('kithen', availableRooms, 'en');

      expect(result).to.have.property('match', 'Kitchen');
      expect(result).to.have.property('confidence').above(0.8);
    });

    it('should handle Swedish room names with definite articles', function() {
      const result = findBestRoomMatch('vardagsrummet', availableRooms, 'sv');

      expect(result).to.have.property('match', 'Vardagsrummet');
      expect(result).to.have.property('confidence').above(0.9);
    });

    it('should handle character variations in Swedish', function() {
      const result = findBestRoomMatch('tradgarden', availableRooms, 'sv');

      expect(result).to.have.property('match', 'Trägården');
      expect(result).to.have.property('confidence').above(0.6);
    });
  });

  describe('Comprehensive Room Matching', function() {
    const availableRooms = ['Kitchen', 'Living Room', 'Bedroom', 'Vardagsrummet', 'Trägården'];

    it('should use fuzzy matching for high confidence matches', async function() {
      const result = await comprehensiveRoomMatch('Kitchen', availableRooms, 'en');

      expect(result).to.have.property('match', 'Kitchen');
      expect(result).to.have.property('confidence', 1.0);
      expect(result).to.have.property('method', 'exact');
    });

    it('should fall back to LLM for low confidence fuzzy matches', async function() {
      const result = await comprehensiveRoomMatch('living space', availableRooms, 'en', mockLLMFunction);

      expect(result).to.have.property('match');
      expect(result).to.have.property('confidence');
      expect(result).to.have.property('method');

      // Should have called the LLM function
      expect(mockLLMFunction.called).to.be.true;
    });

    it('should handle LLM function errors gracefully', async function() {
      const errorLLM = sinon.stub().rejects(new Error('LLM Error'));

      const result = await comprehensiveRoomMatch('some room', availableRooms, 'en', errorLLM);

      expect(result).to.have.property('match');
      expect(result).to.have.property('confidence');
      // Should fall back to fuzzy matching result
    });

    it('should work without LLM function', async function() {
      const result = await comprehensiveRoomMatch('Kitchen', availableRooms, 'en', null);

      expect(result).to.have.property('match', 'Kitchen');
      expect(result).to.have.property('confidence', 1.0);
    });

    it('should handle Swedish room matching with LLM fallback', async function() {
      const result = await comprehensiveRoomMatch('vardagsrummet', availableRooms, 'sv', mockLLMFunction);

      expect(result).to.have.property('match', 'Vardagsrummet');
      expect(result).to.have.property('confidence').above(0.8);
    });
  });

  describe('Performance and Edge Cases', function() {
    it('should handle very long room names', function() {
      const longName = 'a'.repeat(1000);
      const candidates = ['Kitchen', 'Bedroom'];

      const result = fuzzyMatch(longName, candidates, 'en');

      expect(result).to.have.property('match', null);
      expect(result).to.have.property('confidence', 0);
    });

    it('should handle special characters in room names', function() {
      const candidates = ['Kitchen & Dining', 'Living-Room', 'Bed/Room'];

      const result = fuzzyMatch('kitchen dining', candidates, 'en');

      expect(result).to.have.property('match', 'Kitchen & Dining');
      expect(result).to.have.property('confidence').above(0.6);
    });

    it('should handle numeric room names', function() {
      const candidates = ['Room 1', 'Room 2', 'Room 3'];

      const result = fuzzyMatch('room1', candidates, 'en');

      expect(result).to.have.property('match', 'Room 1');
      expect(result).to.have.property('confidence').above(0.7);
    });

    it('should be case insensitive', function() {
      const candidates = ['Kitchen', 'BEDROOM', 'living room'];

      const result = fuzzyMatch('KITCHEN', candidates, 'en');

      expect(result).to.have.property('match', 'Kitchen');
      expect(result).to.have.property('confidence', 1.0);
    });
  });
});
