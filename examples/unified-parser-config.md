# Unified Command Parser Configuration Examples

## Quick Start

### Enable Unified Parsing
```javascript
// In your app initialization or settings
app.setUnifiedParsing(true, 'balanced');
```

### Test a Command
```javascript
// Test with a multilingual command
const result = await app.testUnifiedParsing('Encender las luces del salón', 'es');
console.log('Test result:', result);
```

## Configuration Options

### Conservative Mode (Recommended for Testing)
```javascript
app.setUnifiedParsing(true, 'conservative');

// Manual control per command
const result = await app.parseCommandWithState(
  'Turn on living room lights',
  'en',
  { 
    useUnified: true,
    confidenceThreshold: 0.8  // Higher threshold for safety
  }
);
```

### Balanced Mode (Recommended for Production)
```javascript
app.setUnifiedParsing(true, 'balanced');

// Hybrid approach - automatically chooses best method
const result = await app.parseCommandWithState('Turn on lights and play music', 'en');
```

### Aggressive Mode (Maximum Performance)
```javascript
app.setUnifiedParsing(true, 'aggressive');

// All commands use unified parsing
const result = await app.parseCommandWithState('Dim bedroom lights to 50%', 'en');
```

## Integration Examples

### Direct Integration
```javascript
const { parseCommandWithHybridApproach } = require('./modules/unifiedCommandIntegration');

async function processCommand(commandText, language, homeState) {
  try {
    const result = await parseCommandWithHybridApproach(
      commandText,
      language,
      homeState,
      {
        useUnifiedParsing: true,
        fallbackOnFailure: true,
        confidenceThreshold: 0.7,
        maxRetries: 2
      }
    );
    
    if (result.error) {
      console.error('Command parsing failed:', result.error);
      return null;
    }
    
    return result;
  } catch (error) {
    console.error('Parsing error:', error);
    return null;
  }
}
```

### Telegram Bot Integration
```javascript
// In telegramBot.js or similar
async function handleTelegramMessage(message) {
  const commandText = message.text;
  const detectedLanguage = detectLanguage(commandText);
  
  // Use unified parsing for complex commands
  const options = commandText.length > 30 ? { useUnified: true } : {};
  
  const jsonCommand = await app.parseCommandWithState(
    commandText,
    detectedLanguage,
    options
  );
  
  if (jsonCommand.error) {
    await sendMessage(message.chat.id, `❌ ${jsonCommand.error}`);
    return;
  }
  
  const result = await app.executeHomeyCommand(jsonCommand);
  await sendMessage(message.chat.id, result);
}
```

### Voice Command Integration
```javascript
// In voice processing
async function handleVoiceCommand(audioBuffer) {
  // Transcribe audio
  const transcription = await transcribeVoice(audioBuffer);
  const commandText = transcription.text;
  const detectedLanguage = transcription.language;
  
  // Use unified parsing for voice commands (often more complex)
  const result = await app.parseCommandWithState(
    commandText,
    detectedLanguage,
    { 
      useUnified: true,
      confidenceThreshold: 0.6  // Lower threshold for voice recognition
    }
  );
  
  return result;
}
```

## Room Matching Examples

### Basic Room Commands
```javascript
// English
await app.testUnifiedParsing('Turn on kitchen lights', 'en');

// Spanish  
await app.testUnifiedParsing('Encender luces de la cocina', 'es');

// French
await app.testUnifiedParsing('Allumer les lumières de la cuisine', 'fr');
```

### Complex Multi-Room Commands
```javascript
// Multi-command with different rooms
await app.testUnifiedParsing(
  'Turn on living room lights and bedroom music', 
  'en'
);

// Sequential commands
await app.testUnifiedParsing(
  'Turn off all lights then lock the front door', 
  'en'
);
```

### Room Matching Edge Cases
```javascript
// Fuzzy matching
await app.testUnifiedParsing('Turn on lights in livingroom', 'en'); // No space

// Semantic matching
await app.testUnifiedParsing('Turn on lounge lights', 'en'); // "lounge" -> "Living Room"

// Multilingual variations
await app.testUnifiedParsing('Encender luces del salón', 'es'); // "salón" -> "Living Room"
```

## Error Handling

### Comprehensive Error Handling
```javascript
async function robustCommandParsing(commandText, language) {
  const config = app.getUnifiedParsingConfig();
  
  try {
    // Try unified parsing first if enabled
    if (config.enabled) {
      const result = await app.parseCommandWithState(
        commandText,
        language,
        { 
          useUnified: true,
          confidenceThreshold: 0.7
        }
      );
      
      if (!result.error) {
        return { success: true, result, method: 'unified' };
      }
      
      console.warn('Unified parsing failed, trying legacy:', result.error);
    }
    
    // Fallback to legacy parsing
    const legacyResult = await app.parseCommandWithState(commandText, language);
    
    if (!legacyResult.error) {
      return { success: true, result: legacyResult, method: 'legacy' };
    }
    
    return { 
      success: false, 
      error: 'Both unified and legacy parsing failed',
      details: {
        unified: config.enabled ? result?.error : 'disabled',
        legacy: legacyResult.error
      }
    };
    
  } catch (error) {
    return { 
      success: false, 
      error: 'Parsing exception', 
      details: error.message 
    };
  }
}
```

### Retry Logic
```javascript
async function parseWithRetry(commandText, language, maxRetries = 3) {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await app.parseCommandWithState(
        commandText,
        language,
        { 
          useUnified: attempt === 1, // Try unified first
          confidenceThreshold: Math.max(0.5, 0.8 - (attempt * 0.1)) // Lower threshold on retries
        }
      );
      
      if (!result.error) {
        return result;
      }
      
      lastError = result.error;
      console.warn(`Parsing attempt ${attempt} failed:`, lastError);
      
      // Wait before retry
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
      
    } catch (error) {
      lastError = error.message;
      console.error(`Parsing attempt ${attempt} exception:`, error);
    }
  }
  
  return { error: `All parsing attempts failed. Last error: ${lastError}` };
}
```

## Performance Monitoring

### Response Time Tracking
```javascript
async function monitoredParsing(commandText, language) {
  const startTime = Date.now();
  
  const result = await app.parseCommandWithState(commandText, language);
  
  const endTime = Date.now();
  const duration = endTime - startTime;
  
  // Log performance metrics
  console.log('Parsing metrics:', {
    duration,
    method: result.processing_info?.method || 'legacy',
    success: !result.error,
    commandLength: commandText.length,
    language
  });
  
  // Alert on slow responses
  if (duration > 5000) {
    console.warn('Slow parsing response:', duration, 'ms');
  }
  
  return result;
}
```

### Success Rate Monitoring
```javascript
class ParsingMonitor {
  constructor() {
    this.stats = {
      total: 0,
      successful: 0,
      unified: 0,
      legacy: 0,
      errors: []
    };
  }
  
  async parseAndTrack(commandText, language) {
    this.stats.total++;
    
    try {
      const result = await app.parseCommandWithState(commandText, language);
      
      if (!result.error) {
        this.stats.successful++;
        
        if (result.processing_info?.method === 'unified') {
          this.stats.unified++;
        } else {
          this.stats.legacy++;
        }
      } else {
        this.stats.errors.push({
          command: commandText,
          language,
          error: result.error,
          timestamp: new Date().toISOString()
        });
      }
      
      return result;
    } catch (error) {
      this.stats.errors.push({
        command: commandText,
        language,
        error: error.message,
        timestamp: new Date().toISOString()
      });
      throw error;
    }
  }
  
  getSuccessRate() {
    return this.stats.total > 0 ? this.stats.successful / this.stats.total : 0;
  }
  
  getReport() {
    return {
      successRate: this.getSuccessRate(),
      totalCommands: this.stats.total,
      unifiedUsage: this.stats.unified / Math.max(1, this.stats.successful),
      recentErrors: this.stats.errors.slice(-10)
    };
  }
}

// Usage
const monitor = new ParsingMonitor();
const result = await monitor.parseAndTrack('Turn on lights', 'en');
console.log('Performance report:', monitor.getReport());
```

## Migration Checklist

### Pre-Migration
- [ ] Test unified parser with your common commands
- [ ] Verify room matching accuracy for your zones
- [ ] Check multilingual support for your languages
- [ ] Measure baseline performance with legacy parser

### Migration
- [ ] Enable unified parsing in conservative mode
- [ ] Monitor error rates and performance
- [ ] Test edge cases and complex commands
- [ ] Gradually increase confidence thresholds

### Post-Migration
- [ ] Monitor long-term performance
- [ ] Collect user feedback
- [ ] Optimize prompts if needed
- [ ] Consider enabling aggressive mode

This configuration guide should help you integrate and optimize the unified command parser for your specific use case.
