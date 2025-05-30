#!/usr/bin/env node
'use strict';

/**
 * Real-World Socket Device Filtering Test
 */

console.log('🏠 Testing Real-World Socket Device Filtering Scenarios\n');

// Mock devices that represent typical smart home setup
const mockDevices = [
  // Lights and lighting
  { id: 'light1', name: 'Living Room Ceiling Light', class: 'light', zone: 'living_room', capabilities: { dim: true }, state: { dim: 0.8 } },
  { id: 'socket1', name: 'Living Room Table Lamp', class: 'socket', zone: 'living_room', capabilities: { switch: true }, state: { switch: true } },
  { id: 'socket2', name: 'Bedroom Reading Light', class: 'socket', zone: 'bedroom', capabilities: { switch: true }, state: { switch: false } },
  
  // Kitchen appliances
  { id: 'socket3', name: 'Kitchen Coffee Machine', class: 'socket', zone: 'kitchen', capabilities: { switch: true }, state: { switch: false } },
  { id: 'socket4', name: 'Microwave Socket', class: 'socket', zone: 'kitchen', capabilities: { switch: true }, state: { switch: true } },
  { id: 'socket5', name: 'Dishwasher Power', class: 'socket', zone: 'kitchen', capabilities: { switch: true }, state: { switch: false } },
  
  // Entertainment devices
  { id: 'socket6', name: 'TV Stand Media Center', class: 'socket', zone: 'living_room', capabilities: { switch: true }, state: { switch: true } },
  { id: 'socket7', name: 'Sound System Power', class: 'socket', zone: 'living_room', capabilities: { switch: true }, state: { switch: false } },
  
  // Climate control
  { id: 'socket8', name: 'Bedroom Space Heater', class: 'socket', zone: 'bedroom', capabilities: { switch: true }, state: { switch: false } },
  { id: 'socket9', name: 'Living Room Fan', class: 'socket', zone: 'living_room', capabilities: { switch: true }, state: { switch: true } },
  
  // Other devices
  { id: 'thermostat1', name: 'Main Thermostat', class: 'thermostat', zone: 'living_room', capabilities: { target_temperature: true }, state: { target_temperature: 22 } },
  { id: 'sensor1', name: 'Motion Sensor', class: 'sensor', zone: 'living_room', capabilities: { alarm_motion: true }, state: { alarm_motion: false } }
];

// Load the enhanced app.js methods
try {
  const app = require('./app.js');
  
  // Test scenarios that users might say
  const testScenarios = [
    {
      description: 'Turn on lights in living room',
      command: 'turn on the lights in the living room',
      zone: 'living_room',
      deviceFilter: 'light',
      expected: ['Living Room Ceiling Light', 'Living Room Table Lamp']
    },
    {
      description: 'Turn on kitchen appliances',
      command: 'turn on kitchen appliances',
      zone: 'kitchen',
      deviceFilter: 'appliances',
      expected: ['Kitchen Coffee Machine', 'Microwave Socket', 'Dishwasher Power']
    },
    {
      description: 'Start the coffee machine',
      command: 'start the coffee machine',
      zone: null,
      deviceFilter: 'auto-detect',
      expected: ['Kitchen Coffee Machine']
    },
    {
      description: 'Turn on entertainment devices in living room',
      command: 'turn on entertainment devices in living room',
      zone: 'living_room',
      deviceFilter: 'entertainment',
      expected: ['TV Stand Media Center', 'Sound System Power']
    },
    {
      description: 'Turn on the heater in bedroom',
      command: 'turn on the heater in bedroom',
      zone: 'bedroom',
      deviceFilter: 'climate',
      expected: ['Bedroom Space Heater']
    },
    {
      description: 'Turn on all devices in living room',
      command: 'turn on everything in living room',
      zone: 'living_room',
      deviceFilter: null,
      expected: ['Living Room Ceiling Light', 'Living Room Table Lamp', 'TV Stand Media Center', 'Sound System Power', 'Living Room Fan']
    }
  ];
  
  console.log('📍 Testing Enhanced Device Filtering Logic\n');
  
  testScenarios.forEach((scenario, index) => {
    console.log(`🔍 Scenario ${index + 1}: ${scenario.description}`);
    console.log(`   Command: "${scenario.command}"`);
    console.log(`   Zone: ${scenario.zone || 'any'}`);
    console.log(`   Filter: ${scenario.deviceFilter || 'none'}`);
    
    // Filter devices by zone if specified
    let testDevices = scenario.zone ? 
      mockDevices.filter(d => d.zone === scenario.zone) : 
      mockDevices;
    
    // Apply device filter using our enhanced logic
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
        const deviceType = app.getSocketDeviceType(device);
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
    
    // Filter to only switchable devices
    filtered = filtered.filter(device => 
      device.capabilities && device.capabilities.switch
    );
    
    console.log(`   📋 Found devices: ${filtered.map(d => d.name).join(', ') || 'none'}`);
    console.log(`   ✓ Expected: ${scenario.expected.join(', ')}`);
    
    // Check if results match expectations
    const foundNames = filtered.map(d => d.name).sort();
    const expectedNames = scenario.expected.sort();
    const matches = JSON.stringify(foundNames) === JSON.stringify(expectedNames);
    
    console.log(`   ${matches ? '✅' : '❌'} Result: ${matches ? 'PASS' : 'FAIL'}`);
    if (!matches) {
      console.log(`      Expected: [${expectedNames.join(', ')}]`);
      console.log(`      Got: [${foundNames.join(', ')}]`);
    }
    console.log('');
  });
  
} catch (e) {
  console.error('✗ Error running filtering tests:', e.message);
  console.error(e.stack);
}

console.log('✅ Real-World Socket Device Filtering Test Completed');
