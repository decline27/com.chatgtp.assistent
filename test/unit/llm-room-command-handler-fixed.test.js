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

    // Mock the LLM function (chatgpt.parseCommand) - this will be called via our simpleLLMFunction wrapper
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
    
    // Mock parseCommand to return a structured response that our simpleLLMFunction can extract from
    mockParseCommand.resolves({
      room: 'Uterummet',
      command: 'status'
    });

    const jsonCommand = { room: inputRoomName, command: 'turn_on_lights' };
    
    // We expect handleRoomCommand to throw an error because the device execution part is missing.
    // We will catch this and verify room normalization worked before the error.
    let thrownError = null;
    try {
      await app.handleRoomCommand(jsonCommand);
    } catch (error) {
      thrownError = error;
    }

    // Verify room normalization succeeded by checking the logs
    const logCalls = app.log.getCalls();
    const successfulMatchLog = logCalls.find(call => 
      call.args[0] && call.args[0].includes('🎯 Advanced room match:') && 
      call.args[0].includes('Uterummet')
    );
    
    assert(successfulMatchLog, 'Room normalization should have succeeded for Uterummet');
    assert(successfulMatchLog.args[0].includes('exact'), 'Should be an exact match for Uterummet');
    
    // Check that normalizeRoomNameAdvanced was used (it logs this specific format)
    const normalizedLog = logCalls.find(call => 
      call.args[0] && call.args[0].includes('🎯 Advanced room match:')
    );
    assert(normalizedLog, 'normalizeRoomNameAdvanced should have been called');
    
    // The error should be related to device execution, not room normalization
    if (thrownError) {
      assert(thrownError.message.includes('The rest of the function to execute commands') || 
             thrownError.message.includes('device') ||
             thrownError.message.includes('execution'), 
             'Function should fail on device execution, not room normalization. Error: ' + thrownError.message);
    }
  });

  it('should correctly match "Trädgården" (Swedish) to "Trädgården" zone using LLM', async function() {
    app.lastDetectedLanguage = 'sv';
    const inputRoomName = 'Trädgården';
    mockParseCommand.resolves({
      room: 'Trädgården',
      command: 'status'
    });

    const jsonCommand = { room: inputRoomName, command: 'check_temperature' };
    let thrownError = null;
    try {
      await app.handleRoomCommand(jsonCommand);
    } catch (e) {
      thrownError = e;
    }
    
    // Verify room normalization succeeded by checking the logs
    const logCalls = app.log.getCalls();
    const successfulMatchLog = logCalls.find(call => 
      call.args[0] && call.args[0].includes('🎯 Advanced room match:') && 
      call.args[0].includes('Trädgården')
    );
    
    assert(successfulMatchLog, 'Room normalization should have succeeded for Trädgården');
    
    // The error should be related to device execution, not room normalization
    if (thrownError) {
      assert(thrownError.message.includes('The rest of the function to execute commands') || 
             thrownError.message.includes('device') ||
             thrownError.message.includes('execution'), 
             'Function should fail on device execution, not room normalization. Error: ' + thrownError.message);
    }
  });

  it('should use "en" as default language if lastDetectedLanguage is not set', async function() {
    app.lastDetectedLanguage = null; // or undefined
    const inputRoomName = 'Living Room';
    mockParseCommand.resolves({
      room: 'Living Room',
      command: 'status'
    });
    
    const jsonCommand = { room: inputRoomName, command: 'turn_on_tv' };
    await app.handleRoomCommand(jsonCommand).catch(() => {}); // Catch expected throw due to incomplete function

    // Check that normalizeRoomNameAdvanced was called and logged with default language
    const attemptLog = app.log.getCalls().find(call => call.args[0].startsWith('Attempting to normalize room:'));
    assert(attemptLog, 'Attempt log not found');
    assert(attemptLog.args[0].includes('Language: en'), 'Default language was not logged as "en"');
  });

  it('should handle LLM returning a slightly different but valid room name (case difference)', async function() {
    app.lastDetectedLanguage = 'en';
    const inputRoomName = 'living room'; // input is lowercase
    mockParseCommand.resolves({
      room: 'Living Room', // LLM returns title case in structured response
      command: 'status'
    });

    const jsonCommand = { room: inputRoomName, command: 'dim_lights' };
    let thrownError = null;
    try {
      await app.handleRoomCommand(jsonCommand);
    } catch (e) {
      thrownError = e;
    }
    
    // Verify room normalization succeeded by checking the logs
    const logCalls = app.log.getCalls();
    const successfulMatchLog = logCalls.find(call => 
      call.args[0] && call.args[0].includes('🎯 Advanced room match:') && 
      call.args[0].includes('Living Room')
    );
    
    assert(successfulMatchLog, 'Room normalization should have succeeded for case difference test');
    
    // The error should be related to device execution, not room normalization
    if (thrownError) {
      assert(thrownError.message.includes('The rest of the function to execute commands') || 
             thrownError.message.includes('device') ||
             thrownError.message.includes('execution'), 
             'Function should fail on device execution, not room normalization. Error: ' + thrownError.message);
    }
  });

  it('should log a warning if LLM matches a room name not in zones', async function() {
    app.lastDetectedLanguage = 'en';
    const inputRoomName = 'Attic';
    mockParseCommand.resolves({
      room: 'Attic', // LLM matches "Attic", but it's not in mockHomeState.zones
      command: 'status'
    });

    const jsonCommand = { room: inputRoomName, command: 'clean_floor' };
    let thrownError = null;
    try {
      await app.handleRoomCommand(jsonCommand);
    } catch (e) {
      thrownError = e;
    }
    
    // Since normalizeRoomNameAdvanced handles the LLM integration and the room doesn't exist,
    // we should get a "no match" error
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

    // Since the error is caught inside normalizeRoomNameAdvanced and logged,
    // and then no match is found, it should throw the "No room matching" error.
    await assert.rejects(
      app.handleRoomCommand(jsonCommand),
      Error,
      `No room matching \\"${inputRoomName}\\" found after LLM attempt.` // Error message will include available rooms
    );
  });

  it('should correctly match "Kontor" (Swedish) to "Kontor" zone using LLM', async function() {
    app.lastDetectedLanguage = 'sv';
    const inputRoomName = 'Kontoret'; // User might say "Kontoret" (the office)
    mockParseCommand.resolves({
      room: 'Kontor', // LLM normalizes to "Kontor"
      command: 'status'
    });

    const jsonCommand = { room: inputRoomName, command: 'turn_on_computer' };
    let thrownError = null;
    try {
      await app.handleRoomCommand(jsonCommand);
    } catch (e) {
      thrownError = e;
    }
    
    // Verify room normalization succeeded by checking the logs
    const logCalls = app.log.getCalls();
    const successfulMatchLog = logCalls.find(call => 
      call.args[0] && call.args[0].includes('🎯 Advanced room match:') && 
      call.args[0].includes('Kontor')
    );
    
    assert(successfulMatchLog, 'Room normalization should have succeeded for Kontor');
    
    // The error should be related to device execution, not room normalization
    if (thrownError) {
      assert(thrownError.message.includes('The rest of the function to execute commands') || 
             thrownError.message.includes('device') ||
             thrownError.message.includes('execution'), 
             'Function should fail on device execution, not room normalization. Error: ' + thrownError.message);
    }
  });

  it('should pass the correct availableRoomsArray to normalizeRoomNameAdvanced', async function() {
    app.lastDetectedLanguage = 'en';
    const inputRoomName = 'Living Room';
    
    mockParseCommand.resolves({
      room: 'Living Room',
      command: 'status'
    });
    const jsonCommand = { room: inputRoomName, command: 'play_music' };
    
    await app.handleRoomCommand(jsonCommand).catch(() => {});

    const attemptLog = app.log.getCalls().find(call => call.args[0].startsWith('Attempting to normalize room:'));
    assert(attemptLog, 'Attempt log not found');
    const loggedAvailableRooms = attemptLog.args[0].substring(attemptLog.args[0].indexOf('Available rooms: ') + 'Available rooms: '.length);
    const expectedAvailableRooms = Object.values(mockHomeState.zones).map(zone => zone.name).join(', ');
    assert.strictEqual(loggedAvailableRooms, expectedAvailableRooms, 'Logged available rooms do not match expected');
  });

});
