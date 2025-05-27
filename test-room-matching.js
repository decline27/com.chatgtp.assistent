#!/usr/bin/env node
'use strict';

/**
 * Test script to verify the multilingual room matching fix
 * This tests the specific issue where "trädgården" should match "Trägården"
 */

const { processMultilingualCommand, normalizeRoomName } = require('./modules/multilingualProcessor');

// Simulate the available rooms from the error message
const availableRooms = [
  'Home', 'Andra våningen', 'Vardagsrummet', 'Kök', 'Anna sovrum', 
  'Trägården', 'Första våningen', 'Hallen', 'Tv Rummet', 'Kontoret', 
  'Feng Shuil', 'Tvättstuga', 'Jakob sovrum', 'Uppfarten', 'Oliver sovrum', 
  'Uterummet', 'Elliot Sovrum', 'Huvudsovrum', 'Utomhus', 'Teknikrum'
];

console.log('🧪 Testing Multilingual Room Matching Fix\n');

// Test cases
const testCases = [
  {
    input: "varda temperaturen på sparet i trädgården",
    language: "sv",
    description: "Original failing case - Swedish 'trädgården' should match 'Trägården'"
  },
  {
    input: "sätt på ljuset i vardagsrummet",
    language: "sv", 
    description: "Swedish 'vardagsrummet' should match 'Vardagsrummet'"
  },
  {
    input: "turn on lights in garden",
    language: "en",
    description: "English 'garden' should match 'Trägården'"
  },
  {
    input: "check temperature in trägården",
    language: "en",
    description: "Direct match - 'trägården' should match 'Trägården'"
  }
];

testCases.forEach((testCase, index) => {
  console.log(`Test ${index + 1}: ${testCase.description}`);
  console.log(`Input: "${testCase.input}" (${testCase.language})`);
  
  // Test the multilingual processing
  const result = processMultilingualCommand(testCase.input, testCase.language, availableRooms);
  
  console.log(`Detected rooms: [${result.rooms.join(', ')}]`);
  console.log(`Detected actions: [${result.actions.join(', ')}]`);
  console.log(`Detected devices: [${result.deviceTypes.join(', ')}]`);
  
  // Test individual room normalization
  if (result.rooms.length > 0) {
    result.rooms.forEach(room => {
      const normalized = normalizeRoomName(room, testCase.language, availableRooms);
      console.log(`Room normalization: "${room}" -> "${normalized}"`);
      
      // Check if normalized room would match any available room
      const matchingRoom = availableRooms.find(availableRoom => 
        availableRoom.toLowerCase() === normalized.toLowerCase() ||
        availableRoom.toLowerCase().includes(normalized.toLowerCase()) ||
        normalized.toLowerCase().includes(availableRoom.toLowerCase())
      );
      
      if (matchingRoom) {
        console.log(`✅ Would match available room: "${matchingRoom}"`);
      } else {
        console.log(`❌ No match found in available rooms`);
      }
    });
  }
  
  console.log(`Confidence: ${result.confidence.toFixed(2)}\n`);
});

console.log('🔍 Testing Direct Room Name Normalization\n');

// Test direct normalization
const directTests = [
  { input: "trädgården", language: "sv" },
  { input: "garden", language: "en" },
  { input: "vardagsrummet", language: "sv" },
  { input: "living room", language: "en" }
];

directTests.forEach(test => {
  const normalized = normalizeRoomName(test.input, test.language, availableRooms);
  const matchingRoom = availableRooms.find(room => 
    room.toLowerCase() === normalized.toLowerCase() ||
    room.toLowerCase().includes(normalized.toLowerCase()) ||
    normalized.toLowerCase().includes(room.toLowerCase())
  );
  
  console.log(`"${test.input}" (${test.language}) -> "${normalized}"`);
  if (matchingRoom) {
    console.log(`  ✅ Matches: "${matchingRoom}"`);
  } else {
    console.log(`  ❌ No match found`);
  }
});

console.log('\n✨ Test completed!');
