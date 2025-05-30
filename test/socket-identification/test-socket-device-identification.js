#!/usr/bin/env node
'use strict';

/**
 * Test Socket Device Identification Improvements
 * 
 * This test validates that the enhanced socket device identification system
 * can properly identify and filter devices connected to sockets in room commands.
 */

// Mock socket devices for testing
const mockDevices = [
  // Lights and lighting
  { id: 'light1', name: 'Living Room Light', class: 'light', zone: 'living_room' },
  { id: 'socket1', name: 'Living Room Table Lamp', class: 'socket', zone: 'living_room' },
  { id: 'socket2', name: 'Bedroom Ceiling Light Socket', class: 'socket', zone: 'bedroom' },
  
  // Kitchen appliances
  { id: 'socket3', name: 'Kitchen Coffee Machine', class: 'socket', zone: 'kitchen' },
  { id: 'socket4', name: 'Microwave Socket', class: 'socket', zone: 'kitchen' },
  { id: 'socket5', name: 'Dishwasher Plug', class: 'socket', zone: 'kitchen' },
  
  // Entertainment devices
  { id: 'tv1', name: 'Living Room TV', class: 'tv', zone: 'living_room' },
  { id: 'socket6', name: 'TV Stand Media Player', class: 'socket', zone: 'living_room' },
  { id: 'speaker1', name: 'Kitchen Speaker', class: 'speaker', zone: 'kitchen' },
  
  // Climate devices
  { id: 'socket7', name: 'Bedroom Heater', class: 'socket', zone: 'bedroom' },
  { id: 'socket8', name: 'Living Room Fan', class: 'socket', zone: 'living_room' },
  
  // Other devices
  { id: 'sensor1', name: 'Motion Sensor', class: 'sensor', zone: 'living_room' },
  { id: 'lock1', name: 'Front Door Lock', class: 'lock', zone: 'hallway' }
];

const mockZones = {
  'living_room': { name: 'Living Room' },
  'bedroom': { name: 'Bedroom' },
  'kitchen': { name: 'Kitchen' },
  'hallway': { name: 'Hallway' }
};

// Import the enhanced socket identification functions
try {
  const { 
    identifySocketDeviceType, 
    getDeviceCategory, 
    getSocketDeviceVocabulary 
  } = require('./modules/socketDeviceMapper');

  console.log('🔌 Testing Socket Device Identification Improvements\n');

  // Test 1: Basic socket device type identification
  console.log('📍 Test 1: Socket Device Type Identification');
  const testDevices = [
    'Kitchen Coffee Machine',
    'Living Room Table Lamp',
    'Microwave Socket',
    'TV Stand Media Player',
    'Bedroom Heater',
    'Dishwasher Plug'
  ];

  testDevices.forEach(deviceName => {
    const deviceType = identifySocketDeviceType(deviceName);
    const category = deviceType ? getDeviceCategory(deviceType) : 'unknown';
    console.log(`  "${deviceName}" → Type: ${deviceType || 'not identified'}, Category: ${category}`);
  });

  // Test 2: Device filtering logic simulation
  console.log('\n📍 Test 2: Device Filtering Logic Simulation');
  
  // Simulate the enhanced filtering logic
  function simulateDeviceFiltering(devices, command, deviceFilter = null) {
    const { identifySocketDeviceType, getDeviceCategory } = require('./modules/socketDeviceMapper');
    
    // Mock the static methods for testing
    const isLightControllingSocket = (device) => {
      if (device.class !== 'socket') return false;
      const name = device.name.toLowerCase();
      if (/light|lamp|ljus|lampa|belysning/i.test(name)) return true;
      const deviceType = identifySocketDeviceType(device.name);
      return deviceType === 'light';
    };

    const isSocketOfType = (device, targetType) => {
      if (device.class !== 'socket') return false;
      const deviceType = identifySocketDeviceType(device.name);
      return deviceType === targetType;
    };

    const isSocketOfCategory = (device, targetCategory) => {
      if (device.class !== 'socket') return false;
      const deviceType = identifySocketDeviceType(device.name);
      const category = deviceType ? getDeviceCategory(deviceType) : null;
      return category === targetCategory;
    };

    let filteredDevices = devices;

    if (deviceFilter) {
      filteredDevices = devices.filter(device => {
        if (deviceFilter === 'light') {
          if (device.class === 'light') return true;
          if (device.class === 'socket' && isLightControllingSocket(device)) return true;
          return false;
        } else if (deviceFilter === 'kitchen') {
          if (device.class === 'socket' && isSocketOfCategory(device, 'kitchen')) return true;
          return false;
        } else if (deviceFilter === 'speaker') {
          if (device.class === 'speaker') return true;
          if (device.class === 'socket' && isSocketOfType(device, 'mediaplayer')) return true;
          return false;
        } else if (deviceFilter === 'appliance') {
          if (device.class === 'socket') {
            const category = isSocketOfCategory(device, 'kitchen') || 
                           isSocketOfCategory(device, 'laundry') || 
                           isSocketOfCategory(device, 'utility');
            return category;
          }
          return false;
        }
        return device.class === deviceFilter;
      });
    } else {
      // Smart filtering based on command content
      const mentionedDeviceType = identifySocketDeviceType(command);
      
      if (mentionedDeviceType) {
        // Filter to specific appliance type
        filteredDevices = devices.filter(device => {
          if (device.class === 'socket') {
            return isSocketOfType(device, mentionedDeviceType);
          }
          return device.class === mentionedDeviceType;
        });
      } else if (/light|lights|lamp|lamps/i.test(command)) {
        // Filter to lights
        filteredDevices = devices.filter(device => 
          device.class === 'light' || 
          (device.class === 'socket' && isLightControllingSocket(device))
        );
      } else if (/kitchen|cook/i.test(command)) {
        // Filter to kitchen devices
        filteredDevices = devices.filter(device => 
          device.class === 'socket' && isSocketOfCategory(device, 'kitchen')
        );
      }
    }

    return filteredDevices;
  }

  // Test filtering scenarios
  const testScenarios = [
    {
      command: 'turn on the lights in living room',
      deviceFilter: 'light',
      description: 'Light filter should include lights and light-controlling sockets'
    },
    {
      command: 'turn on coffee machine in kitchen',
      deviceFilter: null,
      description: 'Should identify coffee machine sockets specifically'
    },
    {
      command: 'turn on kitchen appliances',
      deviceFilter: 'kitchen',
      description: 'Kitchen filter should include all kitchen appliance sockets'
    },
    {
      command: 'turn on the microwave',
      deviceFilter: null,
      description: 'Should identify microwave socket specifically'
    },
    {
      command: 'turn on entertainment in living room',
      deviceFilter: 'speaker',
      description: 'Speaker filter should include speakers and media player sockets'
    }
  ];

  testScenarios.forEach((scenario, index) => {
    console.log(`\n  Scenario ${index + 1}: ${scenario.description}`);
    console.log(`  Command: "${scenario.command}"`);
    console.log(`  Device Filter: ${scenario.deviceFilter || 'auto-detect'}`);
    
    const livingRoomDevices = mockDevices.filter(d => d.zone === 'living_room');
    const kitchenDevices = mockDevices.filter(d => d.zone === 'kitchen');
    const testDevices = scenario.command.includes('living room') ? livingRoomDevices : 
                       scenario.command.includes('kitchen') ? kitchenDevices : mockDevices;
    
    const filtered = simulateDeviceFiltering(testDevices, scenario.command, scenario.deviceFilter);
    
    console.log(`  Input devices: ${testDevices.map(d => d.name).join(', ')}`);
    console.log(`  Filtered result: ${filtered.map(d => d.name).join(', ')}`);
    console.log(`  Device count: ${testDevices.length} → ${filtered.length}`);
  });

  // Test 3: Socket device vocabulary
  console.log('\n📍 Test 3: Socket Device Vocabulary');
  const vocabulary = getSocketDeviceVocabulary('en');
  console.log(`  Total vocabulary terms: ${vocabulary.length}`);
  console.log(`  Sample terms: ${vocabulary.slice(0, 10).join(', ')}...`);

  // Test 4: Enhanced device status simulation
  console.log('\n📍 Test 4: Enhanced Device Status Descriptions');
  
  const socketDevices = mockDevices.filter(d => d.class === 'socket');
  socketDevices.forEach(device => {
    const deviceType = identifySocketDeviceType(device.name);
    const category = deviceType ? getDeviceCategory(deviceType) : null;
    
    let description = '🔌 Socket';
    if (deviceType) {
      const deviceData = require('./modules/socketDeviceMapper').SOCKET_CONNECTED_DEVICES[deviceType];
      if (deviceData) {
        const deviceTerm = deviceData.multilingual.en[0] || deviceType;
        description = `🔌 Socket controlling ${deviceTerm}`;
        if (category) {
          description += ` (${category} device)`;
        }
      }
    }
    
    console.log(`  ${device.name}: ${description}`);
  });

  console.log('\n✅ Socket Device Identification Tests Completed');
  console.log('\n🎯 Key Improvements Demonstrated:');
  console.log('   • Enhanced socket device type identification using comprehensive vocabulary');
  console.log('   • Category-based filtering for kitchen, entertainment, climate devices');
  console.log('   • Smart command parsing for specific appliance mentions');
  console.log('   • Richer device status descriptions with appliance context');
  console.log('   • Better integration between socket mapper and room command processing');

} catch (error) {
  console.error('❌ Error running socket device identification tests:', error);
  console.error('Stack trace:', error.stack);
}
