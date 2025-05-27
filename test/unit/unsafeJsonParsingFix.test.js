'use strict';

const { expect } = require('chai');
const sinon = require('sinon');
const https = require('https');
const { EventEmitter } = require('events');

// Mock the dependencies
const mockKeyManager = {
  hasKey: sinon.stub(),
  createAuthHeader: sinon.stub()
};

const mockErrorHandler = {
  validateInput: sinon.stub(),
  api: sinon.stub().returns({ toUserMessage: () => 'API error' }),
  parsing: sinon.stub().returns({ toUserMessage: () => 'Parsing error' }),
  network: sinon.stub().returns({ toUserMessage: () => 'Network error' }),
  wrap: sinon.stub().returns({ toUserMessage: () => 'Wrapped error' })
};

const mockErrorTypes = {
  API_ERROR: 'API_ERROR',
  AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR'
};

// Mock modules before requiring the module under test
const moduleCache = require.cache;
Object.keys(moduleCache).forEach(key => {
  if (key.includes('secureKeyManager') || key.includes('errorHandler')) {
    delete moduleCache[key];
  }
});

require.cache[require.resolve('../../modules/secureKeyManager')] = {
  exports: { getKeyManager: () => mockKeyManager }
};

require.cache[require.resolve('../../modules/errorHandler')] = {
  exports: {
    ErrorHandler: mockErrorHandler,
    ErrorTypes: mockErrorTypes
  }
};

const chatgpt = require('../../modules/chatgpt');

describe('Unsafe JSON Parsing Fix', () => {
  let mockRequest;
  let mockResponse;
  let httpsRequestStub;

  beforeEach(() => {
    // Reset all stubs
    sinon.resetHistory();

    // Setup default mock behaviors
    mockKeyManager.hasKey.returns(true);
    mockKeyManager.createAuthHeader.returns('Bearer mock-token');
    mockErrorHandler.validateInput.returns(true);

    // Create mock request and response objects
    mockRequest = new EventEmitter();
    mockRequest.write = sinon.stub();
    mockRequest.end = sinon.stub();

    mockResponse = new EventEmitter();
    mockResponse.statusCode = 200;

    httpsRequestStub = sinon.stub(https, 'request').callsFake((options, callback) => {
      // Call the callback with our mock response
      setTimeout(() => callback(mockResponse), 0);
      return mockRequest;
    });
  });

  afterEach(() => {
    httpsRequestStub.restore();
  });

  describe('Response Size Limits', () => {
    it('should reject responses larger than 1MB during streaming', async () => {
      const largeChunk = 'x'.repeat(600000); // 600KB chunk

      const parsePromise = chatgpt.parseCommand('test prompt');

      // Simulate receiving large chunks
      mockResponse.emit('data', largeChunk);
      mockResponse.emit('data', largeChunk); // Total > 1MB

      const result = await parsePromise;

      expect(result).to.have.property('error');
      expect(mockErrorHandler.api).to.have.been.calledWith(
        'Response from ChatGPT API too large',
        sinon.match.object
      );
    });

    it('should reject empty responses', async () => {
      const parsePromise = chatgpt.parseCommand('test prompt');

      mockResponse.emit('data', '');
      mockResponse.emit('end');

      const result = await parsePromise;

      expect(result).to.have.property('error');
      expect(mockErrorHandler.api).to.have.been.calledWith('Empty response from ChatGPT API');
    });

    it('should handle normal sized responses correctly', async () => {
      const validResponse = JSON.stringify({
        choices: [{
          message: {
            content: '{"room": "living room", "command": "turn_on"}'
          }
        }]
      });

      const parsePromise = chatgpt.parseCommand('test prompt');

      mockResponse.emit('data', validResponse);
      mockResponse.emit('end');

      const result = await parsePromise;

      expect(result).to.have.property('room', 'living room');
      expect(result).to.have.property('command', 'turn_on');
    });
  });

  describe('JSON Parsing Security', () => {
    it('should reject deeply nested JSON structures', async () => {
      // Create deeply nested JSON (JSON bomb)
      let nestedJson = '{"a":';
      for (let i = 0; i < 60; i++) {
        nestedJson += '{"b":';
      }
      nestedJson += '"value"';
      for (let i = 0; i < 60; i++) {
        nestedJson += '}';
      }
      nestedJson += '}';

      const response = JSON.stringify({
        choices: [{
          message: {
            content: nestedJson
          }
        }]
      });

      const parsePromise = chatgpt.parseCommand('test prompt');

      mockResponse.emit('data', response);
      mockResponse.emit('end');

      const result = await parsePromise;

      expect(result).to.have.property('error');
      expect(mockErrorHandler.parsing).to.have.been.called;
    });

    it('should reject command text longer than 10000 characters', async () => {
      const longCommand = '{"room": "' + 'x'.repeat(10000) + '", "command": "turn_on"}';
      const response = JSON.stringify({
        choices: [{
          message: {
            content: longCommand
          }
        }]
      });

      const parsePromise = chatgpt.parseCommand('test prompt');

      mockResponse.emit('data', response);
      mockResponse.emit('end');

      const result = await parsePromise;

      expect(result).to.have.property('error');
      expect(mockErrorHandler.parsing).to.have.been.calledWith(
        'Command text from ChatGPT too long',
        sinon.match.object
      );
    });

    it('should handle malformed JSON gracefully', async () => {
      const response = JSON.stringify({
        choices: [{
          message: {
            content: '{"room": "living room", "command": "turn_on"' // Missing closing brace
          }
        }]
      });

      const parsePromise = chatgpt.parseCommand('test prompt');

      mockResponse.emit('data', response);
      mockResponse.emit('end');

      const result = await parsePromise;

      expect(result).to.have.property('error');
      expect(mockErrorHandler.parsing).to.have.been.called;
    });
  });

  describe('Response Structure Validation', () => {
    it('should reject responses without choices array', async () => {
      const response = JSON.stringify({
        id: 'test',
        object: 'chat.completion'
        // Missing choices array
      });

      const parsePromise = chatgpt.parseCommand('test prompt');

      mockResponse.emit('data', response);
      mockResponse.emit('end');

      const result = await parsePromise;

      expect(result).to.have.property('error');
      expect(mockErrorHandler.api).to.have.been.calledWith(
        sinon.match(/Invalid response structure/)
      );
    });

    it('should reject responses with empty choices array', async () => {
      const response = JSON.stringify({
        choices: []
      });

      const parsePromise = chatgpt.parseCommand('test prompt');

      mockResponse.emit('data', response);
      mockResponse.emit('end');

      const result = await parsePromise;

      expect(result).to.have.property('error');
      expect(mockErrorHandler.api).to.have.been.called;
    });

    it('should reject responses without message content', async () => {
      const response = JSON.stringify({
        choices: [{
          message: {
            role: 'assistant'
            // Missing content
          }
        }]
      });

      const parsePromise = chatgpt.parseCommand('test prompt');

      mockResponse.emit('data', response);
      mockResponse.emit('end');

      const result = await parsePromise;

      expect(result).to.have.property('error');
      expect(mockErrorHandler.api).to.have.been.called;
    });
  });

  describe('Command Structure Validation', () => {
    it('should accept valid single room command', async () => {
      const response = JSON.stringify({
        choices: [{
          message: {
            content: '{"room": "living room", "command": "turn_on"}'
          }
        }]
      });

      const parsePromise = chatgpt.parseCommand('test prompt');

      mockResponse.emit('data', response);
      mockResponse.emit('end');

      const result = await parsePromise;

      expect(result).to.have.property('room', 'living room');
      expect(result).to.have.property('command', 'turn_on');
    });

    it('should accept valid multi-command structure', async () => {
      const response = JSON.stringify({
        choices: [{
          message: {
            content: '{"commands": [{"room": "living room", "command": "turn_on"}, {"room": "kitchen", "command": "turn_off"}]}'
          }
        }]
      });

      const parsePromise = chatgpt.parseCommand('test prompt');

      mockResponse.emit('data', response);
      mockResponse.emit('end');

      const result = await parsePromise;

      expect(result).to.have.property('commands');
      expect(result.commands).to.be.an('array').with.length(2);
    });

    it('should reject commands without required fields', async () => {
      const response = JSON.stringify({
        choices: [{
          message: {
            content: '{"command": "turn_on"}' // Missing room/device_id/device_ids
          }
        }]
      });

      const parsePromise = chatgpt.parseCommand('test prompt');

      mockResponse.emit('data', response);
      mockResponse.emit('end');

      const result = await parsePromise;

      expect(result).to.have.property('error');
      expect(mockErrorHandler.parsing).to.have.been.called;
    });

    it('should accept valid error responses', async () => {
      const response = JSON.stringify({
        choices: [{
          message: {
            content: '{"error": "Could not understand the command"}'
          }
        }]
      });

      const parsePromise = chatgpt.parseCommand('test prompt');

      mockResponse.emit('data', response);
      mockResponse.emit('end');

      const result = await parsePromise;

      expect(result).to.have.property('error', 'Could not understand the command');
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      const parsePromise = chatgpt.parseCommand('test prompt');

      const networkError = new Error('Network timeout');
      mockRequest.emit('error', networkError);

      const result = await parsePromise;

      expect(result).to.have.property('error');
      expect(mockErrorHandler.network).to.have.been.calledWith(
        sinon.match(/Network error during ChatGPT API request/)
      );
    });

    it('should handle API error responses', async () => {
      const response = JSON.stringify({
        error: {
          message: 'Invalid API key',
          type: 'invalid_request_error',
          code: 'invalid_api_key'
        }
      });

      const parsePromise = chatgpt.parseCommand('test prompt');

      mockResponse.emit('data', response);
      mockResponse.emit('end');

      const result = await parsePromise;

      expect(result).to.have.property('error');
      expect(mockErrorHandler.api).to.have.been.calledWith(
        sinon.match(/ChatGPT API error/),
        sinon.match.object
      );
    });
  });
});
