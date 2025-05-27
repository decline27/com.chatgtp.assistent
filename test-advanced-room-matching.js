#!/usr/bin/env node
'use strict';

/**
 * Advanced Multilingual Room Matching Test
 * Tests the new fuzzy matching and LLM-powered semantic understanding
 */

const { 
  findBestRoomMatch, 
  comprehensiveRoomMatch, 
  normalizeUnicode,
  calculateSimilarity,
  removeDefiniteArticles,
  generatePhoneticVariations
} = require('./modules/advancedMultilingualMatcher');

const { 
  normalizeRoomNameAdvanced,
  normalizeRoomNameLegacy 
} = require('./modules/multilingualProcessor');

// Simulate the available rooms from the error message
const availableRooms = [
  'Home', 'Andra våningen', 'Vardagsrummet', 'Kök', 'Anna sovrum', 
  'Trägården', 'Första våningen', 'Hallen', 'Tv Rummet', 'Kontoret', 
  'Feng Shuil', 'Tvättstuga', 'Jakob sovrum', 'Uppfarten', 'Oliver sovrum', 
  'Uterummet', 'Elliot Sovrum', 'Huvudsovrum', 'Utomhus', 'Teknikrum'
];

console.log('🚀 Testing Advanced Multilingual Room Matching\n');

// Test cases that were previously failing
const testCases = [
  {
    input: "trädgården",
    language: "sv",
    description: "Swedish 'trädgården' should match 'Trägården' (character variation + definite article)"
  },
  {
    input: "garden",
    language: "en", 
    description: "English 'garden' should semantically match 'Trägården'"
  },
  {
    input: "vardagsrummet",
    language: "sv",
    description: "Swedish 'vardagsrummet' should match 'Vardagsrummet' (case + definite article)"
  },
  {
    input: "living room",
    language: "en",
    description: "English 'living room' should semantically match 'Vardagsrummet'"
  },
  {
    input: "kichen", // typo
    language: "en",
    description: "Typo 'kichen' should fuzzy match 'Kök'"
  },
  {
    input: "köket",
    language: "sv",
    description: "Swedish 'köket' (with definite article) should match 'Kök'"
  },
  {
    input: "office",
    language: "en",
    description: "English 'office' should match 'Kontoret'"
  },
  {
    input: "bathroom",
    language: "en",
    description: "English 'bathroom' should match closest available room"
  }
];

console.log('📊 Testing Individual Components:\n');

// Test Unicode normalization
console.log('1. Unicode Normalization:');
testCases.slice(0, 3).forEach(test => {
  const normalized = normalizeUnicode(test.input);
  console.log(`   "${test.input}" -> "${normalized}"`);
});

// Test definite article removal
console.log('\n2. Definite Article Removal:');
testCases.forEach(test => {
  const withoutArticles = removeDefiniteArticles(test.input, test.language);
  if (withoutArticles !== test.input) {
    console.log(`   "${test.input}" (${test.language}) -> "${withoutArticles}"`);
  }
});

// Test phonetic variations
console.log('\n3. Phonetic Variations:');
['trädgården', 'garden', 'kichen'].forEach(word => {
  const variations = generatePhoneticVariations(word);
  console.log(`   "${word}" -> [${variations.join(', ')}]`);
});

// Test similarity calculations
console.log('\n4. Similarity Scores:');
[
  ['trädgården', 'Trägården'],
  ['garden', 'Trägården'], 
  ['kichen', 'Kök'],
  ['vardagsrummet', 'Vardagsrummet']
].forEach(([a, b]) => {
  const similarity = calculateSimilarity(a, b);
  console.log(`   "${a}" vs "${b}": ${similarity.toFixed(3)}`);
});

console.log('\n🎯 Testing Advanced Fuzzy Matching:\n');

// Test advanced fuzzy matching
for (const testCase of testCases) {
  console.log(`Test: ${testCase.description}`);
  console.log(`Input: "${testCase.input}" (${testCase.language})`);
  
  const result = findBestRoomMatch(testCase.input, availableRooms, testCase.language);
  
  if (result.match) {
    console.log(`✅ Match: "${result.match}" (${result.method}, confidence: ${result.confidence.toFixed(3)})`);
  } else {
    console.log(`❌ No match found`);
  }
  
  console.log('');
}

console.log('🔄 Comparing Legacy vs Advanced Matching:\n');

// Compare legacy vs advanced matching
for (const testCase of testCases.slice(0, 4)) {
  console.log(`Input: "${testCase.input}" (${testCase.language})`);
  
  // Legacy matching
  const legacyResult = normalizeRoomNameLegacy(testCase.input, testCase.language, availableRooms);
  
  // Advanced matching
  const advancedResult = findBestRoomMatch(testCase.input, availableRooms, testCase.language);
  
  console.log(`   Legacy:   "${legacyResult}"`);
  console.log(`   Advanced: "${advancedResult.match || 'no match'}" (confidence: ${advancedResult.confidence.toFixed(3)})`);
  
  if (advancedResult.match && advancedResult.match.toLowerCase() !== legacyResult) {
    console.log(`   🎉 Improvement detected!`);
  }
  
  console.log('');
}

// Mock LLM function for testing semantic matching
async function mockLLMFunction(prompt) {
  // Simple mock that handles some basic cases
  if (prompt.includes('"garden"') && prompt.includes('"Trägården"')) {
    return JSON.stringify({
      match: "Trägården",
      confidence: 0.9,
      reasoning: "Garden is the English translation of Swedish trädgård/trägård"
    });
  }
  
  if (prompt.includes('"living room"') && prompt.includes('"Vardagsrummet"')) {
    return JSON.stringify({
      match: "Vardagsrummet", 
      confidence: 0.85,
      reasoning: "Living room is the English translation of Swedish vardagsrum"
    });
  }
  
  return JSON.stringify({
    match: null,
    confidence: 0.0,
    reasoning: "No semantic match found"
  });
}

console.log('🧠 Testing LLM-Powered Semantic Matching:\n');

// Test comprehensive matching with mock LLM
(async () => {
  const semanticTestCases = [
    { input: "garden", language: "en" },
    { input: "living room", language: "en" },
    { input: "trädgården", language: "sv" }
  ];
  
  for (const testCase of semanticTestCases) {
    console.log(`Semantic test: "${testCase.input}" (${testCase.language})`);
    
    try {
      const result = await comprehensiveRoomMatch(
        testCase.input, 
        availableRooms, 
        testCase.language, 
        mockLLMFunction
      );
      
      if (result.match) {
        console.log(`✅ Match: "${result.match}" (${result.method}, confidence: ${result.confidence.toFixed(3)})`);
        if (result.reasoning) {
          console.log(`   Reasoning: ${result.reasoning}`);
        }
      } else {
        console.log(`❌ No match found`);
      }
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }
    
    console.log('');
  }
  
  console.log('✨ Advanced matching test completed!');
})();
