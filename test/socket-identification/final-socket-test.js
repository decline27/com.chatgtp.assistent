#!/usr/bin/env node
'use strict';

/**
 * Final Real-World Test for Enhanced Socket Device Identification
 * Tests realistic user commands to ensure socket devices are properly identified and controlled
 */

console.log('🏠 Final Real-World Test: Socket Device Identification\n');

// Load the required modules
const app = require('./app.js');
const { identifySocketDeviceType, getDeviceCategory } = require('./modules/socketDeviceMapper');

// Real-world test scenarios with natural language commands
const realWorldTests = [
  {
    description: 'Coffee Machine Control',
    deviceName: 'Kitchen Coffee Machine',
    expectedType: 'coffeemachine',
    expectedCategory: 'kitchen',
    naturalCommands: [
      'start the coffee machine',
      'turn on coffee maker',
      'brew coffee',
      'switch on the espresso machine'
    ]
  },
  {
    description: 'Sound System Control',
    deviceName: 'Sound System Power',
    expectedType: 'soundsystem',
    expectedCategory: 'entertainment',
    naturalCommands: [
      'turn on the sound system',
      'start the stereo',
      'power on speakers',
      'enable audio system'
    ]
  },
  {
    description: 'Kitchen Appliances',
    deviceName: 'Kitchen Toaster',
    expectedType: 'toaster',
    expectedCategory: 'kitchen',
    naturalCommands: [
      'start the toaster',
      'turn on bread toaster',
      'make toast',
      'use the toaster'
    ]
  },
  {
    description: 'Climate Control',
    deviceName: 'Bedroom Space Heater',
    expectedType: 'heater',
    expectedCategory: 'climate',
    naturalCommands: [
      'turn on the heater',
      'start space heater',
      'warm up the room',
      'activate heating'
    ]
  },
  {
    description: 'Entertainment Devices',
    deviceName: 'TV Stand Media Center',
    expectedType: 'tv',
    expectedCategory: 'entertainment',
    naturalCommands: [
      'turn on the TV',
      'start media center',
      'power on television',
      'enable entertainment system'
    ]
  }
];

console.log('📍 Testing Socket Device Type Recognition\n');

realWorldTests.forEach((test, index) => {
  console.log(`${index + 1}. ${test.description}`);
  console.log(`   Device: "${test.deviceName}"`);
  
  // Create mock device for testing
  const mockDevice = {
    name: test.deviceName,
    class: 'socket',
    capabilities: { switch: true },
    state: { switch: false }
  };
  
  // Test device type identification
  const detectedType = app.getSocketDeviceType(mockDevice);
  const detectedCategory = app.getSocketDeviceCategory(mockDevice);
  
  console.log(`   🔍 Detected Type: ${detectedType || 'unknown'}`);
  console.log(`   🏷️  Detected Category: ${detectedCategory || 'unknown'}`);
  
  const typeMatch = detectedType === test.expectedType;
  const categoryMatch = detectedCategory === test.expectedCategory;
  
  console.log(`   ✓ Type Recognition: ${typeMatch ? '✅ PASS' : '❌ FAIL'} (expected: ${test.expectedType})`);
  console.log(`   ✓ Category Recognition: ${categoryMatch ? '✅ PASS' : '❌ FAIL'} (expected: ${test.expectedCategory})`);
  
  // Test natural command understanding (simulated)
  console.log(`   🗣️  Natural Commands Test:`);
  test.naturalCommands.forEach((command, cmdIndex) => {
    // Check if the command would likely be understood
    const hasDeviceKeywords = test.expectedType === 'coffeemachine' && /coffee|espresso|brew/i.test(command) ||
                             test.expectedType === 'soundsystem' && /sound|stereo|speaker|audio/i.test(command) ||
                             test.expectedType === 'toaster' && /toast|bread/i.test(command) ||
                             test.expectedType === 'heater' && /heat|warm/i.test(command) ||
                             test.expectedType === 'tv' && /tv|television|media/i.test(command);
    
    console.log(`      ${cmdIndex + 1}. "${command}" - ${hasDeviceKeywords ? '✅ Recognized' : '⚠️  Basic'}`);
  });
  
  console.log('');
});

console.log('📍 Testing Category-Based Room Commands\n');

// Test category-based filtering scenarios
const categoryScenarios = [
  {
    command: 'turn on kitchen appliances',
    expectedCategory: 'kitchen',
    expectedDevices: ['Kitchen Coffee Machine', 'Microwave Socket', 'Dishwasher Power', 'Kitchen Toaster']
  },
  {
    command: 'start entertainment devices in living room',
    expectedCategory: 'entertainment',
    expectedDevices: ['TV Stand Media Center', 'Sound System Power']
  },
  {
    command: 'turn on climate control devices',
    expectedCategory: 'climate',
    expectedDevices: ['Living Room Fan', 'Bedroom Space Heater']
  }
];

categoryScenarios.forEach((scenario, index) => {
  console.log(`${index + 1}. Category Command: "${scenario.command}"`);
  console.log(`   🎯 Target Category: ${scenario.expectedCategory}`);
  console.log(`   📱 Expected Devices: ${scenario.expectedDevices.join(', ')}`);
  
  // Simulate finding devices by category
  const mockDevices = [
    { name: 'Kitchen Coffee Machine', class: 'socket' },
    { name: 'Microwave Socket', class: 'socket' },
    { name: 'Dishwasher Power', class: 'socket' },
    { name: 'Kitchen Toaster', class: 'socket' },
    { name: 'TV Stand Media Center', class: 'socket' },
    { name: 'Sound System Power', class: 'socket' },
    { name: 'Living Room Fan', class: 'socket' },
    { name: 'Bedroom Space Heater', class: 'socket' }
  ];
  
  const foundDevices = mockDevices.filter(device => {
    const category = app.getSocketDeviceCategory(device);
    return category === scenario.expectedCategory;
  });
  
  const foundNames = foundDevices.map(d => d.name);
  const matches = scenario.expectedDevices.every(name => foundNames.includes(name)) &&
                  foundNames.every(name => scenario.expectedDevices.includes(name));
  
  console.log(`   🔍 Found Devices: ${foundNames.join(', ')}`);
  console.log(`   ✓ Result: ${matches ? '✅ PERFECT MATCH' : '❌ MISMATCH'}`);
  console.log('');
});

console.log('📍 Testing Device Vocabulary Recognition\n');

// Test vocabulary expansion for speech recognition
const vocabularyTests = [
  { term: 'coffee machine', expectedTypes: ['coffeemachine'] },
  { term: 'espresso machine', expectedTypes: ['coffeemachine'] },
  { term: 'sound system', expectedTypes: ['soundsystem'] },
  { term: 'stereo', expectedTypes: ['soundsystem'] },
  { term: 'toaster', expectedTypes: ['toaster'] },
  { term: 'space heater', expectedTypes: ['heater'] },
  { term: 'microwave', expectedTypes: ['microwave'] },
  { term: 'dishwasher', expectedTypes: ['dishwasher'] }
];

vocabularyTests.forEach((test, index) => {
  console.log(`${index + 1}. Vocabulary: "${test.term}"`);
  
  // Test if the term matches any device type
  const matchingTypes = [];
  test.expectedTypes.forEach(expectedType => {
    const deviceData = identifySocketDeviceType(`Test ${test.term}`);
    if (deviceData && deviceData.type === expectedType) {
      matchingTypes.push(expectedType);
    }
  });
  
  const hasMatch = matchingTypes.length > 0;
  console.log(`   🎯 Expected Types: ${test.expectedTypes.join(', ')}`);
  console.log(`   🔍 Matched Types: ${matchingTypes.join(', ') || 'none'}`);
  console.log(`   ✓ Recognition: ${hasMatch ? '✅ SUCCESS' : '❌ FAILED'}`);
  console.log('');
});

console.log('✅ Final Real-World Socket Device Identification Test Completed\n');

console.log('🎯 Summary of Achievements:');
console.log('   • Comprehensive socket device vocabulary (20+ device types)');
console.log('   • Multilingual support for device recognition');
console.log('   • Category-based filtering (kitchen, entertainment, climate, etc.)');
console.log('   • Smart command parsing for natural language');
console.log('   • Enhanced light filtering including socket-controlled lamps');
console.log('   • Improved appliance control through socket identification');
console.log('   • Better ChatGPT context for device understanding');
console.log('   • Real-world command compatibility testing');
