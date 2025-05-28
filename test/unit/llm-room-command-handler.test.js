\
'use strict';

const assert = require('assert');
const sinon = require('sinon');
const ChatGPTAssistant = require('../../app'); // Adjust path as needed

// Mock Homey
let Homey;
try {
  Homey = require('homey');
} catch (e) {
  Homey = {
    App: class {
      constructor() {
        this.log = sinon.stub();
        this.error = sinon.stub();
        this.homey = {
          app: this,
          __: (key, tokens) => { // Mock for i18n
            if (typeof tokens === 'object') {
              return key + JSON.stringify(tokens);
            }
            return key + (tokens || '');
          },
          settings: {
            get: sinon.stub(),
            set: sinon.stub(),
            unset: sinon.stub(),
            on: sinon.stub(),
          },
          notifications: {
            createNotification: sinon.stub(),
          },
          speechInput: {
            on: sinon.stub(),
          },
          flow: {
            getActionCard: sinon.stub().returnsThis(),
            getConditionCard: sinon.stub().returnsThis(),
            getTriggerCard: sinon.stub().returnsThis(),
            register: sinon.stub(),
            registerRunListener: sinon.stub(),
          }
        };
      }
    }
  };
}


describe('ChatGPTAssistant - LLM Room Command Handling', function() {
  let app;
  let mockHomeState;
  let mockParseCommand;

  beforeEach(function() {
    app = new ChatGPTAssistant();
    
    // Stub essential methods if not already stubbed by mock Homey.App
    if (!app.log) app.log = sinon.stub();
    if (!app.error) app.error = sinon.stub();

    mockHomeState = {
      zones: {
        'zone-1': { id: 'zone-1', name: 'Living Room' },
        'zone-2': { id: 'zone-2', name: 'Bedroom' },
        'zone-3': { id: 'zone-3', name: 'Kitchen' },
        'zone-4': { id: 'zone-4', name: 'Uterummet' }, // Swedish: Conservatory/Sunroom
        'zone-5': { id: 'zone-5', name: 'Trädgården' }, // Swedish: Garden
        'zone-6': { id: 'zone-6', name: 'Kontor' }, // Swedish: Office
      },
      devices: {} // Add mock devices if needed for command execution part (later)
    };

    // Mock getHomeState to return our controlled state
    sinon.stub(app, 'getHomeState').resolves(mockHomeState);

    // Mock the LLM function (chatgpt.parseCommand)
    mockParseCommand = sinon.stub();
    app.chatgpt = { parseCommand: mockParseCommand };

    // Initialize lastDetectedLanguage
    app.lastDetectedLanguage = 'en';
  });

  afterEach(function() {
    sinon.restore();
  });

  it('should correctly match "Uterummet" (Swedish) to "Uterummet" zone using LLM', async function() {
    app.lastDetectedLanguage = 'sv';
    const inputRoomName = 'Uterummet';
    mockParseCommand.resolves('Uterummet'); // Simulate LLM matching to "Uterummet"

    const jsonCommand = { room: inputRoomName, command: 'turn_on_lights' };
    
    // We expect handleRoomCommand to throw an error because the device execution part is missing.
    // We will catch this and verify targetZoneIds before the error.
    try {
      await app.handleRoomCommand(jsonCommand);
    } catch (error) {
      // Verify that the LLM was called with the correct room name
      assert(mockParseCommand.calledOnce, 'LLM (parseCommand) should have been called.');
      
      // Retrieve the log call that contains the targetZoneIds
      const roomMatchingLog = app.log.getCalls().find(call => call.args[0].startsWith('Room matching:'));
      assert(roomMatchingLog, 'Room matching log not found');
      
      // Extract targetZoneIds from the log (this is a bit indirect, but necessary given the current structure)
      // The log is: `Room matching: \"${inputRoomName}\" -> zones:`, targetZoneIds.map(id => zones[id] ? zones[id].name : 'unknown zone')
      // We are interested in the second argument of this log call.
      const loggedMatchedZones = roomMatchingLog.args[1];
      assert.deepStrictEqual(loggedMatchedZones, ['Uterummet'], 'Incorrect zone name logged for Uterummet');
      
      // Check the error message to confirm it's the one we expect
      assert(error.message.includes(`No room matching \\"${inputRoomName}\\" found after LLM attempt.`) || error.message.includes('The rest of the function to execute commands on devices in these zones should follow here.'), 'Function did not throw the expected error or threw an unexpected one.');
      // This assertion is a bit loose because the function is incomplete.
      // The main goal is to check if targetZoneIds was populated correctly before the throw.
    }
    
    // More direct check if we could access targetZoneIds (requires modifying handleRoomCommand or test setup)
    // For now, we rely on logs and the fact that the error about "No room matching" means targetZoneIds was empty.
    // If it *was* populated, the error would be different (or no error if command execution was present).
    
    // To properly test targetZoneIds, we'd ideally want handleRoomCommand to return it or store it on `this`.
    // Let's assume for now that if the "No room matching" error for the *inputRoomName* is NOT thrown, it means a match was found.
    // And if it *is* thrown, it means no match.

    // Re-evaluating the assertion based on the current code:
    // If a match is found, targetZoneIds will have one ID.
    // The error "No room matching..." is thrown if targetZoneIds.length === 0.
    // So, if that error is NOT thrown, it implies a match.

    // Let's refine the test structure. We need to inspect targetZoneIds.
    // The current `handleRoomCommand` doesn't return `targetZoneIds`.
    // It throws an error if `targetZoneIds` is empty *after* the LLM attempt.
    // Or it would proceed to execute commands (which is not fully implemented).

    // For this test, if 'Uterummet' is matched, targetZoneIds should contain 'zone-4'.
    // The error "No room matching..." should NOT be thrown for 'Uterummet'.
    // Instead, it might throw later or complete if the rest of the function was there.

    // Let's spy on the part of the code that would use targetZoneIds if it were complete.
    // Since it's not, we'll check that the "No room matching" error specific to an empty targetZoneIds is NOT thrown.
    let thrownError = null;
    try {
      await app.handleRoomCommand(jsonCommand);
    } catch (e) {
      thrownError = e;
    }

    assert(mockParseCommand.calledOnce, 'LLM (parseCommand) should have been called.');
    // Check that the specific error for "No room matching" for the *inputRoomName* was NOT thrown
    // This implies targetZoneIds was populated.
    if (thrownError) {
         assert(!thrownError.message.startsWith(`No room matching \\"${inputRoomName}\\" found after LLM attempt.`), 
           `Expected a match for '${inputRoomName}', but got 'no match' error: ${thrownError.message}`);
    }
    // We also need to verify that the *correct* zone was matched.
    // The log `LLM Normalized room name: "${inputRoomName}" -> "${matchedRoomName}"` is key.
    const normalizationLog = app.log.getCalls().find(call => call.args[0].includes(`LLM Normalized room name: "${inputRoomName}"`));
    assert(normalizationLog, 'Normalization log not found');
    assert(normalizationLog.args[0].includes(`-> "Uterummet"`), 'LLM did not normalize to "Uterummet"');
  });

  it('should correctly match "Trädgården" (Swedish) to "Trädgården" zone using LLM', async function() {
    app.lastDetectedLanguage = 'sv';
    const inputRoomName = 'Trädgården';
    mockParseCommand.resolves('Trädgården');

    const jsonCommand = { room: inputRoomName, command: 'check_temperature' };
    let thrownError = null;
    try {
      await app.handleRoomCommand(jsonCommand);
    } catch (e) {
      thrownError = e;
    }
    assert(mockParseCommand.calledOnce);
    if (thrownError) {
        assert(!thrownError.message.startsWith(`No room matching \\"${inputRoomName}\\" found after LLM attempt.`), 
            `Expected a match for '${inputRoomName}', but got 'no match' error: ${thrownError.message}`);
    }
    const normalizationLog = app.log.getCalls().find(call => call.args[0].includes(`LLM Normalized room name: "${inputRoomName}"`));
    assert(normalizationLog, 'Normalization log not found for Trädgården');
    assert(normalizationLog.args[0].includes(`-> "Trädgården"`), 'LLM did not normalize to "Trädgården"');
  });

  it('should use "en" as default language if lastDetectedLanguage is not set', async function() {
    app.lastDetectedLanguage = null; // or undefined
    const inputRoomName = 'Living Room';
    mockParseCommand.resolves('Living Room');
    
    const jsonCommand = { room: inputRoomName, command: 'turn_on_tv' };
    await app.handleRoomCommand(jsonCommand).catch(() => {}); // Catch expected throw due to incomplete function

    assert(mockParseCommand.calledOnce);
    const llmCallArgs = mockParseCommand.firstCall.args[0]; // The prompt string
    // We need to check the prompt construction if language is part of it,
    // or how normalizeRoomNameAdvanced uses the language.
    // For now, check that the log indicates the language used.
    const attemptLog = app.log.getCalls().find(call => call.args[0].startsWith('Attempting to normalize room:'));
    assert(attemptLog, 'Attempt log not found');
    assert(attemptLog.args[0].includes('Language: en'), 'Default language was not logged as "en"');
  });

  it('should handle LLM returning a slightly different but valid room name (case difference)', async function() {
    app.lastDetectedLanguage = 'en';
    const inputRoomName = 'living room'; // input is lowercase
    mockParseCommand.resolves('Living Room'); // LLM returns title case

    const jsonCommand = { room: inputRoomName, command: 'dim_lights' };
    let thrownError = null;
    try {
      await app.handleRoomCommand(jsonCommand);
    } catch (e) {
      thrownError = e;
    }
    assert(mockParseCommand.calledOnce);
     if (thrownError) {
        assert(!thrownError.message.startsWith(`No room matching \\"${inputRoomName}\\" found after LLM attempt.`), 
            `Expected a match for '${inputRoomName}', but got 'no match' error: ${thrownError.message}`);
    }
    const normalizationLog = app.log.getCalls().find(call => call.args[0].includes(`LLM Normalized room name: "${inputRoomName}"`));
    assert(normalizationLog, 'Normalization log not found for case difference test');
    assert(normalizationLog.args[0].includes(`-> "Living Room"`), 'LLM did not normalize correctly for case difference');
  });

  it('should log a warning if LLM matches a room name not in zones', async function() {
    app.lastDetectedLanguage = 'en';
    const inputRoomName = 'Attic';
    mockParseCommand.resolves('Attic'); // LLM matches "Attic", but it's not in mockHomeState.zones

    const jsonCommand = { room: inputRoomName, command: 'clean_floor' };
    let thrownError = null;
    try {
      await app.handleRoomCommand(jsonCommand);
    } catch (e) {
      thrownError = e;
    }
    
    assert(mockParseCommand.calledOnce);
    const warningLog = app.log.getCalls().find(call => call.args[0].startsWith('Warning: Matched room name'));
    assert(warningLog, 'Warning log for non-existent matched zone not found');
    assert(warningLog.args[0].includes('"Attic"'), 'Warning log does not mention "Attic"');
    
    // In this case, targetZoneIds should be empty, so the "No room matching" error IS expected.
    assert(thrownError, "Expected an error to be thrown");
    assert(thrownError.message.startsWith(`No room matching \\"${inputRoomName}\\" found after LLM attempt.`), 
        `Expected 'no match' error for '${inputRoomName}' after LLM matched non-existent zone, but got: ${thrownError.message}`);
  });

  it('should throw an error if LLM cannot normalize the room name', async function() {
    app.lastDetectedLanguage = 'fr';
    const inputRoomName = 'Chambre Inconnue'; // Unknown room
    mockParseCommand.resolves(null); // LLM returns no match

    const jsonCommand = { room: inputRoomName, command: 'turn_on_music' };
    
    await assert.rejects(
      app.handleRoomCommand(jsonCommand),
      Error,
      `No room matching \\"${inputRoomName}\\" found after LLM attempt. Available rooms: Living Room, Bedroom, Kitchen, Uterummet, Trädgården, Kontor`
    );
    
    assert(mockParseCommand.calledOnce);
    const logMessage = app.log.getCalls().find(call => call.args[0] === `LLM could not normalize room name: \\"${inputRoomName}\\".`);
    assert(logMessage, 'Log message for LLM failing to normalize not found.');
  });

  it('should throw an error if inputRoomName is not provided', async function() {
    const jsonCommand = { command: 'turn_on_lights' }; // No room property
    
    await assert.rejects(
      app.handleRoomCommand(jsonCommand),
      Error,
      'No room name specified in the command.'
    );
    const logMessage = app.log.getCalls().find(call => call.args[0] === 'No room name provided in jsonCommand for LLM matching.');
    assert(logMessage, 'Log message for missing room name not found.');
  });
  
  it('should handle errors from normalizeRoomNameAdvanced (e.g., LLM API failure)', async function() {
    app.lastDetectedLanguage = 'de';
    const inputRoomName = 'Wohnzimmer';
    const llmError = new Error('LLM API unavailable');
    mockParseCommand.rejects(llmError); // Simulate LLM function throwing an error

    const jsonCommand = { room: inputRoomName, command: 'set_temperature' };

    // Since the error is caught inside handleRoomCommand and logged,
    // and then targetZoneIds remains empty, it should throw the "No room matching" error.
    await assert.rejects(
      app.handleRoomCommand(jsonCommand),
      Error,
      `No room matching \\"${inputRoomName}\\" found after LLM attempt.` // Error message will include available rooms
    );

    assert(mockParseCommand.calledOnce);
    const errorLog = app.error.getCalls().find(call => call.args[0].startsWith('Error during advanced room name normalization'));
    assert(errorLog, 'Error log for normalization failure not found');
    assert.deepStrictEqual(errorLog.args[1], llmError, 'The correct error from LLM was not logged');
  });

  it('should correctly match "Kontor" (Swedish) to "Kontor" zone using LLM', async function() {
    app.lastDetectedLanguage = 'sv';
    const inputRoomName = 'Kontoret'; // User might say "Kontoret" (the office)
    mockParseCommand.resolves('Kontor'); // LLM normalizes to "Kontor"

    const jsonCommand = { room: inputRoomName, command: 'turn_on_computer' };
    let thrownError = null;
    try {
      await app.handleRoomCommand(jsonCommand);
    } catch (e) {
      thrownError = e;
    }
    assert(mockParseCommand.calledOnce);
    if (thrownError) {
        assert(!thrownError.message.startsWith(`No room matching \\"${inputRoomName}\\" found after LLM attempt.`), 
            `Expected a match for '${inputRoomName}', but got 'no match' error: ${thrownError.message}`);
    }
    const normalizationLog = app.log.getCalls().find(call => call.args[0].includes(`LLM Normalized room name: "${inputRoomName}"`));
    assert(normalizationLog, 'Normalization log not found for Kontor');
    assert(normalizationLog.args[0].includes(`-> "Kontor"`), 'LLM did not normalize to "Kontor"');
  });

  it('should pass the correct availableRoomsArray to normalizeRoomNameAdvanced', async function() {
    app.lastDetectedLanguage = 'en';
    const inputRoomName = 'Living Room';
    
    // We need to spy on normalizeRoomNameAdvanced to check its arguments.
    // This is tricky because it's imported. We'll check the log that shows available rooms.
    // const normalizeSpy = sinon.spy(require('../../modules/multilingualProcessor'), 'normalizeRoomNameAdvanced');
    // This approach won't work easily with how modules are cached.

    mockParseCommand.resolves('Living Room');
    const jsonCommand = { room: inputRoomName, command: 'play_music' };
    
    await app.handleRoomCommand(jsonCommand).catch(() => {});

    const attemptLog = app.log.getCalls().find(call => call.args[0].startsWith('Attempting to normalize room:'));
    assert(attemptLog, 'Attempt log not found');
    const loggedAvailableRooms = attemptLog.args[0].substring(attemptLog.args[0].indexOf('Available rooms: ') + 'Available rooms: '.length);
    const expectedAvailableRooms = Object.values(mockHomeState.zones).map(zone => zone.name).join(', ');
    assert.strictEqual(loggedAvailableRooms, expectedAvailableRooms, 'Logged available rooms do not match expected');
    
    // normalizeSpy.restore(); // if we could spy
  });

});
