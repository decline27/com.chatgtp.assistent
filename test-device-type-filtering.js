#!/usr/bin/env node

'use strict';

/**
 * Test Device Type Filtering Fix
 * Tests the fixed device type filtering for room-specific queries
 */

const { getDeviceTypeStatus } = require('./modules/deviceStatusRetriever');
const { handleStatusQuery } = require('./modules/statusQueryHandler');

// Mock home state with multiple lights in living room
const mockHomeState = {
  devices: {
    'living_light_1': {
      id: 'living_light_1',
      name: 'Living Room Main Light',
      class: 'light',
      zone: 'living_room_zone',
      capabilities: ['onoff', 'dim'],
      available: true,
      getCapabilityValue: async cap => {
        if (cap === 'onoff') return true;
        if (cap === 'dim') return 0.8;
        return null;
      }
    },
    'living_light_2': {
      id: 'living_light_2',
      name: 'Living Room Table Lamp',
      class: 'light',
      zone: 'living_room_zone',
      capabilities: ['onoff', 'dim'],
      available: true,
      getCapabilityValue: async cap => {
        if (cap === 'onoff') return false;
        if (cap === 'dim') return 0.0;
        return null;
      }
    },
    'living_light_3': {
      id: 'living_light_3',
      name: 'Living Room Floor Lamp',
      class: 'light',
      zone: 'living_room_zone',
      capabilities: ['onoff', 'dim'],
      available: true,
      getCapabilityValue: async cap => {
        if (cap === 'onoff') return true;
        if (cap === 'dim') return 0.6;
        return null;
      }
    },
    'living_camera': {
      id: 'living_camera',
      name: 'Living Room Camera',
      class: 'camera',
      zone: 'living_room_zone',
      capabilities: ['onoff'],
      available: false,
      getCapabilityValue: async cap => {
        if (cap === 'onoff') return false;
        return null;
      }
    },
    'kitchen_light': {
      id: 'kitchen_light',
      name: 'Kitchen Light',
      class: 'light',
      zone: 'kitchen_zone',
      capabilities: ['onoff', 'dim'],
      available: true,
      getCapabilityValue: async cap => {
        if (cap === 'onoff') return true;
        if (cap === 'dim') return 0.9;
        return null;
      }
    }
  },
  zones: {
    'living_room_zone': { id: 'living_room_zone', name: 'Living Room' },
    'kitchen_zone': { id: 'kitchen_zone', name: 'Kitchen' }
  }
};

// Mock LLM function
async function mockLLMFunction(prompt) {
  if (prompt.includes('"living room"') && prompt.includes('"Living Room"')) {
    return JSON.stringify({
      match: 'Living Room',
      confidence: 1.0,
      reasoning: 'Exact match'
    });
  }
  return JSON.stringify({
    match: null,
    confidence: 0.0,
    reasoning: 'No match'
  });
}

console.log('🔧 Testing Device Type Filtering Fix\n');

// Test 1: Direct device type status function
console.log('1. Testing getDeviceTypeStatus function directly:');
console.log('='.repeat(60));

(async () => {
  try {
    // Test: Get all lights in living room
    console.log('\nTest: Get all lights in Living Room');
    const result = await getDeviceTypeStatus(
      'light',
      mockHomeState.devices,
      mockHomeState.zones,
      'Living Room',
      'en',
      mockLLMFunction
    );

    console.log(`✅ Success: ${result.success}`);
    console.log(`Device Count: ${result.deviceCount}`);
    console.log(`Summary: ${result.summary}`);

    if (result.devices && result.devices.length > 0) {
      console.log('\nFound Devices:');
      result.devices.forEach(device => {
        console.log(`  • ${device.name} (${device.class}): ${device.summary}`);
      });
    }

    // Test 2: Get all lights (no room filter)
    console.log(`\n${'-'.repeat(40)}`);
    console.log('\nTest: Get all lights (no room filter)');
    const allLightsResult = await getDeviceTypeStatus(
      'light',
      mockHomeState.devices,
      mockHomeState.zones,
      null,
      'en',
      mockLLMFunction
    );

    console.log(`✅ Success: ${allLightsResult.success}`);
    console.log(`Device Count: ${allLightsResult.deviceCount}`);
    console.log(`Summary: ${allLightsResult.summary}`);

    // Test 3: Full status query processing
    console.log('\n\n2. Testing Full Status Query Processing:');
    console.log('='.repeat(60));

    const testQueries = [
      {
        query: 'är det någon ljus på i vardagsrummet?',
        language: 'sv',
        description: 'Swedish: Are there any lights on in living room?'
      },
      {
        query: 'What\'s the status of lights in living room?',
        language: 'en',
        description: 'English: Status of lights in living room'
      },
      {
        query: 'Show me all lights',
        language: 'en',
        description: 'English: All lights globally'
      }
    ];

    for (const test of testQueries) {
      console.log(`\nTest: ${test.description}`);
      console.log(`Query: "${test.query}"`);
      console.log('-'.repeat(40));

      try {
        const result = await handleStatusQuery(
          test.query,
          test.language,
          mockHomeState,
          mockLLMFunction,
          { includeDetails: true }
        );

        if (result.success) {
          console.log('✅ Success!');
          console.log(`Type: ${result.type}`);
          console.log(`Confidence: ${result.confidence?.toFixed(2) || 'N/A'}`);
          console.log('\nFormatted Response:');
          console.log(result.formattedText);
        } else {
          console.log('❌ Failed:');
          console.log(result.error);
        }
      } catch (error) {
        console.log('❌ Error:', error.message);
      }
    }

    console.log('\n✨ Device type filtering test completed!');

  } catch (error) {
    console.error('Test failed:', error);
  }
})();
