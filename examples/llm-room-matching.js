'use strict';

/**
 * Example of using LLM-powered room matching with ChatGPT
 * This demonstrates how to integrate the advanced matching system
 * with the ChatGPT API for semantic understanding
 */

const { comprehensiveRoomMatch } = require('../modules/advancedMultilingualMatcher');
const { normalizeRoomNameAdvanced } = require('../modules/multilingualProcessor');
const https = require('https');

// Sample available rooms (from your Homey system)
const availableRooms = [
  'Home', 'Andra våningen', 'Vardagsrummet', 'Kök', 'Anna sovrum',
  'Trägården', 'Första våningen', 'Hallen', 'Tv Rummet', 'Kontoret',
  'Feng Shuil', 'Tvättstuga', 'Jakob sovrum', 'Uppfarten', 'Oliver sovrum',
  'Uterummet', 'Elliot Sovrum', 'Huvudsovrum', 'Utomhus', 'Teknikrum'
];

// Sample test cases
const testCases = [
  { input: 'garden', language: 'en' },
  { input: 'living room', language: 'en' },
  { input: 'trädgården', language: 'sv' },
  { input: 'bathroom', language: 'en' },
  { input: 'office', language: 'en' }
];

/**
 * Call ChatGPT API for semantic room matching
 * @param {string} prompt - The prompt to send to ChatGPT
 * @returns {Promise<string>} ChatGPT response
 */
async function callChatGPT(prompt) {
  // Replace with your actual API key
  const apiKey = process.env.OPENAI_API_KEY || 'your-api-key-here';

  // If no API key, use mock response
  if (apiKey === 'your-api-key-here') {
    console.log('⚠️ Using mock ChatGPT response (set OPENAI_API_KEY env variable for real API calls)');
    return mockChatGPTResponse(prompt);
  }

  const requestData = JSON.stringify({
    model: 'gpt-3.5-turbo',
    messages: [
      { role: 'system', content: 'You are a multilingual smart home assistant that helps match room names across languages.' },
      { role: 'user', content: prompt }
    ],
    temperature: 0.3,
    max_tokens: 150
  });

  const options = {
    hostname: 'api.openai.com',
    path: '/v1/chat/completions',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'Content-Length': Buffer.byteLength(requestData)
    }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          if (response.error) {
            reject(new Error(`ChatGPT API error: ${response.error.message}`));
            return;
          }
          resolve(response.choices[0].message.content);
        } catch (error) {
          reject(new Error(`Failed to parse ChatGPT response: ${error.message}`));
        }
      });
    });

    req.on('error', error => reject(error));
    req.write(requestData);
    req.end();
  });
}

/**
 * Mock ChatGPT response for testing without API key
 * @param {string} prompt - The prompt sent to ChatGPT
 * @returns {string} Mock response
 */
function mockChatGPTResponse(prompt) {
  // Extract room name from prompt
  const roomMatch = prompt.match(/Input room name: "([^"]+)"/);
  const roomName = roomMatch ? roomMatch[1] : '';

  // Simple mock logic
  if (roomName === 'garden') {
    return JSON.stringify({
      match: 'Trägården',
      confidence: 0.9,
      reasoning: 'Garden is the English translation of Swedish trädgård/trägård'
    });
  }

  if (roomName === 'living room') {
    return JSON.stringify({
      match: 'Vardagsrummet',
      confidence: 0.85,
      reasoning: 'Living room is the English translation of Swedish vardagsrum'
    });
  }

  if (roomName === 'office') {
    return JSON.stringify({
      match: 'Kontoret',
      confidence: 0.8,
      reasoning: 'Office is the English translation of Swedish kontor'
    });
  }

  if (roomName === 'bathroom') {
    return JSON.stringify({
      match: null,
      confidence: 0.0,
      reasoning: 'No direct bathroom equivalent in the available rooms'
    });
  }

  return JSON.stringify({
    match: null,
    confidence: 0.0,
    reasoning: 'No semantic match found'
  });
}

/**
 * Run the example
 */
async function runExample() {
  console.log('🌍 LLM-Powered Room Matching Example\n');

  // Create results table
  console.log('| Input | Language | Fuzzy Match | Confidence | LLM Match | Confidence | Method |');
  console.log('|-------|----------|-------------|------------|-----------|------------|--------|');

  for (const testCase of testCases) {
    try {
      // First try fuzzy matching only
      const fuzzyResult = await comprehensiveRoomMatch(
        testCase.input,
        availableRooms,
        testCase.language
      );

      // Then try with LLM
      const llmResult = await comprehensiveRoomMatch(
        testCase.input,
        availableRooms,
        testCase.language,
        callChatGPT
      );

      // Format results for table
      console.log(
        `| "${testCase.input}" | ${testCase.language} | `
        + `${fuzzyResult.match || 'None'} | ${fuzzyResult.confidence.toFixed(2)} | `
        + `${llmResult.match || 'None'} | ${llmResult.confidence.toFixed(2)} | ${llmResult.method} |`
      );
    } catch (error) {
      console.error(`Error processing "${testCase.input}": ${error.message}`);
    }
  }

  console.log('\n✨ Example completed!');
}

// Run the example
runExample().catch(error => {
  console.error('Example failed:', error);
});
