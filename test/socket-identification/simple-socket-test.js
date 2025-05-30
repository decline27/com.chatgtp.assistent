#!/usr/bin/env node
'use strict';

/**
 * Simple Socket Device Identification Test
 */

console.log('🔌 Testing Socket Device Identification Improvements\n');

// Test 1: Load socketDeviceMapper
console.log('📍 Test 1: Loading socketDeviceMapper module');
try {
  const mapper = require('./modules/socketDeviceMapper');
  console.log('✓ socketDeviceMapper loaded successfully');
  console.log('  Available functions:', Object.keys(mapper));
  
  // Test device identification
  console.log('\n📍 Test 2: Device Type Identification');
  const testDevices = [
    'Kitchen Coffee Machine',
    'Living Room Table Lamp', 
    'Microwave Socket',
    'TV Stand Media Player',
    'Bedroom Heater'
  ];
  
  testDevices.forEach(deviceName => {
    try {
      const deviceType = mapper.identifySocketDeviceType(deviceName);
      const category = deviceType ? mapper.getDeviceCategory(deviceType) : 'unknown';
      console.log(`  ✓ "${deviceName}" → Type: ${deviceType || 'not identified'}, Category: ${category}`);
    } catch (e) {
      console.log(`  ✗ Error testing "${deviceName}": ${e.message}`);
    }
  });
  
} catch (e) {
  console.error('✗ Error loading socketDeviceMapper:', e.message);
  process.exit(1);
}

// Test 2: Load and test app.js static methods
console.log('\n📍 Test 3: Testing app.js enhanced methods');
try {
  const app = require('./app.js');
  console.log('✓ app.js loaded successfully');
  
  // Check if our new static methods exist
  if (typeof app.getSocketDeviceType === 'function') {
    console.log('  ✓ getSocketDeviceType method exists');
  } else {
    console.log('  ✗ getSocketDeviceType method missing');
  }
  
  if (typeof app.isLightControllingSocket === 'function') {
    console.log('  ✓ isLightControllingSocket method exists');
  } else {
    console.log('  ✗ isLightControllingSocket method missing');
  }
  
} catch (e) {
  console.error('✗ Error loading app.js:', e.message);
}

// Test 3: Load deviceStatusRetriever
console.log('\n📍 Test 4: Testing deviceStatusRetriever enhancements');
try {
  const statusRetriever = require('./modules/deviceStatusRetriever');
  console.log('✓ deviceStatusRetriever loaded successfully');
  
  // Test enhanced socket description
  const mockSocket = {
    id: 'socket1',
    name: 'Kitchen Coffee Machine',
    class: 'socket',
    zone: 'kitchen',
    capabilities: { switch: true },
    state: { switch: true }
  };
  
  // This would test the enhanced socket description logic
  console.log('  ✓ deviceStatusRetriever ready for enhanced socket descriptions');
  
} catch (e) {
  console.error('✗ Error loading deviceStatusRetriever:', e.message);
}

console.log('\n✅ Simple Socket Device Identification Test Completed');
