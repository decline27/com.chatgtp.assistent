#!/usr/bin/env node

'use strict';

/**
 * Comprehensive Status Query Testing
 * Tests the new multilingual status query functionality
 */

const { parseStatusQuery, isStatusQuery } = require('./modules/statusQueryProcessor');
const { handleStatusQuery } = require('./modules/statusQueryHandler');
const { formatRoomStatus, formatDeviceTypeStatus } = require('./modules/statusFormatter');

// Mock home state for testing
const mockHomeState = {
  devices: {
    'light_1': {
      id: 'light_1',
      name: 'Kitchen Light',
      class: 'light',
      zone: 'kitchen_zone',
      capabilities: ['onoff', 'dim'],
      capabilitiesObj: {
        onoff: { value: true },
        dim: { value: 0.8 }
      },
      available: true,
      setCapabilityValue: async () => true,
      getCapabilityValue: async cap => {
        if (cap === 'onoff') return true;
        if (cap === 'dim') return 0.8;
        return null;
      }
    },
    'light_2': {
      id: 'light_2',
      name: 'Vardagsrum Lampa',
      class: 'light',
      zone: 'living_room_zone',
      capabilities: ['onoff', 'dim'],
      capabilitiesObj: {
        onoff: { value: false },
        dim: { value: 0.0 }
      },
      available: true,
      setCapabilityValue: async () => true,
      getCapabilityValue: async cap => {
        if (cap === 'onoff') return false;
        if (cap === 'dim') return 0.0;
        return null;
      }
    },
    'thermostat_1': {
      id: 'thermostat_1',
      name: 'Bedroom Thermostat',
      class: 'thermostat',
      zone: 'bedroom_zone',
      capabilities: ['target_temperature', 'measure_temperature'],
      capabilitiesObj: {
        target_temperature: { value: 22 },
        measure_temperature: { value: 21.5 }
      },
      available: true,
      setCapabilityValue: async () => true,
      getCapabilityValue: async cap => {
        if (cap === 'target_temperature') return 22;
        if (cap === 'measure_temperature') return 21.5;
        return null;
      }
    },
    'speaker_1': {
      id: 'speaker_1',
      name: 'Trägården Speaker',
      class: 'speaker',
      zone: 'garden_zone',
      capabilities: ['speaker_playing', 'volume_set'],
      capabilitiesObj: {
        speaker_playing: { value: true },
        volume_set: { value: 0.6 }
      },
      available: false, // Offline device
      setCapabilityValue: async () => true,
      getCapabilityValue: async cap => {
        if (cap === 'speaker_playing') return true;
        if (cap === 'volume_set') return 0.6;
        return null;
      }
    }
  },
  zones: {
    'kitchen_zone': { id: 'kitchen_zone', name: 'Kitchen' },
    'living_room_zone': { id: 'living_room_zone', name: 'Vardagsrummet' },
    'bedroom_zone': { id: 'bedroom_zone', name: 'Bedroom' },
    'garden_zone': { id: 'garden_zone', name: 'Trägården' }
  }
};

// Test cases for different languages and query types
const testCases = [
  // English status queries
  {
    query: 'What\'s the status of the kitchen lights?',
    language: 'en',
    description: 'English device type in room query'
  },
  {
    query: 'Show me all devices in the bedroom',
    language: 'en',
    description: 'English room status query'
  },
  {
    query: 'Is the thermostat on?',
    language: 'en',
    description: 'English device type query'
  },
  {
    query: 'Tell me about all devices',
    language: 'en',
    description: 'English global status query'
  },

  // Swedish status queries
  {
    query: 'Vad är status på vardagsrummet?',
    language: 'sv',
    description: 'Swedish room status query'
  },
  {
    query: 'Visa alla enheter i trädgården',
    language: 'sv',
    description: 'Swedish room status with character variations'
  },
  {
    query: 'Hur är ljuset i köket?',
    language: 'sv',
    description: 'Swedish device type in room query'
  },

  // French status queries
  {
    query: 'Quel est l\'état de tous les appareils?',
    language: 'fr',
    description: 'French global status query'
  },
  {
    query: 'Montre-moi les appareils dans la chambre',
    language: 'fr',
    description: 'French room status query'
  },

  // German status queries
  {
    query: 'Wie ist der Status der Lichter im Schlafzimmer?',
    language: 'de',
    description: 'German device type in room query'
  },

  // Spanish status queries
  {
    query: 'Muestra todos los dispositivos en la cocina',
    language: 'es',
    description: 'Spanish room status query'
  }
];

console.log('🔍 Testing Multilingual Status Query System\n');

// Test 1: Status Query Detection
console.log('1. Testing Status Query Detection:');
console.log('='.repeat(50));

testCases.forEach((testCase, index) => {
  const isStatus = isStatusQuery(testCase.query, testCase.language);
  const parsed = parseStatusQuery(testCase.query, testCase.language);

  console.log(`\nTest ${index + 1}: ${testCase.description}`);
  console.log(`Query: "${testCase.query}"`);
  console.log(`Detected as status query: ${isStatus ? '✅' : '❌'}`);
  console.log(`Parsed type: ${parsed.type || 'none'}`);
  console.log(`Confidence: ${parsed.confidence.toFixed(2)}`);
  if (parsed.room) console.log(`Room: ${parsed.room}`);
  if (parsed.target) console.log(`Target: ${parsed.target}`);
});

// Test 2: Status Query Processing
console.log('\n\n2. Testing Status Query Processing:');
console.log('='.repeat(50));

// Mock LLM function for testing
async function mockLLMFunction(prompt) {
  // Simple mock that handles basic semantic matching
  if (prompt.includes('"kitchen"') && prompt.includes('"Kitchen"')) {
    return JSON.stringify({
      match: 'Kitchen',
      confidence: 0.9,
      reasoning: 'Exact match'
    });
  }

  if (prompt.includes('"vardagsrummet"') && prompt.includes('"Vardagsrummet"')) {
    return JSON.stringify({
      match: 'Vardagsrummet',
      confidence: 0.95,
      reasoning: 'Exact match with Swedish room name'
    });
  }

  if (prompt.includes('"trädgården"') && prompt.includes('"Trägården"')) {
    return JSON.stringify({
      match: 'Trägården',
      confidence: 0.87,
      reasoning: 'Character variation match'
    });
  }

  if (prompt.includes('"bedroom"') && prompt.includes('"Bedroom"')) {
    return JSON.stringify({
      match: 'Bedroom',
      confidence: 0.9,
      reasoning: 'Exact match'
    });
  }

  return JSON.stringify({
    match: null,
    confidence: 0.0,
    reasoning: 'No match found'
  });
}

// Test specific status queries
const processingTests = [
  {
    query: 'What\'s the status of kitchen lights?',
    language: 'en'
  },
  {
    query: 'Show me all devices in vardagsrummet',
    language: 'sv'
  },
  {
    query: 'Visa enheter i trädgården',
    language: 'sv'
  },
  {
    query: 'Tell me about all devices',
    language: 'en'
  }
];

(async () => {
  for (const test of processingTests) {
    console.log(`\nProcessing: "${test.query}" (${test.language})`);
    console.log('-'.repeat(40));

    try {
      const result = await handleStatusQuery(
        test.query,
        test.language,
        mockHomeState,
        mockLLMFunction,
        { includeDetails: true, maxDevices: 10 }
      );

      if (result.success) {
        console.log('✅ Success!');
        console.log(`Type: ${result.type}`);
        console.log(`Confidence: ${result.confidence?.toFixed(2) || 'N/A'}`);
        console.log('\nFormatted Output:');
        console.log(result.formattedText);
      } else {
        console.log('❌ Failed:');
        console.log(result.error);
      }
    } catch (error) {
      console.log('❌ Error:', error.message);
    }
  }

  console.log('\n\n3. Testing Status Formatting:');
  console.log('='.repeat(50));

  // Test status formatting directly
  const mockRoomStatus = {
    success: true,
    roomName: 'kitchen',
    matchedRoom: 'Kitchen',
    deviceCount: 1,
    devices: [
      {
        id: 'light_1',
        name: 'Kitchen Light',
        class: 'light',
        summary: '💡 On, 80% brightness',
        isOnline: true
      }
    ],
    matchConfidence: 0.9,
    matchMethod: 'exact'
  };

  console.log('\nEnglish formatting:');
  console.log(formatRoomStatus(mockRoomStatus, 'en', true));

  console.log('\nSwedish formatting:');
  console.log(formatRoomStatus(mockRoomStatus, 'sv', true));

  console.log('\nFrench formatting:');
  console.log(formatRoomStatus(mockRoomStatus, 'fr', true));

  console.log('\n✨ Status query testing completed!');
})();
