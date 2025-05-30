#!/usr/bin/env node
'use strict';

/**
 * Integration Test for Enhanced Socket Device Identification
 * Tests the complete flow from command to device filtering with real socket device types
 */

console.log('🏠 Integration Test: Enhanced Socket Device Identification\n');

// Load the required modules
const app = require('./app.js');
const { identifySocketDeviceType, getDeviceCategory } = require('./modules/socketDeviceMapper');

// Mock devices representing a realistic smart home setup
const mockDevices = [
  // Living Room
  { id: 'lr_light1', name: 'Living Room Ceiling Light', class: 'light', zone: 'living_room', capabilities: { dim: true }, state: { dim: 0.8 } },
  { id: 'lr_socket1', name: 'Living Room Table Lamp', class: 'socket', zone: 'living_room', capabilities: { switch: true }, state: { switch: true } },
  { id: 'lr_socket2', name: 'TV Stand Media Center', class: 'socket', zone: 'living_room', capabilities: { switch: true }, state: { switch: true } },
  { id: 'lr_socket3', name: 'Sound System Power', class: 'socket', zone: 'living_room', capabilities: { switch: true }, state: { switch: false } },
  { id: 'lr_socket4', name: 'Living Room Fan', class: 'socket', zone: 'living_room', capabilities: { switch: true }, state: { switch: true } },
  
  // Kitchen
  { id: 'k_socket1', name: 'Kitchen Coffee Machine', class: 'socket', zone: 'kitchen', capabilities: { switch: true }, state: { switch: false } },
  { id: 'k_socket2', name: 'Microwave Socket', class: 'socket', zone: 'kitchen', capabilities: { switch: true }, state: { switch: true } },
  { id: 'k_socket3', name: 'Dishwasher Power', class: 'socket', zone: 'kitchen', capabilities: { switch: true }, state: { switch: false } },
  { id: 'k_socket4', name: 'Kitchen Toaster', class: 'socket', zone: 'kitchen', capabilities: { switch: true }, state: { switch: false } },
  
  // Bedroom
  { id: 'br_light1', name: 'Bedroom Ceiling Light', class: 'light', zone: 'bedroom', capabilities: { dim: true }, state: { dim: 0.6 } },
  { id: 'br_socket1', name: 'Bedroom Reading Light', class: 'socket', zone: 'bedroom', capabilities: { switch: true }, state: { switch: false } },
  { id: 'br_socket2', name: 'Bedroom Space Heater', class: 'socket', zone: 'bedroom', capabilities: { switch: true }, state: { switch: false } },
  
  // Other devices
  { id: 'thermostat1', name: 'Main Thermostat', class: 'thermostat', zone: 'living_room', capabilities: { target_temperature: true }, state: { target_temperature: 22 } },
  { id: 'sensor1', name: 'Motion Sensor', class: 'sensor', zone: 'living_room', capabilities: { alarm_motion: true }, state: { alarm_motion: false } }
];

// Test scenarios simulating user commands and expected smart filtering
const testScenarios = [
  {
    description: 'Light control commands',
    command: 'turn on the lights in living room',
    zone: 'living_room',
    deviceFilter: 'light',
    expectedDevices: ['Living Room Ceiling Light', 'Living Room Table Lamp'],
    testEnhancement: 'Socket lamps should be included with lights'
  },
  {
    description: 'Kitchen appliance control',
    command: 'turn on kitchen appliances',
    zone: 'kitchen',
    deviceFilter: 'appliances',
    expectedDevices: ['Kitchen Coffee Machine', 'Microwave Socket', 'Dishwasher Power', 'Kitchen Toaster'],
    testEnhancement: 'All kitchen appliance sockets should be identified'
  },
  {
    description: 'Specific appliance mention',
    command: 'start the coffee machine',
    zone: null,
    deviceFilter: 'auto-detect',
    expectedDevices: ['Kitchen Coffee Machine'],
    testEnhancement: 'Should auto-detect coffee machine socket'
  },
  {
    description: 'Entertainment device control',
    command: 'turn on entertainment devices in living room',
    zone: 'living_room',
    deviceFilter: 'entertainment',
    expectedDevices: ['TV Stand Media Center', 'Sound System Power'],
    testEnhancement: 'Entertainment category sockets should be identified'
  },
  {
    description: 'Climate control',
    command: 'turn on the heater in bedroom',
    zone: 'bedroom',
    deviceFilter: 'climate',
    expectedDevices: ['Bedroom Space Heater'],
    testEnhancement: 'Climate category sockets should be identified'
  },
  {
    description: 'Mixed device types',
    command: 'turn on everything in living room',
    zone: 'living_room',
    deviceFilter: null,
    expectedDevices: ['Living Room Ceiling Light', 'Living Room Table Lamp', 'TV Stand Media Center', 'Sound System Power', 'Living Room Fan'],
    testEnhancement: 'All controllable devices should be included'
  }
];

console.log('📍 Testing Socket Device Type Identification\n');

// Test 1: Verify socket device type identification
testScenarios.forEach(scenario => {
  const socketDevices = mockDevices.filter(d => d.class === 'socket');
  
  socketDevices.forEach(device => {
    const deviceType = app.getSocketDeviceType(device);
    const category = app.getSocketDeviceCategory(device);
    
    if (deviceType) {
      console.log(`✓ "${device.name}" identified as ${deviceType} (${category} category)`);
    }
  });
});

console.log('\n📍 Testing Enhanced Device Filtering Logic\n');

// Test 2: Validate enhanced filtering logic
testScenarios.forEach((scenario, index) => {
  console.log(`🔍 Scenario ${index + 1}: ${scenario.description}`);
  console.log(`   Command: "${scenario.command}"`);
  console.log(`   Expected enhancement: ${scenario.testEnhancement}`);
  
  // Filter devices by zone if specified
  let testDevices = scenario.zone ? 
    mockDevices.filter(d => d.zone === scenario.zone) : 
    mockDevices;
  
  // Apply the enhanced filtering logic
  let filtered = testDevices;
  
  if (scenario.deviceFilter === 'light') {
    filtered = testDevices.filter(device => {
      if (device.class === 'light') return true;
      if (device.class === 'socket') {
        return app.isLightControllingSocket(device);
      }
      return false;
    });
  } else if (scenario.deviceFilter === 'appliances') {
    filtered = testDevices.filter(device => {
      if (device.class !== 'socket') return false;
      const category = app.getSocketDeviceCategory(device);
      return category === 'kitchen' || category === 'appliances';
    });
  } else if (scenario.deviceFilter === 'entertainment') {
    filtered = testDevices.filter(device => {
      if (device.class !== 'socket') return false;
      const category = app.getSocketDeviceCategory(device);
      return category === 'entertainment';
    });
  } else if (scenario.deviceFilter === 'climate') {
    filtered = testDevices.filter(device => {
      if (device.class === 'thermostat') return true;
      if (device.class !== 'socket') return false;
      const category = app.getSocketDeviceCategory(device);
      return category === 'climate';
    });
  } else if (scenario.deviceFilter === 'auto-detect') {
    // Smart detection for specific appliance mentions
    if (scenario.command.toLowerCase().includes('coffee')) {
      filtered = testDevices.filter(device => {
        const deviceType = app.getSocketDeviceType(device);
        return deviceType === 'coffeemachine';
      });
    }
  }
  
  // Filter to only switchable/controllable devices using same logic as app.js
  filtered = filtered.filter(device => {
    if (!device.capabilities) return false;
    
    // Helper function to determine if a device class is controllable for on/off commands
    function isControllableDeviceClass(deviceClass) {
      const readOnlyClasses = ["sensor", "camera", "button", "other"];
      const limitedControlClasses = ["thermostat"]; // These have specific commands only
      
      if (readOnlyClasses.includes(deviceClass)) {
        return false;
      }
      
      // For turn_on/turn_off commands, exclude thermostats as they don't typically support these
      return !limitedControlClasses.includes(deviceClass);
    }
    
    // For deviceFilter === null (everything), use the same logic as app.js
    if (scenario.deviceFilter === null) {
      return isControllableDeviceClass(device.class) && 
             (device.capabilities.switch || device.capabilities.dim);
    }
    
    // For other scenarios, include devices with appropriate capabilities
    return device.capabilities.switch || device.capabilities.dim || device.capabilities.target_temperature;
  });
  
  // Check results
  const foundNames = filtered.map(d => d.name).sort();
  const expectedNames = scenario.expectedDevices.sort();
  const matches = JSON.stringify(foundNames) === JSON.stringify(expectedNames);
  
  console.log(`   📋 Found devices: ${foundNames.join(', ') || 'none'}`);
  console.log(`   ✓ Expected: ${expectedNames.join(', ')}`);
  console.log(`   ${matches ? '✅ PASS' : '❌ FAIL'} - ${matches ? 'Filtering works correctly' : 'Filtering needs adjustment'}`);
  
  if (!matches) {
    console.log(`      🔍 Analysis:`);
    const missing = expectedNames.filter(name => !foundNames.includes(name));
    const extra = foundNames.filter(name => !expectedNames.includes(name));
    if (missing.length > 0) {
      console.log(`        Missing: ${missing.join(', ')}`);
    }
    if (extra.length > 0) {
      console.log(`        Extra: ${extra.join(', ')}`);
    }
  }
  console.log('');
});

console.log('📍 Testing Socket Device Categories\n');

// Test 3: Verify category-based filtering
const categoryTests = [
  { category: 'kitchen', expectedCount: 4, description: 'Kitchen appliances' },
  { category: 'entertainment', expectedCount: 2, description: 'Entertainment devices' },
  { category: 'lighting', expectedCount: 2, description: 'Socket-controlled lights' }, // Living Room Table Lamp + Bedroom Reading Light
  { category: 'climate', expectedCount: 2, description: 'Climate control devices' } // Living Room Fan + Bedroom Space Heater
];

categoryTests.forEach(test => {
  const categoryDevices = mockDevices.filter(device => {
    if (device.class !== 'socket') return false;
    const category = app.getSocketDeviceCategory(device);
    return category === test.category;
  });
  
  console.log(`✓ ${test.description}: Found ${categoryDevices.length} devices (expected ${test.expectedCount})`);
  categoryDevices.forEach(device => {
    console.log(`   • ${device.name}`);
  });
  
  const success = categoryDevices.length === test.expectedCount;
  console.log(`   ${success ? '✅ PASS' : '❌ FAIL'}\n`);
});

console.log('✅ Enhanced Socket Device Identification Integration Test Completed\n');

console.log('🎯 Summary of Enhancements Tested:');
console.log('   • Socket device type identification using comprehensive vocabulary');
console.log('   • Category-based filtering (kitchen, entertainment, lighting, climate)');
console.log('   • Smart command parsing for specific appliance mentions');
console.log('   • Enhanced light filtering to include socket-controlled lamps');
console.log('   • Improved device filtering logic for room commands');
console.log('   • Auto-detection of appliance types from command context');
