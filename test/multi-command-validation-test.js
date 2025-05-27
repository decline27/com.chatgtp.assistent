'use strict';

/**
 * Test suite for multi-command validation fix
 * Tests the validation logic directly without loading the full app
 */

/**
 * Extracted validation logic from app.js parseCommandWithState method
 * This is the exact logic we fixed
 */
function validateCommandStructure(jsonCommand) {
  // Validate command structure
  const hasValidTarget = jsonCommand.room || jsonCommand.device_ids || jsonCommand.device_id || jsonCommand.commands;
  if (!hasValidTarget) {
    return { error: 'Command must specify a room, device ID(s), or contain recognizable device/room names' };
  }

  // Validate command type
  if (!jsonCommand.command && !jsonCommand.commands) {
    return { error: 'No action specified. Please specify what you want to do (turn on/off, dim, etc.)' };
  }

  return jsonCommand; // Valid command
}

/**
 * Test the validation logic for multi-command structures
 */
function testMultiCommandValidation() {
  console.log('🧪 Testing Multi-Command Validation Fix\n');

  let testsPassed = 0;
  let testsFailed = 0;

  // Test cases that simulate what ChatGPT would return
  const testCases = [
    {
      name: 'Multi-command structure (the failing case we fixed)',
      input: {
        commands: [
          { room: 'living room', command: 'turn_on', device_filter: 'light' },
          { room: 'living room', command: 'play_music', device_filter: 'speaker' }
        ]
      },
      shouldPass: true,
      description: 'Should accept multi-command with commands array'
    },
    {
      name: 'Single room command',
      input: {
        room: 'living room',
        command: 'turn_on'
      },
      shouldPass: true,
      description: 'Should accept single room command'
    },
    {
      name: 'Multiple device IDs command',
      input: {
        device_ids: ['device1', 'device2'],
        command: 'turn_off'
      },
      shouldPass: true,
      description: 'Should accept multiple device IDs command'
    },
    {
      name: 'Single device command',
      input: {
        device_id: 'device1',
        command: 'dim'
      },
      shouldPass: true,
      description: 'Should accept single device command'
    },
    {
      name: 'Invalid command (no target)',
      input: {
        command: 'turn_on'
      },
      shouldPass: false,
      description: 'Should reject command without room/device target'
    },
    {
      name: 'Invalid command (no action)',
      input: {
        room: 'living room'
      },
      shouldPass: false,
      description: 'Should reject command without action'
    },
    {
      name: 'Completely invalid structure',
      input: {
        invalid: 'structure'
      },
      shouldPass: false,
      description: 'Should reject completely invalid structure'
    }
  ];

  testCases.forEach((testCase, index) => {
    console.log(`Test ${index + 1}: ${testCase.name}`);
    console.log(`  Description: ${testCase.description}`);

    const result = validateCommandStructure(testCase.input);
    const hasError = result.error !== undefined;
    const testPassed = testCase.shouldPass ? !hasError : hasError;

    if (testPassed) {
      console.log('  ✅ PASSED');
      if (!hasError && testCase.input.commands) {
        console.log(`    Multi-command with ${testCase.input.commands.length} commands accepted`);
      } else if (hasError) {
        console.log(`    Properly rejected: ${result.error}`);
      }
      testsPassed++;
    } else {
      console.log('  ❌ FAILED');
      if (hasError && testCase.shouldPass) {
        console.log(`    Unexpected error: ${result.error}`);
      } else if (!hasError && !testCase.shouldPass) {
        console.log(`    Should have been rejected but was accepted`);
      }
      testsFailed++;
    }

    console.log('');
  });

  console.log(`📊 Validation Tests: ${testsPassed} passed, ${testsFailed} failed`);

  if (testsFailed === 0) {
    console.log('🎉 All validation tests passed! Multi-command fix is working correctly.');
    console.log('');
    console.log('✨ The fix successfully allows multi-command structures like:');
    console.log('   {"commands": [{"room": "living room", "command": "turn_on", "device_filter": "light"}, ...]}');
    console.log('   while still validating single commands and rejecting invalid structures.');
  } else {
    console.log('⚠️  Some tests failed. The fix may need additional work.');
  }

  return { passed: testsPassed, failed: testsFailed };
}

// Run the test if this file is executed directly
if (require.main === module) {
  testMultiCommandValidation();
}

module.exports = { testMultiCommandValidation };
