# Comprehensive Testing Framework Guide

## Overview

This document describes the comprehensive automated testing framework for the Homey ChatGPT Assistant app. The framework eliminates the need to manually create tests for each code change by providing extensive coverage, automated test runners, and comprehensive mocking systems.

## Framework Architecture

### 🏗️ Test Structure

```
test/
├── utils/                    # Test utilities and setup
│   ├── testSetup.js         # Common test configuration
│   └── mockHomeyAPI.js      # Homey API mocks
├── unit/                    # Unit tests for individual modules
│   ├── statusQueryProcessor.test.js
│   ├── deviceStatusRetriever.test.js
│   └── advancedMultilingualMatcher.test.js
├── integration/             # End-to-end workflow tests
│   ├── statusQueryWorkflow.test.js
│   └── multilingualCommandProcessing.test.js
├── regression/              # Tests for previously fixed bugs
│   └── fixedBugs.test.js
└── performance/             # Performance and scalability tests
    └── benchmarks.test.js
```

### 🛠️ Core Components

1. **Test Utilities** (`test/utils/`)
   - Common test setup and configuration
   - Realistic Homey device and API mocks
   - Test data generators for multilingual scenarios

2. **Unit Tests** (`test/unit/`)
   - Individual module testing
   - Function-level validation
   - Edge case handling

3. **Integration Tests** (`test/integration/`)
   - Complete workflow testing
   - End-to-end scenarios
   - Cross-module interactions

4. **Regression Tests** (`test/regression/`)
   - Previously fixed bug validation
   - Ensures issues don't reoccur
   - Historical issue tracking

5. **Performance Tests** (`test/performance/`)
   - Load testing and benchmarks
   - Memory usage validation
   - Scalability limits

## 🚀 Quick Start

### Installation

```bash
# Install testing dependencies
npm install

# Install testing framework
npm install --save-dev mocha chai sinon nyc chai-as-promised
```

### Running Tests

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:unit           # Unit tests only
npm run test:integration    # Integration tests only
npm run test:regression     # Regression tests only
npm run test:performance    # Performance tests only

# Run with coverage
npm run test:coverage

# Watch mode for development
npm run test:watch

# Run legacy tests (existing test files)
npm run test:legacy
```

### Automated Test Runner

```bash
# Run comprehensive test suite with reporting
node scripts/test-runner.js

# Run specific suites
node scripts/test-runner.js unit integration

# Watch for file changes during development
node scripts/watch-tests.js
```

## 📋 Test Categories

### Unit Tests

**Purpose**: Test individual functions and modules in isolation

**Coverage**:
- Status query processing (`statusQueryProcessor.test.js`)
- Device status retrieval (`deviceStatusRetriever.test.js`)
- Multilingual room matching (`advancedMultilingualMatcher.test.js`)
- Command processing logic
- ChatGPT API integration

**Example**:
```javascript
describe('Status Query Processor', function() {
  it('should detect English status queries', function() {
    expect(isStatusQuery('What\'s the status of kitchen lights?', 'en')).to.be.true;
  });
});
```

### Integration Tests

**Purpose**: Test complete workflows and cross-module interactions

**Coverage**:
- Swedish/multilingual voice commands end-to-end
- Status queries with room filtering
- Multi-command processing
- Device type filtering workflows

**Example**:
```javascript
describe('Status Query Workflow Integration', function() {
  it('should handle Swedish room status with character variations', async function() {
    const result = await handleStatusQuery(
      'Visa enheter i trädgården',
      'sv',
      mockHomeState,
      mockLLMFunction
    );
    expect(result).to.have.property('success', true);
  });
});
```

### Regression Tests

**Purpose**: Ensure previously fixed bugs don't reoccur

**Coverage**:
- Swedish kitchen light status bug
- Room name translation issues
- Multi-command validation problems
- Device type filtering bugs

**Example**:
```javascript
describe('Swedish Kitchen Light Status Bug', function() {
  it('should handle Swedish kitchen light status correctly', async function() {
    const result = await handleStatusQuery('Vad är status på kök ljus?', 'sv', mockHomeState);
    expect(result).to.have.property('success', true);
    expect(result.formattedText).to.not.include('not found');
  });
});
```

### Performance Tests

**Purpose**: Validate system performance under load

**Coverage**:
- Command processing speed
- Large home state handling
- Concurrent query processing
- Memory usage validation

**Example**:
```javascript
describe('Command Processing Performance', function() {
  it('should process simple commands quickly', function() {
    const startTime = Date.now();
    processMultilingualCommand('Turn on kitchen lights', 'en');
    const endTime = Date.now();
    expect(endTime - startTime).to.be.below(50);
  });
});
```

## 🎭 Mock System

### Comprehensive Homey API Mocks

The framework includes realistic mocks for:

- **Devices**: Lights, thermostats, speakers, locks, sensors, cameras
- **Zones**: Rooms with multilingual names
- **Capabilities**: Device-specific capabilities and values
- **API Methods**: Device control and status retrieval

### Mock Home State

```javascript
const mockHomeState = createMockHomeState({
  customDevices: {
    'special_light': createMockDevice({
      name: 'Special Light',
      class: 'light',
      onoff: true,
      dim: 0.75
    })
  }
});
```

### Mock LLM Function

```javascript
const mockLLMFunction = createMockLLMFunction({
  'kitchen': { match: 'Kitchen', confidence: 0.9 },
  'vardagsrummet': { match: 'Vardagsrummet', confidence: 0.95 }
});
```

## 📊 Test Coverage

### Coverage Targets

- **Lines**: 80%
- **Statements**: 80%
- **Functions**: 80%
- **Branches**: 70%

### Coverage Reports

```bash
# Generate coverage report
npm run test:coverage

# View HTML report
open coverage/index.html
```

### Coverage Configuration

Coverage settings are defined in `.nycrc.json`:

```json
{
  "include": ["modules/**/*.js", "app.js"],
  "exclude": ["test/**", "examples/**"],
  "reporter": ["text", "html", "lcov"],
  "check-coverage": true,
  "lines": 80
}
```

## 🔄 Continuous Testing

### Watch Mode

Automatically runs tests when files change:

```bash
npm run test:watch
# or
node scripts/watch-tests.js
```

### File Watching

The watch system monitors:
- All module files (`modules/**/*.js`)
- Test files (`test/**/*.js`)
- Main application file (`app.js`)

### Manual Controls

While in watch mode:
- Type `rs` + Enter to manually restart tests
- Type `q` + Enter to quit
- Type `h` + Enter for help

## 📈 Test Reports

### Automated Reporting

The test runner generates comprehensive reports:

```bash
node scripts/test-runner.js
```

**Report includes**:
- Test suite summaries
- Pass/fail statistics
- Performance metrics
- Error details
- Coverage information

### Report Storage

Reports are saved to `test-reports/` with timestamps:
```
test-reports/
└── test-report-2024-01-15T10-30-45-123Z.json
```

## 🌍 Multilingual Testing

### Language Coverage

Tests cover all supported languages:
- English (en)
- Swedish (sv)
- French (fr)
- German (de)
- Spanish (es)
- Italian (it)
- Portuguese (pt)
- Dutch (nl)

### Test Data Generation

Automatic test data generation for each language:

```javascript
const commands = TestDataGenerators.generateMultilingualCommands('sv');
const queries = TestDataGenerators.generateStatusQueries('fr');
```

### Character Variation Testing

Special focus on:
- Swedish characters (ä, ö, å)
- French accents (é, è, ç)
- German umlauts (ü, ö, ä, ß)

## 🐛 Debugging Tests

### Verbose Output

```bash
# Run with detailed output
npm test -- --reporter spec

# Run single test file
npx mocha test/unit/statusQueryProcessor.test.js
```

### Debug Mode

```bash
# Run with Node.js debugger
node --inspect-brk node_modules/.bin/mocha test/unit/statusQueryProcessor.test.js
```

### Common Issues

1. **Timeout Errors**: Increase timeout in test files
2. **Mock Issues**: Verify mock setup in `beforeEach`
3. **Async Problems**: Ensure proper `await` usage

## 🔧 Extending the Framework

### Adding New Tests

1. **Unit Tests**: Add to `test/unit/`
2. **Integration Tests**: Add to `test/integration/`
3. **Regression Tests**: Add to `test/regression/`

### Creating Mocks

```javascript
// Custom device mock
const customDevice = createMockDevice({
  name: 'Custom Device',
  class: 'custom',
  customCapability: 'custom_value'
});

// Custom home state
const customHomeState = createMockHomeState({
  customDevices: { 'custom_1': customDevice }
});
```

### Test Utilities

```javascript
// Use test utilities
const { expect, TestUtils, TestDataGenerators } = require('../utils/testSetup');

// Generate test data
const testCommand = TestUtils.generateTestData('command');
const testRoom = TestUtils.generateTestData('room');
```

## 📚 Best Practices

### Test Organization

1. **Descriptive Names**: Use clear, descriptive test names
2. **Logical Grouping**: Group related tests in `describe` blocks
3. **Setup/Teardown**: Use `beforeEach`/`afterEach` for clean state

### Assertion Patterns

```javascript
// Good: Specific assertions
expect(result).to.have.property('success', true);
expect(result.devices).to.have.length.above(0);

// Avoid: Vague assertions
expect(result).to.be.ok;
```

### Async Testing

```javascript
// Proper async testing
it('should handle async operations', async function() {
  const result = await handleStatusQuery(query, language, homeState);
  expect(result).to.have.property('success', true);
});
```

## 🎯 Benefits

### For Developers

- **Confidence**: Comprehensive test coverage ensures code quality
- **Speed**: Automated testing eliminates manual test creation
- **Feedback**: Immediate feedback on code changes
- **Documentation**: Tests serve as living documentation

### For Users

- **Reliability**: Extensive testing ensures stable functionality
- **Quality**: Regression tests prevent old bugs from returning
- **Performance**: Performance tests ensure responsive system

### For Maintenance

- **Regression Prevention**: Automated regression testing
- **Refactoring Safety**: Tests enable safe code refactoring
- **Bug Tracking**: Test history tracks resolved issues

## 🚀 Getting Started

1. **Install Dependencies**: `npm install`
2. **Run Initial Tests**: `npm test`
3. **Start Development**: `npm run test:watch`
4. **Add New Features**: Write tests first, then implement
5. **Verify Coverage**: `npm run test:coverage`

The framework is designed to grow with your codebase, automatically testing new features and ensuring existing functionality remains stable.
