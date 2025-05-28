#!/usr/bin/env node

/**
 * Test script for the Unified Command Parser
 * Tests the new unified approach vs legacy approach
 */

'use strict';

const path = require('path');
const { parseCommandWithUnifiedMatching } = require('../modules/unifiedCommandParser');
const { parseCommandWithEnhancedMatching, parseCommandWithHybridApproach } = require('../modules/unifiedCommandIntegration');

// Mock home state for testing
const mockHomeState = {
  zones: {
    'zone1': { id: 'zone1', name: 'Living Room' },
    'zone2': { id: 'zone2', name: 'Kitchen' },
    'zone3': { id: 'zone3', name: 'Bedroom' },
    'zone4': { id: 'zone4', name: 'Bathroom' },
    'zone5': { id: 'zone5', name: 'Office' }
  },
  devices: {
    'device1': { 
      id: 'device1', 
      name: 'Living Room Light', 
      zoneName: 'Living Room',
      capabilities: ['onoff', 'dim']
    },
    'device2': { 
      id: 'device2', 
      name: 'Kitchen Light', 
      zoneName: 'Kitchen',
      capabilities: ['onoff']
    },
    'device3': { 
      id: 'device3', 
      name: 'Bedroom Lamp', 
      zoneName: 'Bedroom',
      capabilities: ['onoff', 'dim']
    }
  }
};

const testCommands = [
  {
    command: 'Turn on the lights in the living room',
    language: 'en',
    expected: { room: 'Living Room', command: 'turn_on', device_filter: 'light' }
  },
  {
    command: 'Encender las luces del salón',
    language: 'es',
    expected: { room: 'Living Room', command: 'turn_on', device_filter: 'light' }
  },
  {
    command: 'Allume les lumières de la cuisine',
    language: 'fr',
    expected: { room: 'Kitchen', command: 'turn_on', device_filter: 'light' }
  },
  {
    command: 'Turn on lights and play music in bedroom',
    language: 'en',
    expected: { commands: [
      { room: 'Bedroom', command: 'turn_on', device_filter: 'light' },
      { room: 'Bedroom', command: 'play_music', device_filter: 'speaker' }
    ]}
  },
  {
    command: 'Dim the living room lights to 50%',
    language: 'en',
    expected: { room: 'Living Room', command: 'dim', device_filter: 'light', parameters: { brightness: 50 } }
  }
];

async function testUnifiedParser() {
  console.log('🧪 Testing Unified Command Parser\n');
  console.log('=' .repeat(50));

  for (let i = 0; i < testCommands.length; i++) {
    const test = testCommands[i];
    console.log(`\nTest ${i + 1}: "${test.command}" (${test.language})`);
    console.log('-'.repeat(40));

    try {
      // Test unified parser directly
      console.log('🔄 Testing Unified Parser...');
      const unifiedResult = await parseCommandWithUnifiedMatching(
        test.command,
        Object.values(mockHomeState.zones).map(z => z.name),
        test.language,
        mockHomeState
      );

      if (unifiedResult.success) {
        console.log('✅ Unified Parser Success:');
        console.log('   Command:', JSON.stringify(unifiedResult.command, null, 4));
        if (unifiedResult.room_matching) {
          console.log('   Room Matching:', JSON.stringify(unifiedResult.room_matching, null, 4));
        }
      } else {
        console.log('❌ Unified Parser Failed:', unifiedResult.error);
      }

      // Test enhanced integration
      console.log('\n🔄 Testing Enhanced Integration...');
      const enhancedResult = await parseCommandWithEnhancedMatching(
        test.command,
        test.language,
        mockHomeState,
        {
          useUnifiedParsing: true,
          fallbackOnFailure: true
        }
      );

      if (!enhancedResult.error) {
        console.log('✅ Enhanced Integration Success:');
        console.log('   Result:', JSON.stringify(enhancedResult, null, 4));
      } else {
        console.log('❌ Enhanced Integration Failed:', enhancedResult.error);
      }

      // Test hybrid approach
      console.log('\n🔄 Testing Hybrid Approach...');
      const hybridResult = await parseCommandWithHybridApproach(
        test.command,
        test.language,
        mockHomeState
      );

      if (!hybridResult.error) {
        console.log('✅ Hybrid Approach Success:');
        console.log('   Result:', JSON.stringify(hybridResult, null, 4));
      } else {
        console.log('❌ Hybrid Approach Failed:', hybridResult.error);
      }

    } catch (error) {
      console.log('💥 Test Error:', error.message);
      console.error(error);
    }
  }
}

async function testRoomMatching() {
  console.log('\n\n🏠 Testing Room Matching Capabilities\n');
  console.log('=' .repeat(50));

  const roomTests = [
    { input: 'living room', expected: 'Living Room', language: 'en' },
    { input: 'salon', expected: 'Living Room', language: 'es' },
    { input: 'salle de séjour', expected: 'Living Room', language: 'fr' },
    { input: 'cocina', expected: 'Kitchen', language: 'es' },
    { input: 'cuisine', expected: 'Kitchen', language: 'fr' },
    { input: 'dormitorio', expected: 'Bedroom', language: 'es' },
    { input: 'chambre', expected: 'Bedroom', language: 'fr' },
    { input: 'oficina', expected: 'Office', language: 'es' }
  ];

  for (const test of roomTests) {
    console.log(`\nRoom Test: "${test.input}" (${test.language}) -> Expected: "${test.expected}"`);
    
    try {
      const result = await parseCommandWithUnifiedMatching(
        `Turn on lights in ${test.input}`,
        Object.values(mockHomeState.zones).map(z => z.name),
        test.language,
        mockHomeState
      );

      if (result.success && result.room_matching) {
        const matched = result.room_matching.matched || result.command?.room;
        if (matched === test.expected) {
          console.log(`✅ Correct match: "${test.input}" -> "${matched}"`);
          console.log(`   Method: ${result.room_matching.method}, Confidence: ${result.room_matching.confidence}`);
        } else {
          console.log(`❌ Incorrect match: "${test.input}" -> "${matched}" (expected "${test.expected}")`);
        }
      } else {
        console.log(`❌ Room matching failed: ${result.error}`);
      }
    } catch (error) {
      console.log(`💥 Room test error: ${error.message}`);
    }
  }
}

async function runAllTests() {
  try {
    // Initialize mock API key for testing
    process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-key';
    
    await testUnifiedParser();
    await testRoomMatching();
    
    console.log('\n\n🎉 All tests completed!');
    console.log('\nNote: These tests require a valid OpenAI API key to work properly.');
    console.log('Set OPENAI_API_KEY environment variable for live testing.');
    
  } catch (error) {
    console.error('Test suite error:', error);
    process.exit(1);
  }
}

// Run tests if called directly
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = {
  testUnifiedParser,
  testRoomMatching,
  runAllTests
};
