#!/usr/bin/env node

'use strict';

/**
 * Status Query Integration Example
 * Demonstrates how to integrate the new status query functionality
 * with the existing ChatGPT assistant
 */

const { constructPrompt } = require('../modules/chatgptHelper');
const { handleStatusQuery } = require('../modules/statusQueryHandler');

// Example of how the ChatGPT assistant would handle status queries
class StatusQueryExample {
  constructor() {
    this.homeState = this.getMockHomeState();
  }

  /**
   * Mock home state for demonstration
   */
  getMockHomeState() {
    return {
      devices: {
        'kitchen_light': {
          id: 'kitchen_light',
          name: 'Kitchen Light',
          class: 'light',
          zone: 'kitchen_zone',
          capabilities: ['onoff', 'dim'],
          available: true,
          getCapabilityValue: async cap => {
            if (cap === 'onoff') return true;
            if (cap === 'dim') return 0.75;
            return null;
          }
        },
        'living_room_light': {
          id: 'living_room_light',
          name: 'Vardagsrum Lampa',
          class: 'light',
          zone: 'living_room_zone',
          capabilities: ['onoff', 'dim'],
          available: true,
          getCapabilityValue: async cap => {
            if (cap === 'onoff') return false;
            if (cap === 'dim') return 0.0;
            return null;
          }
        },
        'bedroom_thermostat': {
          id: 'bedroom_thermostat',
          name: 'Bedroom Thermostat',
          class: 'thermostat',
          zone: 'bedroom_zone',
          capabilities: ['target_temperature', 'measure_temperature'],
          available: true,
          getCapabilityValue: async cap => {
            if (cap === 'target_temperature') return 22;
            if (cap === 'measure_temperature') return 21.8;
            return null;
          }
        },
        'garden_speaker': {
          id: 'garden_speaker',
          name: 'Trägården Speaker',
          class: 'speaker',
          zone: 'garden_zone',
          capabilities: ['speaker_playing', 'volume_set'],
          available: false, // Offline
          getCapabilityValue: async cap => {
            if (cap === 'speaker_playing') return false;
            if (cap === 'volume_set') return 0.5;
            return null;
          }
        }
      },
      zones: {
        'kitchen_zone': { id: 'kitchen_zone', name: 'Kitchen' },
        'living_room_zone': { id: 'living_room_zone', name: 'Vardagsrummet' },
        'bedroom_zone': { id: 'bedroom_zone', name: 'Bedroom' },
        'garden_zone': { id: 'garden_zone', name: 'Trägården' }
      }
    };
  }

  /**
   * Mock ChatGPT API call
   */
  async mockChatGPTCall(prompt) {
    // Simulate ChatGPT parsing the command
    if (prompt.includes('status of kitchen lights')) {
      return {
        query_type: 'status',
        device_type: 'light',
        room: 'kitchen'
      };
    }

    if (prompt.includes('all devices in bedroom')) {
      return {
        query_type: 'status',
        room: 'bedroom'
      };
    }

    if (prompt.includes('vardagsrummet')) {
      return {
        query_type: 'status',
        room: 'vardagsrummet'
      };
    }

    if (prompt.includes('trädgården')) {
      return {
        query_type: 'status',
        room: 'trädgården'
      };
    }

    if (prompt.includes('all devices') || prompt.includes('alla enheter')) {
      return {
        query_type: 'status',
        scope: 'global'
      };
    }

    // Default control command
    return {
      room: 'kitchen',
      command: 'turn_on'
    };
  }

  /**
   * Mock LLM function for semantic matching
   */
  async mockLLMFunction(prompt) {
    if (prompt.includes('"vardagsrummet"') && prompt.includes('"Vardagsrummet"')) {
      return JSON.stringify({
        match: 'Vardagsrummet',
        confidence: 0.95,
        reasoning: 'Exact match with Swedish room name'
      });
    }

    if (prompt.includes('"trädgården"') && prompt.includes('"Trägården"')) {
      return JSON.stringify({
        match: 'Trägården',
        confidence: 0.87,
        reasoning: 'Character variation match (ä vs ä)'
      });
    }

    if (prompt.includes('"kitchen"') && prompt.includes('"Kitchen"')) {
      return JSON.stringify({
        match: 'Kitchen',
        confidence: 1.0,
        reasoning: 'Exact match'
      });
    }

    if (prompt.includes('"bedroom"') && prompt.includes('"Bedroom"')) {
      return JSON.stringify({
        match: 'Bedroom',
        confidence: 1.0,
        reasoning: 'Exact match'
      });
    }

    return JSON.stringify({
      match: null,
      confidence: 0.0,
      reasoning: 'No semantic match found'
    });
  }

  /**
   * Process a user command (control or status query)
   */
  async processCommand(userInput, language = 'en') {
    console.log(`\n🎤 User: "${userInput}" (${language})`);
    console.log('='.repeat(60));

    // Step 1: Create ChatGPT prompt
    const prompt = constructPrompt(userInput, this.homeState);
    console.log('📝 ChatGPT Prompt created');

    // Step 2: Get ChatGPT response
    const chatGPTResponse = await this.mockChatGPTCall(prompt);
    console.log('🤖 ChatGPT Response:', JSON.stringify(chatGPTResponse, null, 2));

    // Step 3: Check if it's a status query
    if (chatGPTResponse.query_type === 'status') {
      console.log('🔍 Detected as STATUS QUERY');

      // Step 4: Process status query
      const statusResult = await handleStatusQuery(
        userInput,
        language,
        this.homeState,
        this.mockLLMFunction.bind(this),
        { includeDetails: true, maxDevices: 20 }
      );

      if (statusResult.success) {
        console.log('✅ Status Query Successful');
        console.log('\n📊 Formatted Response:');
        console.log(statusResult.formattedText);
        return statusResult.formattedText;
      }
      console.log('❌ Status Query Failed:', statusResult.error);
      return `Sorry, I couldn't get the status: ${statusResult.error}`;

    }
    console.log('🎛️ Detected as CONTROL COMMAND');
    console.log('(Would execute control command here)');
    return 'Control command would be executed';

  }

  /**
   * Run demonstration
   */
  async runDemo() {
    console.log('🏠 Multilingual Status Query Integration Demo');
    console.log('This demonstrates how status queries integrate with the ChatGPT assistant\n');

    const testCommands = [
      // English status queries
      { input: 'What\'s the status of kitchen lights?', language: 'en' },
      { input: 'Show me all devices in the bedroom', language: 'en' },
      { input: 'Tell me about all devices', language: 'en' },

      // Swedish status queries
      { input: 'Vad är status på vardagsrummet?', language: 'sv' },
      { input: 'Visa enheter i trädgården', language: 'sv' },

      // Mixed: Control command for comparison
      { input: 'Turn on kitchen lights', language: 'en' }
    ];

    for (const test of testCommands) {
      await this.processCommand(test.input, test.language);
      console.log(`\n${'─'.repeat(80)}\n`);
    }

    console.log('✨ Demo completed!');
    console.log('\n📋 Summary of Features Demonstrated:');
    console.log('• ✅ Multilingual status query detection');
    console.log('• ✅ Advanced room name matching (character variations)');
    console.log('• ✅ Device status retrieval and formatting');
    console.log('• ✅ Multilingual response formatting');
    console.log('• ✅ Integration with existing ChatGPT assistant');
    console.log('• ✅ Fallback to control commands when not a status query');
  }
}

// Run the demo
const demo = new StatusQueryExample();
demo.runDemo().catch(console.error);
