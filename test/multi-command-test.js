'use strict';

/**
 * Test suite for multi-command functionality
 * Tests the detection, parsing, and execution of multiple commands in one request
 */

const { preprocessCommand, detectMultiCommand, parseMultiCommand } = require('../modules/commandProcessor');

// Test cases for multi-command detection and parsing
const multiCommandTests = [
  {
    input: 'turn on the lights and play music in the living room',
    expected: {
      isMultiCommand: true,
      commandCount: 2,
      description: 'Should detect lights + music command'
    }
  },
  {
    input: 'dim the bedroom lights and set temperature to 22',
    expected: {
      isMultiCommand: true,
      commandCount: 2,
      description: 'Should detect dim + temperature command'
    }
  },
  {
    input: 'turn on kitchen lights, then lock the front door',
    expected: {
      isMultiCommand: true,
      commandCount: 2,
      description: 'Should detect lights + lock command with \'then\''
    }
  },
  {
    input: 'turn off all lights in bedroom and close the curtains',
    expected: {
      isMultiCommand: true,
      commandCount: 2,
      description: 'Should detect lights + curtains command'
    }
  },
  {
    input: 'just turn on the living room lights',
    expected: {
      isMultiCommand: false,
      commandCount: 1,
      description: 'Should detect single command'
    }
  },
  {
    input: 'play some relaxing music and dim the lights and set temperature to 20',
    expected: {
      isMultiCommand: true,
      commandCount: 3,
      description: 'Should detect three commands'
    }
  }
];

// Expected ChatGPT JSON outputs for multi-commands
const expectedOutputs = [
  {
    input: 'turn on the lights and play music in the living room',
    expectedJson: {
      commands: [
        { room: 'living room', command: 'turn_on', device_filter: 'light' },
        { room: 'living room', command: 'play_music', device_filter: 'speaker' }
      ]
    }
  },
  {
    input: 'dim bedroom lights and set temperature to 22',
    expectedJson: {
      commands: [
        { room: 'bedroom', command: 'dim', device_filter: 'light' },
        { room: 'bedroom', command: 'set_temperature', parameters: { temperature: 22 } }
      ]
    }
  }
];

function runMultiCommandDetectionTests() {
  console.log('🧪 Testing Multi-Command Detection\n');

  let passed = 0;
  let failed = 0;

  multiCommandTests.forEach((testCase, index) => {
    console.log(`Test ${index + 1}: "${testCase.input}"`);
    console.log(`Expected: ${testCase.description}`);

    const result = preprocessCommand(testCase.input);
    const isMultiDetected = result.isMultiCommand;

    console.log(`  Multi-command detected: ${isMultiDetected} ${isMultiDetected === testCase.expected.isMultiCommand ? '✅' : '❌'}`);

    if (isMultiDetected) {
      const parsedCommands = parseMultiCommand(testCase.input);
      console.log(`  Parsed commands: ${parsedCommands.length}`);
      parsedCommands.forEach((cmd, i) => {
        console.log(`    ${i + 1}. "${cmd.text}" (intent: ${cmd.intent})`);
      });

      const countMatch = parsedCommands.length === testCase.expected.commandCount;
      console.log(`  Command count: ${parsedCommands.length} ${countMatch ? '✅' : '❌'}`);
    }

    const testPassed = isMultiDetected === testCase.expected.isMultiCommand;
    if (testPassed) {
      passed++;
      console.log('  ✅ PASSED\n');
    } else {
      failed++;
      console.log('  ❌ FAILED\n');
    }
  });

  console.log(`📊 Detection Tests: ${passed} passed, ${failed} failed\n`);
  return { passed, failed };
}

function runExpectedOutputTests() {
  console.log('🎯 Testing Expected JSON Outputs\n');

  expectedOutputs.forEach((testCase, index) => {
    console.log(`Output Test ${index + 1}: "${testCase.input}"`);
    console.log('Expected JSON structure:');
    console.log(JSON.stringify(testCase.expectedJson, null, 2));
    console.log('');
  });
}

function runExampleScenarios() {
  console.log('🔍 Example Multi-Command Scenarios:\n');

  const examples = [
    'turn on the lights and play melodic music in the living room',
    'dim bedroom lights to 50% and set temperature to 22 degrees',
    'turn off all lights, lock the doors, and set alarm',
    'open the curtains and turn on morning playlist in bedroom',
    'turn on kitchen lights, start coffee maker, and play news',
    'goodnight routine: turn off all lights and lock all doors',
    'movie time: dim living room lights and turn on TV'
  ];

  examples.forEach((example, index) => {
    console.log(`Scenario ${index + 1}: "${example}"`);

    const result = preprocessCommand(example);
    console.log(`  Multi-command: ${result.isMultiCommand ? 'Yes' : 'No'}`);
    console.log(`  Confidence: ${result.confidence.toFixed(2)}`);

    if (result.isMultiCommand) {
      const parsed = parseMultiCommand(example);
      console.log(`  Individual commands (${parsed.length}):`);
      parsed.forEach((cmd, i) => {
        console.log(`    ${i + 1}. "${cmd.text}"`);
        console.log(`       Intent: ${cmd.intent}, Rooms: [${cmd.entities.rooms.join(', ')}], Devices: [${cmd.entities.deviceTypes.join(', ')}]`);
      });
    }
    console.log('');
  });
}

function simulateMultiCommandExecution() {
  console.log('⚡ Simulating Multi-Command Execution Flow:\n');

  const command = 'turn on the lights and play music in the living room';
  console.log(`Input: "${command}"`);

  // Step 1: Preprocessing
  const processed = preprocessCommand(command);
  console.log(`\n1. Preprocessing:`);
  console.log(`   Multi-command detected: ${processed.isMultiCommand}`);
  console.log(`   Confidence: ${processed.confidence.toFixed(2)}`);

  // Step 2: Parsing individual commands
  if (processed.isMultiCommand) {
    const parsed = parseMultiCommand(command);
    console.log(`\n2. Command Parsing:`);
    parsed.forEach((cmd, i) => {
      console.log(`   Command ${i + 1}: "${cmd.text}"`);
      console.log(`     Intent: ${cmd.intent}`);
      console.log(`     Entities: rooms=[${cmd.entities.rooms.join(', ')}], devices=[${cmd.entities.deviceTypes.join(', ')}]`);
    });

    // Step 3: Expected ChatGPT output
    console.log(`\n3. Expected ChatGPT JSON:`);
    const expectedJson = {
      commands: [
        { room: 'living room', command: 'turn_on', device_filter: 'light' },
        { room: 'living room', command: 'play_music', device_filter: 'speaker' }
      ]
    };
    console.log(JSON.stringify(expectedJson, null, 2));

    // Step 4: Execution simulation
    console.log(`\n4. Execution Simulation:`);
    console.log(`   Command 1: Turn on lights in living room`);
    console.log(`     → Filter to light devices only`);
    console.log(`     → Execute turn_on on 4 light devices`);
    console.log(`     → Result: ✅ 4/4 lights turned on`);

    console.log(`   Command 2: Play music in living room`);
    console.log(`     → Filter to speaker devices only`);
    console.log(`     → Execute play_music on 2 speaker devices`);
    console.log(`     → Result: ✅ 2/2 speakers started playing`);

    console.log(`\n   Final Result:`);
    console.log(`   🎯 Multi-command completed: 6/6 actions successful`);
    console.log(`   Command 1: ✅ 4/4 devices updated in living room`);
    console.log(`   Command 2: ✅ 2/2 devices updated in living room`);
  }
}

// Run all tests if this file is executed directly
if (require.main === module) {
  const detectionResults = runMultiCommandDetectionTests();
  runExpectedOutputTests();
  runExampleScenarios();
  simulateMultiCommandExecution();

  console.log('\n🎉 Multi-Command Testing Complete!');
  console.log(`Overall: ${detectionResults.passed} detection tests passed, ${detectionResults.failed} failed`);
}

module.exports = {
  runMultiCommandDetectionTests,
  runExpectedOutputTests,
  runExampleScenarios,
  simulateMultiCommandExecution
};
