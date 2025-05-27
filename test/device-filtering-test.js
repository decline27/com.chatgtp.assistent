'use strict';

/**
 * Test for device filtering logic to ensure lights are properly filtered
 * when user says "turn on the lights in the living room"
 */

// Mock devices from your living room (zone: 9eb2975d-49ea-4033-8db0-105a3e982117)
const mockLivingRoomDevices = [
  {
    "id": "bf5bc411-6fa0-48b2-a936-2821d69b6625",
    "name": "[LG] webOS TV OLED55C9PLA",
    "zone": "9eb2975d-49ea-4033-8db0-105a3e982117",
    "class": "speaker"
  },
  {
    "id": "b23be144-ce00-4287-a507-13c9ec80bf5d",
    "name": "Matrum",
    "zone": "9eb2975d-49ea-4033-8db0-105a3e982117",
    "class": "socket"
  },
  {
    "id": "a9f2f2b2-b7d7-4c4a-b2c0-da54468a6bc7",
    "name": "Tv  Hörn",
    "zone": "9eb2975d-49ea-4033-8db0-105a3e982117",
    "class": "socket"
  },
  {
    "id": "f206bda7-5166-414b-81c6-8bae26cafbe0",
    "name": "Soffa hörna",
    "zone": "9eb2975d-49ea-4033-8db0-105a3e982117",
    "class": "light"
  },
  {
    "id": "42c488fb-4a1d-402b-86eb-3f54577dc5bd",
    "name": "Soffa hörna",
    "zone": "9eb2975d-49ea-4033-8db0-105a3e982117",
    "class": "light"
  },
  {
    "id": "6b95711f-933f-48cc-92ed-f5e0691f220e",
    "name": "Soffa hörna",
    "zone": "9eb2975d-49ea-4033-8db0-105a3e982117",
    "class": "light"
  },
  {
    "id": "2b9eaad9-7bbe-473a-83ef-4b7aeafdb8a8",
    "name": "Golvlampa",
    "zone": "9eb2975d-49ea-4033-8db0-105a3e982117",
    "class": "light"
  },
  {
    "id": "e118ffae-7a23-4ed3-afd9-90b1c13a5a43",
    "name": "Vardagsrum 2",
    "zone": "9eb2975d-49ea-4033-8db0-105a3e982117",
    "class": "speaker"
  },
  {
    "id": "03eb1d52-7ab6-4de3-b542-9fa65ec2a97c",
    "name": "Trädgårdsdörren",
    "zone": "9eb2975d-49ea-4033-8db0-105a3e982117",
    "class": "sensor"
  },
  {
    "id": "7cec6de3-5df3-47c7-a674-2bdd1f4d0c04",
    "name": "Living Room",
    "zone": "9eb2975d-49ea-4033-8db0-105a3e982117",
    "class": "camera"
  }
];

// Helper function to simulate device filtering logic
function isControllableDeviceClass(deviceClass) {
  const readOnlyClasses = ["sensor", "camera", "button", "other"];
  const limitedControlClasses = ["thermostat"];
  
  if (readOnlyClasses.includes(deviceClass)) {
    return false;
  }
  
  return !limitedControlClasses.includes(deviceClass);
}

function filterDevicesForCommand(devices, originalCommand) {
  let targetDevices = devices.filter(device => isControllableDeviceClass(device.class));
  
  // If the original command mentions lights/lamps specifically, filter to lights only
  if (/light|lights|lamp|lamps|ljus|lampa|lampor|ligt|ligts|belysning/i.test(originalCommand)) {
    const lightDevices = targetDevices.filter(device => device.class === "light");
    if (lightDevices.length > 0) {
      console.log(`Filtering to lights only based on command: "${originalCommand}"`);
      targetDevices = lightDevices;
    }
  }
  // If no specific device type mentioned, but it's a generic room command, prefer lights
  else if (!/socket|speaker|tv|camera|lock|sensor|thermostat/i.test(originalCommand)) {
    const lightDevices = targetDevices.filter(device => device.class === "light");
    const controllableDevices = targetDevices.filter(device => 
      isControllableDeviceClass(device.class)
    );
    
    // If we have lights and the command seems generic, prefer lights
    if (lightDevices.length > 0 && lightDevices.length >= controllableDevices.length * 0.3) {
      console.log(`Preferring lights for generic room command: "${originalCommand}"`);
      targetDevices = lightDevices;
    }
    // Otherwise, exclude read-only devices but keep controllable ones
    else {
      console.log(`Using controllable devices for generic room command: "${originalCommand}"`);
      targetDevices = controllableDevices;
    }
  }
  
  return targetDevices;
}

function runDeviceFilteringTests() {
  console.log('🧪 Testing Device Filtering Logic\n');
  
  const testCases = [
    {
      command: "turn on the ligt in the livingroom",
      expectedDeviceClasses: ["light"],
      description: "Should filter to lights only when 'ligt' (light) is mentioned"
    },
    {
      command: "turn on lights in living room",
      expectedDeviceClasses: ["light"],
      description: "Should filter to lights only when 'lights' is mentioned"
    },
    {
      command: "turn on living room",
      expectedDeviceClasses: ["light"],
      description: "Should prefer lights for generic room command"
    },
    {
      command: "turn on speakers in living room",
      expectedDeviceClasses: ["speaker", "socket", "light"],
      description: "Should include all controllable devices when speakers mentioned"
    },
    {
      command: "turn on sockets in living room",
      expectedDeviceClasses: ["speaker", "socket", "light"],
      description: "Should include all controllable devices when sockets mentioned"
    }
  ];
  
  testCases.forEach((testCase, index) => {
    console.log(`Test ${index + 1}: "${testCase.command}"`);
    console.log(`Expected: ${testCase.description}`);
    
    const filteredDevices = filterDevicesForCommand(mockLivingRoomDevices, testCase.command);
    const actualClasses = [...new Set(filteredDevices.map(d => d.class))].sort();
    const expectedClasses = testCase.expectedDeviceClasses.sort();
    
    console.log(`Filtered devices (${filteredDevices.length}):`);
    filteredDevices.forEach(device => {
      console.log(`  - ${device.name} (${device.class})`);
    });
    
    const passed = JSON.stringify(actualClasses) === JSON.stringify(expectedClasses);
    console.log(`Device classes: [${actualClasses.join(', ')}]`);
    console.log(`Result: ${passed ? '✅ PASSED' : '❌ FAILED'}`);
    
    if (!passed) {
      console.log(`Expected classes: [${expectedClasses.join(', ')}]`);
    }
    
    console.log('');
  });
  
  // Summary
  console.log('📊 Summary:');
  console.log(`Total living room devices: ${mockLivingRoomDevices.length}`);
  console.log(`Light devices: ${mockLivingRoomDevices.filter(d => d.class === 'light').length}`);
  console.log(`Controllable devices: ${mockLivingRoomDevices.filter(d => isControllableDeviceClass(d.class)).length}`);
  console.log(`Read-only devices: ${mockLivingRoomDevices.filter(d => !isControllableDeviceClass(d.class)).length}`);
}

// Run tests if this file is executed directly
if (require.main === module) {
  runDeviceFilteringTests();
}

module.exports = { runDeviceFilteringTests, filterDevicesForCommand };
