# Unified Command Parser Integration Guide

## Overview

The unified command parser combines command parsing and room matching into a single, more efficient LLM call. This replaces the previous multi-step approach with a streamlined solution that provides better accuracy and performance.

## Key Benefits

- **Single API Call**: Reduces latency and API costs by combining parsing and room matching
- **Enhanced Room Matching**: Advanced multilingual room matching with confidence scoring
- **Better Context**: Room matching considers command context for more accurate results
- **Fallback Support**: Automatically falls back to legacy parsing if needed
- **Backward Compatible**: Can be enabled/disabled without breaking existing functionality

## Architecture

### Old Multi-Step Approach
```
Input Command → Multilingual Processing → ChatGPT Parsing → Room Matching → Output
```

### New Unified Approach  
```
Input Command → Unified ChatGPT Call (Parsing + Room Matching) → Output
```

## Configuration

### Settings

The unified parser can be controlled via Homey settings:

- `useUnifiedCommandParsing`: Boolean (default: false)
- `unifiedParsingMode`: String ('conservative', 'balanced', 'aggressive')

### Programmatic Control

```javascript
// Enable unified parsing
app.setUnifiedParsing(true, 'balanced');

// Get current configuration
const config = app.getUnifiedParsingConfig();
console.log(config); // { enabled: true, mode: 'balanced' }

// Test unified parsing
const result = await app.testUnifiedParsing('Turn on living room lights', 'en');
```

## Migration Modes

### Conservative Mode (Default)
- Unified parsing disabled by default
- Manual enablement required
- Maximum backward compatibility
- Use for initial testing

### Balanced Mode
- Intelligent hybrid approach
- Complex commands use unified parsing
- Simple commands use legacy parsing
- Recommended for production

### Aggressive Mode
- Unified parsing for all commands
- Legacy as fallback only
- Maximum performance benefits
- Use after thorough testing

## API Usage

### Main Integration Points

#### 1. Enhanced Command Parsing
```javascript
const { parseCommandWithEnhancedMatching } = require('./modules/unifiedCommandIntegration');

const result = await parseCommandWithEnhancedMatching(
  commandText,
  detectedLanguage,
  homeState,
  {
    useUnifiedParsing: true,
    fallbackOnFailure: true,
    confidenceThreshold: 0.7
  }
);
```

#### 2. Hybrid Approach
```javascript
const { parseCommandWithHybridApproach } = require('./modules/unifiedCommandIntegration');

// Automatically chooses best parsing method based on command complexity
const result = await parseCommandWithHybridApproach(
  commandText,
  detectedLanguage,
  homeState
);
```

#### 3. Direct Unified Parsing
```javascript
const { parseCommandWithUnifiedMatching } = require('./modules/unifiedCommandParser');

const result = await parseCommandWithUnifiedMatching(
  commandText,
  availableRooms,
  detectedLanguage,
  homeState
);
```

### Updated parseCommandWithState

The main `parseCommandWithState` method now supports unified parsing:

```javascript
// Use existing interface with unified parsing
const result = await app.parseCommandWithState(
  commandText,
  detectedLanguage,
  { useUnified: true }
);

// Or use settings-based control
app.setUnifiedParsing(true, 'balanced');
const result = await app.parseCommandWithState(commandText, detectedLanguage);
```

## Output Format

### Unified Parser Output
```json
{
  "success": true,
  "command": {
    "room": "Living Room",
    "command": "turn_on",
    "device_filter": "light"
  },
  "room_matching": {
    "original": "living room",
    "matched": "Living Room",
    "method": "exact",
    "confidence": 1.0,
    "alternatives": ["Lounge", "Family Room"]
  },
  "language_processing": {
    "detected_language": "en",
    "normalized_input": "turn on living room lights",
    "extracted_entities": {
      "rooms": ["living room"],
      "actions": ["turn on"],
      "devices": ["lights"]
    }
  },
  "processing_info": {
    "method": "unified",
    "timestamp": "2024-01-01T12:00:00.000Z",
    "api_calls": 1
  }
}
```

### Legacy Compatibility

The unified parser output is automatically transformed to match the legacy format:

```json
{
  "room": "Living Room",
  "command": "turn_on",
  "device_filter": "light"
}
```

## Multilingual Room Matching

### Supported Languages
- English: "living room", "kitchen", "bedroom"
- Spanish: "salón", "cocina", "dormitorio"  
- French: "salon", "cuisine", "chambre"
- German: "wohnzimmer", "küche", "schlafzimmer"
- And more...

### Matching Methods
1. **Exact Match**: Direct string match
2. **Fuzzy Match**: Handles typos and variations
3. **Semantic Match**: Understanding of equivalent terms

### Confidence Scoring
- 1.0: Exact match
- 0.8-0.9: High confidence fuzzy match
- 0.6-0.7: Medium confidence semantic match
- <0.6: Low confidence (may trigger fallback)

## Testing

### Unit Tests
```bash
# Run unified parser tests
node test/unified-command-test.js
```

### Integration Tests
```javascript
// Test specific command
const result = await app.testUnifiedParsing('Encender luces del salón', 'es');
console.log(result);
```

### Performance Testing
```javascript
// Compare unified vs legacy performance
const startTime = Date.now();
const unifiedResult = await parseCommandWithUnifiedMatching(...);
const unifiedTime = Date.now() - startTime;

const legacyStart = Date.now();
const legacyResult = await parseCommandWithState(...);
const legacyTime = Date.now() - legacyStart;

console.log(`Unified: ${unifiedTime}ms, Legacy: ${legacyTime}ms`);
```

## Gradual Migration Strategy

### Phase 1: Conservative Rollout
1. Deploy with unified parsing disabled
2. Enable for power users/beta testers
3. Monitor performance and accuracy
4. Collect feedback

### Phase 2: Selective Enablement  
1. Enable hybrid approach
2. Use unified for complex commands only
3. Monitor room matching accuracy
4. Adjust confidence thresholds

### Phase 3: Full Migration
1. Enable unified parsing by default
2. Keep legacy as fallback
3. Monitor error rates
4. Optimize performance

### Phase 4: Legacy Deprecation
1. Remove legacy code paths
2. Unified parsing only
3. Final performance optimization

## Troubleshooting

### Common Issues

#### Low Room Matching Confidence
```javascript
// Adjust confidence threshold
const result = await parseCommandWithEnhancedMatching(
  commandText,
  language,
  homeState,
  { confidenceThreshold: 0.5 } // Lower threshold
);
```

#### Unified Parsing Failures
- Check OpenAI API key validity
- Verify home state structure
- Review available rooms array
- Check command complexity

#### Performance Issues
- Monitor API call frequency
- Use hybrid approach for optimization
- Cache room mappings if possible

### Debug Logging

Enable detailed logging for troubleshooting:

```javascript
// Set environment variable
process.env.DEBUG_UNIFIED_PARSING = 'true';

// Or use app settings
app.homey.settings.set('debugUnifiedParsing', true);
```

## Best Practices

### 1. Start Conservative
- Begin with unified parsing disabled
- Test thoroughly with your specific use cases
- Gradually increase usage

### 2. Monitor Performance
- Track API call counts
- Monitor response times
- Compare accuracy with legacy approach

### 3. Handle Edge Cases
- Always enable fallback
- Set appropriate confidence thresholds
- Handle multilingual variations

### 4. User Experience
- Provide clear error messages
- Maintain response time expectations
- Support all existing command formats

## Future Enhancements

- **Caching**: Room mapping cache for faster responses
- **Learning**: Adaptive confidence thresholds based on success rates  
- **Analytics**: Command parsing success metrics
- **Optimization**: Prompt optimization for better accuracy
- **Languages**: Additional language support

## Support

For issues or questions:
1. Check logs for detailed error information
2. Test with legacy parsing to isolate issues
3. Review room matching confidence scores
4. Verify home state structure and available rooms
