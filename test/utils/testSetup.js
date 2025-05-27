'use strict';

/**
 * Test Setup and Configuration
 * Provides common test utilities, mocks, and configuration for all tests
 */

const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const sinon = require('sinon');

// Configure Chai
chai.use(chaiAsPromised);
const { expect } = chai;

// Global test configuration
const TEST_CONFIG = {
  timeout: {
    unit: 5000,
    integration: 15000,
    performance: 30000
  },
  languages: ['en', 'sv', 'fr', 'de', 'es', 'it', 'pt', 'nl'],
  deviceClasses: ['light', 'speaker', 'thermostat', 'lock', 'sensor', 'camera', 'socket'],
  rooms: ['living room', 'bedroom', 'kitchen', 'bathroom', 'office', 'garden']
};

// Test utilities
const TestUtils = {
  /**
   * Create a delay for async testing
   * @param {number} ms - Milliseconds to delay
   * @returns {Promise}
   */
  delay: ms => new Promise(resolve => setTimeout(resolve, ms)),

  /**
   * Generate random test data
   * @param {string} type - Type of data to generate
   * @returns {*} Generated data
   */
  generateTestData: type => {
    switch (type) {
      case 'deviceId':
        return `device_${Math.random().toString(36).substr(2, 9)}`;
      case 'zoneId':
        return `zone_${Math.random().toString(36).substr(2, 9)}`;
      case 'command':
        return ['turn_on', 'turn_off', 'dim', 'set_temperature'][Math.floor(Math.random() * 4)];
      case 'room':
        return TEST_CONFIG.rooms[Math.floor(Math.random() * TEST_CONFIG.rooms.length)];
      case 'deviceClass':
        return TEST_CONFIG.deviceClasses[Math.floor(Math.random() * TEST_CONFIG.deviceClasses.length)];
      default:
        return null;
    }
  },

  /**
   * Validate test result structure
   * @param {object} result - Result to validate
   * @param {object} schema - Expected schema
   * @returns {boolean} True if valid
   */
  validateSchema: (result, schema) => {
    for (const [key, type] of Object.entries(schema)) {
      if (!(key in result)) return false;
      if (typeof result[key] !== type) return false;
    }
    return true;
  },

  /**
   * Create a test spy with default behavior
   * @param {string} name - Spy name
   * @param {*} defaultReturn - Default return value
   * @returns {sinon.SinonSpy}
   */
  createSpy: (name, defaultReturn = null) => {
    const spy = sinon.spy();
    spy.displayName = name;
    if (defaultReturn !== null) {
      spy.returns(defaultReturn);
    }
    return spy;
  },

  /**
   * Create a test stub with configurable behavior
   * @param {object} methods - Methods to stub
   * @returns {object} Stubbed object
   */
  createStub: methods => {
    const stub = {};
    for (const [method, behavior] of Object.entries(methods)) {
      if (typeof behavior === 'function') {
        stub[method] = sinon.stub().callsFake(behavior);
      } else {
        stub[method] = sinon.stub().returns(behavior);
      }
    }
    return stub;
  }
};

// Test data generators
const TestDataGenerators = {
  /**
   * Generate multilingual test commands
   * @param {string} language - Language code
   * @returns {Array} Array of test commands
   */
  generateMultilingualCommands: language => {
    const commands = {
      en: [
        'Turn on the living room lights',
        'Dim bedroom lights to 50%',
        'Set temperature to 22 degrees',
        'Play music in kitchen',
        'Lock the front door'
      ],
      sv: [
        'Sätt på vardagsrummet ljus',
        'Dimma sovrum ljus till 50%',
        'Sätt temperaturen till 22 grader',
        'Spela musik i köket',
        'Lås ytterdörren'
      ],
      fr: [
        'Allumer les lumières du salon',
        'Tamiser les lumières de la chambre à 50%',
        'Régler la température à 22 degrés',
        'Jouer de la musique dans la cuisine',
        'Verrouiller la porte d\'entrée'
      ],
      de: [
        'Wohnzimmer Licht einschalten',
        'Schlafzimmer Licht auf 50% dimmen',
        'Temperatur auf 22 Grad einstellen',
        'Musik in der Küche abspielen',
        'Haustür verriegeln'
      ],
      es: [
        'Encender las luces de la sala',
        'Atenuar las luces del dormitorio al 50%',
        'Establecer temperatura a 22 grados',
        'Reproducir música en la cocina',
        'Cerrar la puerta principal'
      ]
    };
    return commands[language] || commands.en;
  },

  /**
   * Generate status query test cases
   * @param {string} language - Language code
   * @returns {Array} Array of status queries
   */
  generateStatusQueries: language => {
    const queries = {
      en: [
        'What\'s the status of kitchen lights?',
        'Show me all devices in bedroom',
        'How are the thermostats?',
        'Tell me about living room'
      ],
      sv: [
        'Vad är status på kök ljus?',
        'Visa alla enheter i sovrum',
        'Hur är termostaterna?',
        'Berätta om vardagsrummet'
      ],
      fr: [
        'Quel est l\'état des lumières de cuisine?',
        'Montrez-moi tous les appareils dans la chambre',
        'Comment vont les thermostats?',
        'Parlez-moi du salon'
      ]
    };
    return queries[language] || queries.en;
  }
};

module.exports = {
  expect,
  sinon,
  TEST_CONFIG,
  TestUtils,
  TestDataGenerators
};
