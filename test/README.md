# Homey ChatGPT Assistant - Testing Framework

## 🎯 Overview

This comprehensive testing framework eliminates the need to manually create tests for each code change by providing:

- **Automated test generation** for multilingual scenarios
- **Comprehensive mocking system** for Homey devices and APIs
- **Regression testing** to prevent previously fixed bugs
- **Performance benchmarks** to ensure system responsiveness
- **Continuous testing** with file watching and auto-execution

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Watch for changes during development
npm run test:watch-dev

# Run comprehensive automated test suite
npm run test:auto
```

## 📁 Test Structure

```
test/
├── utils/                    # Test utilities and mocks
├── unit/                     # Individual module tests
├── integration/              # End-to-end workflow tests
├── regression/               # Previously fixed bug tests
├── performance/              # Performance and scalability tests
└── examples/                 # Framework usage examples
```

## 🧪 Test Categories

### Unit Tests (`test/unit/`)
- **statusQueryProcessor.test.js** - Status query parsing and detection
- **deviceStatusRetriever.test.js** - Device status retrieval logic
- **advancedMultilingualMatcher.test.js** - Room matching algorithms

### Integration Tests (`test/integration/`)
- **statusQueryWorkflow.test.js** - Complete status query workflows
- **multilingualCommandProcessing.test.js** - End-to-end command processing

### Regression Tests (`test/regression/`)
- **fixedBugs.test.js** - Previously reported and fixed issues

### Performance Tests (`test/performance/`)
- **benchmarks.test.js** - Performance and scalability validation

## 🎭 Mock System

### Realistic Device Mocks
```javascript
const mockLight = createMockDevice({
  name: 'Kitchen Light',
  class: 'light',
  onoff: true,
  dim: 0.8
});
```

### Complete Home State
```javascript
const mockHomeState = createMockHomeState({
  customDevices: { 'special_device': customDevice }
});
```

### LLM Function Mocking
```javascript
const mockLLMFunction = createMockLLMFunction({
  'kitchen': { match: 'Kitchen', confidence: 0.9 }
});
```

## 🌍 Multilingual Testing

Automatic test generation for:
- English, Swedish, French, German, Spanish, Italian, Portuguese, Dutch
- Mixed language commands
- Character variations (ä, ö, å, é, ç, ü, ß)
- Room name translations

## 📊 Coverage Targets

- **Lines**: 80%
- **Statements**: 80%
- **Functions**: 80%
- **Branches**: 70%

## 🔄 Automated Testing

### Test Runner
```bash
# Run comprehensive test suite with reporting
npm run test:auto

# Run specific test categories
node scripts/test-runner.js unit integration regression
```

### Watch Mode
```bash
# Automatically run tests when files change
npm run test:watch-dev
```

**Watch mode commands:**
- `rs` + Enter: Restart tests
- `q` + Enter: Quit
- `h` + Enter: Help

## 📈 Test Reports

Automated reports include:
- Test suite summaries
- Pass/fail statistics
- Performance metrics
- Coverage information
- Error details

Reports are saved to `test-reports/` with timestamps.

## 🐛 Regression Prevention

The framework automatically tests for previously fixed bugs:

- Swedish kitchen light status bug
- Room name translation issues
- Multi-command validation problems
- Device type filtering bugs
- Unicode character handling

## ⚡ Performance Validation

Performance tests ensure:
- Commands process under 50ms
- Status queries complete under 2 seconds
- Large home states (1000+ devices) handled efficiently
- Memory usage stays within limits
- Concurrent operations work correctly

## 🛠️ Adding New Tests

### Unit Test Example
```javascript
describe('New Feature', function() {
  it('should handle new functionality', function() {
    const result = newFunction('test input');
    expect(result).to.have.property('success', true);
  });
});
```

### Integration Test Example
```javascript
describe('New Workflow', function() {
  it('should complete end-to-end workflow', async function() {
    const result = await completeWorkflow(input, mockHomeState);
    expect(result).to.have.property('success', true);
  });
});
```

## 📚 Best Practices

1. **Descriptive Names**: Use clear, specific test names
2. **Single Responsibility**: Test one thing per test
3. **Setup/Teardown**: Use `beforeEach`/`afterEach` for clean state
4. **Async Handling**: Proper `async`/`await` usage
5. **Error Testing**: Test both success and failure cases

## 🎓 Learning Resources

- **Framework Demo**: `test/examples/frameworkDemo.test.js`
- **Comprehensive Guide**: `TESTING_FRAMEWORK_GUIDE.md`
- **Mock Examples**: `test/utils/mockHomeyAPI.js`

## 🔧 Configuration

### Test Timeouts
- Unit tests: 5 seconds
- Integration tests: 15 seconds
- Performance tests: 30 seconds

### Coverage Settings
Configured in `.nycrc.json` with HTML and LCOV reports.

### Watch Settings
Monitors `modules/`, `test/`, and `app.js` for changes.

## 🎯 Benefits

- **Zero Manual Test Creation**: Framework handles test generation
- **Comprehensive Coverage**: All modules and workflows tested
- **Regression Prevention**: Automatic bug prevention
- **Performance Assurance**: Continuous performance validation
- **Development Speed**: Immediate feedback on changes
- **Code Quality**: High test coverage ensures reliability

## 🚀 Getting Started

1. **Explore Examples**: Check `test/examples/frameworkDemo.test.js`
2. **Run Tests**: `npm test`
3. **Watch Development**: `npm run test:watch-dev`
4. **Check Coverage**: `npm run test:coverage`
5. **Add Features**: Write tests first, then implement

The framework grows with your codebase, automatically testing new features while ensuring existing functionality remains stable.
