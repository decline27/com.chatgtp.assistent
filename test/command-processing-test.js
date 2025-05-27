'use strict';

/**
 * Simple test suite for command processing improvements
 * Run with: node test/command-processing-test.js
 */

const { preprocessCommand, suggestImprovement } = require('../modules/commandProcessor');

// Test cases for command preprocessing
const testCases = [
  {
    input: "Please turn on the living room lights",
    expected: {
      intent: "turn_on",
      rooms: ["living room"],
      deviceTypes: ["light"]
    }
  },
  {
    input: "Switch off bedroom lamp",
    expected: {
      intent: "turn_off",
      rooms: ["bedroom"],
      deviceTypes: ["light"]
    }
  },
  {
    input: "Dim kitchen",
    expected: {
      intent: "dim",
      rooms: ["kitchen"],
      deviceTypes: []
    }
  },
  {
    input: "Set temperature to 22 degrees in office",
    expected: {
      intent: "set_temperature",
      rooms: ["office"],
      deviceTypes: ["thermostat"]
    }
  },
  {
    input: "Turn on vardagsrum ljus",
    expected: {
      intent: "turn_on",
      rooms: ["living room"],
      deviceTypes: ["light"]
    }
  },
  {
    input: "Lock the door",
    expected: {
      intent: "lock",
      rooms: [],
      deviceTypes: ["lock"]
    }
  },
  {
    input: "lights",
    expected: {
      intent: "turn_on",
      rooms: [],
      deviceTypes: ["light"]
    }
  },
  {
    input: "turn on the ligt in the livingroom",
    expected: {
      intent: "turn_on",
      rooms: ["living room"],
      deviceTypes: ["light"]
    }
  }
];

function runTests() {
  console.log('🧪 Running Command Processing Tests\n');

  let passed = 0;
  let failed = 0;

  testCases.forEach((testCase, index) => {
    console.log(`Test ${index + 1}: "${testCase.input}"`);

    const result = preprocessCommand(testCase.input);

    // Check intent
    const intentMatch = result.intent === testCase.expected.intent;
    console.log(`  Intent: ${result.intent} ${intentMatch ? '✅' : '❌'}`);

    // Check rooms
    const roomsMatch = testCase.expected.rooms.every(room =>
      result.entities.rooms.includes(room)
    );
    console.log(`  Rooms: [${result.entities.rooms.join(', ')}] ${roomsMatch ? '✅' : '❌'}`);

    // Check device types
    const devicesMatch = testCase.expected.deviceTypes.every(device =>
      result.entities.deviceTypes.includes(device)
    );
    console.log(`  Devices: [${result.entities.deviceTypes.join(', ')}] ${devicesMatch ? '✅' : '❌'}`);

    // Check confidence
    console.log(`  Confidence: ${result.confidence.toFixed(2)}`);

    // Check suggestions for low confidence
    if (result.confidence < 0.5) {
      const suggestion = suggestImprovement(result);
      console.log(`  Suggestion: ${suggestion}`);
    }

    const testPassed = intentMatch && roomsMatch && devicesMatch;
    if (testPassed) {
      passed++;
      console.log('  ✅ PASSED\n');
    } else {
      failed++;
      console.log('  ❌ FAILED\n');
    }
  });

  console.log(`📊 Test Results: ${passed} passed, ${failed} failed`);

  if (failed === 0) {
    console.log('🎉 All tests passed!');
  } else {
    console.log('⚠️  Some tests failed. Review the command processing logic.');
  }
}

// Example usage scenarios
function runExamples() {
  console.log('\n🔍 Example Command Processing:\n');

  const examples = [
    "Turn on all lights in the house",
    "Dim the bedroom lights to 50%",
    "Set living room temperature to 22",
    "Open kitchen curtains",
    "Lock front door",
    "lights on",
    "bedroom off",
    "help"
  ];

  examples.forEach(example => {
    console.log(`Input: "${example}"`);
    const result = preprocessCommand(example);
    console.log(`  Processed: "${result.processed}"`);
    console.log(`  Intent: ${result.intent}`);
    console.log(`  Confidence: ${result.confidence.toFixed(2)}`);

    if (result.confidence < 0.6) {
      const suggestion = suggestImprovement(result);
      console.log(`  💡 Suggestion: ${suggestion}`);
    }
    console.log('');
  });
}

// Run tests if this file is executed directly
if (require.main === module) {
  runTests();
  runExamples();
}

module.exports = { runTests, runExamples };
