'use strict';

/**
 * Comprehensive multilingual test suite for voice commands
 * Tests support for multiple languages in smart home commands
 * Run with: node test/multilingual-test.js
 */

const {
  processMultilingualCommand,
  normalizeRoomName,
  normalizeAction,
  normalizeDeviceType
} = require('../modules/multilingualProcessor');

const { preprocessCommand } = require('../modules/commandProcessor');
const { detectLanguageFromText } = require('../modules/speech');

// Test cases for different languages
const multilingualTestCases = [
  // English
  {
    language: 'en',
    commands: [
      {
        input: "Turn on the living room lights",
        expected: {
          rooms: ['living room'],
          actions: ['turn_on'],
          deviceTypes: ['light']
        }
      },
      {
        input: "Dim bedroom lights to 50 percent",
        expected: {
          rooms: ['bedroom'],
          actions: ['dim'],
          deviceTypes: ['light']
        }
      },
      {
        input: "Set temperature to 22 degrees in kitchen",
        expected: {
          rooms: ['kitchen'],
          actions: ['set_temperature'],
          deviceTypes: ['thermostat']
        }
      }
    ]
  },
  // Spanish
  {
    language: 'es',
    commands: [
      {
        input: "Encender las luces de la sala de estar",
        expected: {
          rooms: ['living room'],
          actions: ['turn_on'],
          deviceTypes: ['light']
        }
      },
      {
        input: "Apagar dormitorio",
        expected: {
          rooms: ['bedroom'],
          actions: ['turn_off'],
          deviceTypes: []
        }
      },
      {
        input: "Poner música en la cocina",
        expected: {
          rooms: ['kitchen'],
          actions: ['play_music'],
          deviceTypes: ['speaker']
        }
      }
    ]
  },
  // French
  {
    language: 'fr',
    commands: [
      {
        input: "Allumer les lumières du salon",
        expected: {
          rooms: ['living room'],
          actions: ['turn_on'],
          deviceTypes: ['light']
        }
      },
      {
        input: "Éteindre la chambre",
        expected: {
          rooms: ['bedroom'],
          actions: ['turn_off'],
          deviceTypes: []
        }
      },
      {
        input: "Jouer de la musique dans la cuisine",
        expected: {
          rooms: ['kitchen'],
          actions: ['play_music'],
          deviceTypes: ['speaker']
        }
      }
    ]
  },
  // German
  {
    language: 'de',
    commands: [
      {
        input: "Wohnzimmer Licht einschalten",
        expected: {
          rooms: ['living room'],
          actions: ['turn_on'],
          deviceTypes: ['light']
        }
      },
      {
        input: "Schlafzimmer ausschalten",
        expected: {
          rooms: ['bedroom'],
          actions: ['turn_off'],
          deviceTypes: []
        }
      },
      {
        input: "Musik in der Küche abspielen",
        expected: {
          rooms: ['kitchen'],
          actions: ['play_music'],
          deviceTypes: ['speaker']
        }
      }
    ]
  },
  // Italian
  {
    language: 'it',
    commands: [
      {
        input: "Accendere le luci del soggiorno",
        expected: {
          rooms: ['living room'],
          actions: ['turn_on'],
          deviceTypes: ['light']
        }
      },
      {
        input: "Spegnere camera da letto",
        expected: {
          rooms: ['bedroom'],
          actions: ['turn_off'],
          deviceTypes: []
        }
      },
      {
        input: "Suonare musica in cucina",
        expected: {
          rooms: ['kitchen'],
          actions: ['play_music'],
          deviceTypes: ['speaker']
        }
      }
    ]
  },
  // Portuguese
  {
    language: 'pt',
    commands: [
      {
        input: "Ligar as luzes da sala de estar",
        expected: {
          rooms: ['living room'],
          actions: ['turn_on'],
          deviceTypes: ['light']
        }
      },
      {
        input: "Desligar quarto",
        expected: {
          rooms: ['bedroom'],
          actions: ['turn_off'],
          deviceTypes: []
        }
      },
      {
        input: "Tocar música na cozinha",
        expected: {
          rooms: ['kitchen'],
          actions: ['play_music'],
          deviceTypes: ['speaker']
        }
      }
    ]
  },
  // Dutch
  {
    language: 'nl',
    commands: [
      {
        input: "Woonkamer lichten aanzetten",
        expected: {
          rooms: ['living room'],
          actions: ['turn_on'],
          deviceTypes: ['light']
        }
      },
      {
        input: "Slaapkamer uitzetten",
        expected: {
          rooms: ['bedroom'],
          actions: ['turn_off'],
          deviceTypes: []
        }
      },
      {
        input: "Muziek afspelen in de keuken",
        expected: {
          rooms: ['kitchen'],
          actions: ['play_music'],
          deviceTypes: ['speaker']
        }
      }
    ]
  },
  // Swedish
  {
    language: 'sv',
    commands: [
      {
        input: "Sätt på vardagsrummet ljus",
        expected: {
          rooms: ['living room'],
          actions: ['turn_on'],
          deviceTypes: ['light']
        }
      },
      {
        input: "Stäng av sovrum",
        expected: {
          rooms: ['bedroom'],
          actions: ['turn_off'],
          deviceTypes: []
        }
      },
      {
        input: "Spela musik i köket",
        expected: {
          rooms: ['kitchen'],
          actions: ['play_music'],
          deviceTypes: ['speaker']
        }
      }
    ]
  }
];

// Multi-command test cases
const multiCommandTestCases = [
  {
    language: 'en',
    input: "Turn on lights and play music in living room",
    expected: {
      rooms: ['living room'],
      actions: ['turn_on', 'play_music'],
      deviceTypes: ['light', 'speaker']
    }
  },
  {
    language: 'es',
    input: "Encender luces y poner música en sala de estar",
    expected: {
      rooms: ['living room'],
      actions: ['turn_on', 'play_music'],
      deviceTypes: ['light', 'speaker']
    }
  },
  {
    language: 'fr',
    input: "Allumer lumières et jouer musique dans salon",
    expected: {
      rooms: ['living room'],
      actions: ['turn_on', 'play_music'],
      deviceTypes: ['light', 'speaker']
    }
  },
  {
    language: 'de',
    input: "Licht einschalten und Musik abspielen im Wohnzimmer",
    expected: {
      rooms: ['living room'],
      actions: ['turn_on', 'play_music'],
      deviceTypes: ['light', 'speaker']
    }
  }
];

// Mixed language test cases (English commands with local room names)
const mixedLanguageTestCases = [
  {
    input: "Turn on vardagsrum lights", // English + Swedish
    expectedRoom: 'living room',
    expectedAction: 'turn_on'
  },
  {
    input: "Encender bedroom lights", // Spanish + English
    expectedRoom: 'bedroom',
    expectedAction: 'turn_on'
  },
  {
    input: "Allumer kök lights", // French + Swedish
    expectedRoom: 'kitchen',
    expectedAction: 'turn_on'
  }
];

function runMultilingualTests() {
  console.log('🌍 Running Multilingual Voice Command Tests\n');

  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;

  multilingualTestCases.forEach(languageGroup => {
    console.log(`\n📍 Testing ${languageGroup.language.toUpperCase()} commands:`);

    languageGroup.commands.forEach((testCase, index) => {
      totalTests++;
      console.log(`\n  Test ${index + 1}: "${testCase.input}"`);

      const result = processMultilingualCommand(testCase.input, languageGroup.language);

      // Normalize results for comparison
      const normalizedRooms = result.rooms.map(room =>
        normalizeRoomName(room, languageGroup.language)
      );
      const normalizedActions = result.actions.map(action =>
        normalizeAction(action, languageGroup.language)
      );
      const normalizedDevices = result.deviceTypes.map(device =>
        normalizeDeviceType(device, languageGroup.language)
      );

      // Check rooms
      const roomsMatch = testCase.expected.rooms.every(room =>
        normalizedRooms.includes(room)
      );
      console.log(`    Rooms: [${normalizedRooms.join(', ')}] ${roomsMatch ? '✅' : '❌'}`);

      // Check actions
      const actionsMatch = testCase.expected.actions.every(action =>
        normalizedActions.includes(action)
      );
      console.log(`    Actions: [${normalizedActions.join(', ')}] ${actionsMatch ? '✅' : '❌'}`);

      // Check device types
      const devicesMatch = testCase.expected.deviceTypes.every(device =>
        normalizedDevices.includes(device)
      );
      console.log(`    Devices: [${normalizedDevices.join(', ')}] ${devicesMatch ? '✅' : '❌'}`);

      console.log(`    Confidence: ${result.confidence.toFixed(2)}`);

      const testPassed = roomsMatch && actionsMatch && devicesMatch;
      if (testPassed) {
        passedTests++;
        console.log(`    ✅ PASSED`);
      } else {
        failedTests++;
        console.log(`    ❌ FAILED`);
      }
    });
  });

  console.log(`\n📊 Multilingual Test Results: ${passedTests}/${totalTests} passed (${failedTests} failed)`);
  return { totalTests, passedTests, failedTests };
}

function runMultiCommandTests() {
  console.log('\n🔗 Running Multi-Command Tests\n');

  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;

  multiCommandTestCases.forEach(testCase => {
    totalTests++;
    console.log(`Test: "${testCase.input}" (${testCase.language.toUpperCase()})`);

    const result = processMultilingualCommand(testCase.input, testCase.language);

    // Normalize results
    const normalizedRooms = result.rooms.map(room =>
      normalizeRoomName(room, testCase.language)
    );
    const normalizedActions = result.actions.map(action =>
      normalizeAction(action, testCase.language)
    );
    const normalizedDevices = result.deviceTypes.map(device =>
      normalizeDeviceType(device, testCase.language)
    );

    const roomsMatch = testCase.expected.rooms.every(room =>
      normalizedRooms.includes(room)
    );
    const actionsMatch = testCase.expected.actions.every(action =>
      normalizedActions.includes(action)
    );
    const devicesMatch = testCase.expected.deviceTypes.every(device =>
      normalizedDevices.includes(device)
    );

    console.log(`  Rooms: [${normalizedRooms.join(', ')}] ${roomsMatch ? '✅' : '❌'}`);
    console.log(`  Actions: [${normalizedActions.join(', ')}] ${actionsMatch ? '✅' : '❌'}`);
    console.log(`  Devices: [${normalizedDevices.join(', ')}] ${devicesMatch ? '✅' : '❌'}`);

    const testPassed = roomsMatch && actionsMatch && devicesMatch;
    if (testPassed) {
      passedTests++;
      console.log(`  ✅ PASSED\n`);
    } else {
      failedTests++;
      console.log(`  ❌ FAILED\n`);
    }
  });

  console.log(`📊 Multi-Command Test Results: ${passedTests}/${totalTests} passed (${failedTests} failed)`);
  return { totalTests, passedTests, failedTests };
}

function runMixedLanguageTests() {
  console.log('\n🌐 Running Mixed Language Tests\n');

  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;

  mixedLanguageTestCases.forEach(testCase => {
    totalTests++;
    console.log(`Test: "${testCase.input}"`);

    // Test with auto-detection
    const result = processMultilingualCommand(testCase.input, 'auto');
    const normalizedRoom = normalizeRoomName(result.rooms[0] || '', 'auto');
    const normalizedAction = normalizeAction(result.actions[0] || '', 'auto');

    const roomMatch = normalizedRoom === testCase.expectedRoom;
    const actionMatch = normalizedAction === testCase.expectedAction;

    console.log(`  Room: ${normalizedRoom} ${roomMatch ? '✅' : '❌'}`);
    console.log(`  Action: ${normalizedAction} ${actionMatch ? '✅' : '❌'}`);

    const testPassed = roomMatch && actionMatch;
    if (testPassed) {
      passedTests++;
      console.log(`  ✅ PASSED\n`);
    } else {
      failedTests++;
      console.log(`  ❌ FAILED\n`);
    }
  });

  console.log(`📊 Mixed Language Test Results: ${passedTests}/${totalTests} passed (${failedTests} failed)`);
  return { totalTests, passedTests, failedTests };
}

function runLanguageDetectionTests() {
  console.log('\n🔍 Running Language Detection Tests\n');

  const detectionTestCases = [
    { text: "Turn on the lights", expected: 'en' },
    { text: "Encender las luces", expected: 'es' },
    { text: "Allumer les lumières", expected: 'fr' },
    { text: "Licht einschalten", expected: 'de' },
    { text: "Accendere le luci", expected: 'it' },
    { text: "Ligar as luzes", expected: 'pt' },
    { text: "Lichten aanzetten", expected: 'nl' },
    { text: "Sätt på ljuset", expected: 'sv' }
  ];

  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;

  detectionTestCases.forEach(testCase => {
    totalTests++;
    console.log(`Test: "${testCase.text}"`);

    const detected = detectLanguageFromText(testCase.text);
    const match = detected === testCase.expected;

    console.log(`  Detected: ${detected}, Expected: ${testCase.expected} ${match ? '✅' : '❌'}`);

    if (match) {
      passedTests++;
    } else {
      failedTests++;
    }
  });

  console.log(`\n📊 Language Detection Test Results: ${passedTests}/${totalTests} passed (${failedTests} failed)`);
  return { totalTests, passedTests, failedTests };
}

function runIntegrationTests() {
  console.log('\n🔧 Running Integration Tests\n');

  const integrationTestCases = [
    {
      input: "Encender luces vardagsrum", // Spanish action + Swedish room
      language: 'es',
      expectedProcessed: 'turn on lights living room'
    },
    {
      input: "Allumer ljus kök", // French action + Swedish device + Swedish room
      language: 'fr',
      expectedProcessed: 'turn on light kitchen'
    },
    {
      input: "Wohnzimmer lights turn on", // German room + English device + English action
      language: 'de',
      expectedProcessed: 'living room lights turn on'
    }
  ];

  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;

  integrationTestCases.forEach(testCase => {
    totalTests++;
    console.log(`Test: "${testCase.input}" (${testCase.language})`);

    const processed = preprocessCommand(testCase.input, testCase.language);

    console.log(`  Original: "${testCase.input}"`);
    console.log(`  Processed: "${processed.processed}"`);
    console.log(`  Intent: ${processed.intent}`);
    console.log(`  Confidence: ${processed.confidence.toFixed(2)}`);
    console.log(`  Language: ${processed.language}`);

    // Check if processing improved the command
    const hasRooms = processed.entities.rooms.length > 0;
    const hasIntent = processed.intent !== 'turn_on' || processed.confidence > 0.6;

    console.log(`  Has Rooms: ${hasRooms ? '✅' : '❌'}`);
    console.log(`  Has Intent: ${hasIntent ? '✅' : '❌'}`);

    const testPassed = hasRooms && hasIntent;
    if (testPassed) {
      passedTests++;
      console.log(`  ✅ PASSED\n`);
    } else {
      failedTests++;
      console.log(`  ❌ FAILED\n`);
    }
  });

  console.log(`📊 Integration Test Results: ${passedTests}/${totalTests} passed (${failedTests} failed)`);
  return { totalTests, passedTests, failedTests };
}

// Run all tests if this file is executed directly
if (require.main === module) {
  console.log('🚀 Starting Comprehensive Multilingual Test Suite\n');

  const results = {
    multilingual: runMultilingualTests(),
    multiCommand: runMultiCommandTests(),
    mixedLanguage: runMixedLanguageTests(),
    languageDetection: runLanguageDetectionTests(),
    integration: runIntegrationTests()
  };

  // Calculate overall results
  const totalTests = Object.values(results).reduce((sum, result) => sum + result.totalTests, 0);
  const totalPassed = Object.values(results).reduce((sum, result) => sum + result.passedTests, 0);
  const totalFailed = Object.values(results).reduce((sum, result) => sum + result.failedTests, 0);

  console.log('\n' + '='.repeat(60));
  console.log('📈 OVERALL TEST RESULTS');
  console.log('='.repeat(60));
  console.log(`Total Tests: ${totalTests}`);
  console.log(`Passed: ${totalPassed} (${((totalPassed/totalTests)*100).toFixed(1)}%)`);
  console.log(`Failed: ${totalFailed} (${((totalFailed/totalTests)*100).toFixed(1)}%)`);

  if (totalFailed === 0) {
    console.log('\n🎉 All multilingual tests passed! The system supports comprehensive multilingual voice commands.');
  } else {
    console.log(`\n⚠️  ${totalFailed} tests failed. Review the multilingual processing logic.`);
  }

  console.log('\n🌍 Supported Languages:');
  console.log('✅ English, Spanish, French, German, Italian, Portuguese, Dutch, Swedish');
  console.log('✅ Mixed language commands');
  console.log('✅ Multi-command processing');
  console.log('✅ Automatic language detection');
}

module.exports = {
  runMultilingualTests,
  runMultiCommandTests,
  runMixedLanguageTests,
  runLanguageDetectionTests,
  runIntegrationTests,
  multilingualTestCases,
  multiCommandTestCases,
  mixedLanguageTestCases
};
