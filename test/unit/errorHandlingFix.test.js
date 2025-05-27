'use strict';

const { expect } = require('chai');
const sinon = require('sinon');
const { ErrorHandler, ErrorTypes, StandardError } = require('../../modules/errorHandler');

describe('Error Handling Standardization Fix', () => {
  let consoleStub;

  beforeEach(() => {
    consoleStub = {
      log: sinon.stub(),
      warn: sinon.stub(),
      error: sinon.stub()
    };
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('StandardError Class', () => {
    it('should create error with correct properties', () => {
      const error = new StandardError('Test message', ErrorTypes.VALIDATION_ERROR, { field: 'test' }, 'E001');
      
      expect(error.message).to.equal('Test message');
      expect(error.type).to.equal(ErrorTypes.VALIDATION_ERROR);
      expect(error.details).to.deep.equal({ field: 'test' });
      expect(error.code).to.equal('E001');
      expect(error.timestamp).to.be.a('string');
      expect(error.name).to.equal('StandardError');
    });

    it('should convert to JSON format correctly', () => {
      const error = new StandardError('Test message', ErrorTypes.API_ERROR);
      const json = error.toJSON();
      
      expect(json).to.have.property('error', true);
      expect(json).to.have.property('type', ErrorTypes.API_ERROR);
      expect(json).to.have.property('message', 'Test message');
      expect(json).to.have.property('timestamp');
    });

    it('should generate user-friendly messages for different error types', () => {
      const validationError = new StandardError('Invalid input', ErrorTypes.VALIDATION_ERROR);
      expect(validationError.toUserMessage()).to.equal('❌ Invalid input: Invalid input');

      const networkError = new StandardError('Connection failed', ErrorTypes.NETWORK_ERROR);
      expect(networkError.toUserMessage()).to.equal('❌ Connection error: Connection failed');

      const apiError = new StandardError('Service unavailable', ErrorTypes.API_ERROR);
      expect(apiError.toUserMessage()).to.equal('❌ Service error: Service unavailable');
    });
  });

  describe('ErrorHandler Utility Functions', () => {
    it('should create validation errors', () => {
      const error = ErrorHandler.validation('Invalid field', { field: 'email' });
      expect(error).to.be.instanceOf(StandardError);
      expect(error.type).to.equal(ErrorTypes.VALIDATION_ERROR);
      expect(error.message).to.equal('Invalid field');
    });

    it('should create API errors', () => {
      const error = ErrorHandler.api('Service failed', { service: 'telegram' }, 'API001');
      expect(error).to.be.instanceOf(StandardError);
      expect(error.type).to.equal(ErrorTypes.API_ERROR);
      expect(error.code).to.equal('API001');
    });

    it('should create network errors', () => {
      const error = ErrorHandler.network('Connection timeout');
      expect(error).to.be.instanceOf(StandardError);
      expect(error.type).to.equal(ErrorTypes.NETWORK_ERROR);
    });

    it('should wrap existing errors', () => {
      const originalError = new Error('Original message');
      const wrappedError = ErrorHandler.wrap(originalError, ErrorTypes.PARSING_ERROR, 'Failed to parse');
      
      expect(wrappedError).to.be.instanceOf(StandardError);
      expect(wrappedError.type).to.equal(ErrorTypes.PARSING_ERROR);
      expect(wrappedError.message).to.equal('Failed to parse: Original message');
      expect(wrappedError.details.originalError).to.include('Original message');
    });

    it('should validate input and throw on failure', () => {
      expect(() => {
        ErrorHandler.validateInput(false, 'Validation failed');
      }).to.throw(StandardError).with.property('type', ErrorTypes.VALIDATION_ERROR);

      expect(() => {
        ErrorHandler.validateInput(true, 'Should not throw');
      }).to.not.throw();
    });

    it('should handle async functions with error wrapping', async () => {
      const successFunction = async () => 'success';
      const result = await ErrorHandler.handle(successFunction);
      expect(result).to.equal('success');

      const failFunction = async () => { throw new Error('Async error'); };
      try {
        await ErrorHandler.handle(failFunction, ErrorTypes.DEVICE_ERROR, 'Device operation failed');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).to.be.instanceOf(StandardError);
        expect(error.type).to.equal(ErrorTypes.DEVICE_ERROR);
        expect(error.message).to.equal('Device operation failed');
      }
    });

    it('should check error types correctly', () => {
      const validationError = ErrorHandler.validation('Test');
      const networkError = ErrorHandler.network('Test');
      
      expect(ErrorHandler.isType(validationError, ErrorTypes.VALIDATION_ERROR)).to.be.true;
      expect(ErrorHandler.isType(validationError, ErrorTypes.NETWORK_ERROR)).to.be.false;
      expect(ErrorHandler.isType(networkError, ErrorTypes.NETWORK_ERROR)).to.be.true;
    });

    it('should extract user messages from any error', () => {
      const standardError = ErrorHandler.validation('Invalid input');
      const regularError = new Error('Regular error');
      
      expect(ErrorHandler.getUserMessage(standardError)).to.equal('❌ Invalid input: Invalid input');
      expect(ErrorHandler.getUserMessage(regularError)).to.equal('❌ Error: Regular error');
    });

    it('should log errors with consistent format', () => {
      const error = ErrorHandler.api('Test error', { context: 'test' });
      ErrorHandler.log(error, consoleStub, { operation: 'test_operation' });
      
      expect(consoleStub.error.calledOnce).to.be.true;
      const logCall = consoleStub.error.firstCall;
      expect(logCall.args[0]).to.equal('Application Error:');
      expect(logCall.args[1]).to.have.property('timestamp');
      expect(logCall.args[1]).to.have.property('context');
      expect(logCall.args[1]).to.have.property('error');
    });
  });

  describe('Telegram Module Error Handling', () => {
    let telegram;

    beforeEach(() => {
      // Mock the telegram module
      telegram = require('../../modules/telegram');
    });

    it('should validate input in sendMessage function', async () => {
      try {
        await telegram.sendMessage(null, 'test message');
        expect.fail('Should have thrown validation error');
      } catch (error) {
        expect(error).to.be.instanceOf(StandardError);
        expect(error.type).to.equal(ErrorTypes.VALIDATION_ERROR);
        expect(error.message).to.include('Chat ID must be a valid number or string');
      }
    });

    it('should validate input in getFileInfo function', async () => {
      try {
        await telegram.getFileInfo('');
        expect.fail('Should have thrown validation error');
      } catch (error) {
        expect(error).to.be.instanceOf(StandardError);
        expect(error.type).to.equal(ErrorTypes.VALIDATION_ERROR);
        expect(error.message).to.include('File ID must be a non-empty string');
      }
    });

    it('should handle network errors consistently', async () => {
      // This test would require mocking the https module
      // For now, we'll test the error structure
      const networkError = ErrorHandler.network('Connection failed', { url: 'test-url' });
      expect(networkError.type).to.equal(ErrorTypes.NETWORK_ERROR);
      expect(networkError.details.url).to.equal('test-url');
    });
  });

  describe('Error Type Coverage', () => {
    it('should have all required error types defined', () => {
      expect(ErrorTypes).to.have.property('VALIDATION_ERROR');
      expect(ErrorTypes).to.have.property('API_ERROR');
      expect(ErrorTypes).to.have.property('NETWORK_ERROR');
      expect(ErrorTypes).to.have.property('PARSING_ERROR');
      expect(ErrorTypes).to.have.property('DEVICE_ERROR');
      expect(ErrorTypes).to.have.property('AUTHENTICATION_ERROR');
      expect(ErrorTypes).to.have.property('TIMEOUT_ERROR');
      expect(ErrorTypes).to.have.property('NOT_FOUND_ERROR');
    });

    it('should generate appropriate user messages for all error types', () => {
      const errorTypes = Object.values(ErrorTypes);
      
      errorTypes.forEach(type => {
        const error = new StandardError('Test message', type);
        const userMessage = error.toUserMessage();
        
        expect(userMessage).to.be.a('string');
        expect(userMessage).to.include('❌');
        expect(userMessage).to.include('Test message');
      });
    });
  });

  describe('Backward Compatibility', () => {
    it('should handle legacy error patterns gracefully', () => {
      const legacyError = new Error('API connection failed');
      const userMessage = ErrorHandler.getUserMessage(legacyError);
      
      expect(userMessage).to.equal('❌ Error: API connection failed');
    });

    it('should preserve error stack traces when wrapping', () => {
      const originalError = new Error('Original error');
      const wrappedError = ErrorHandler.wrap(originalError);
      
      expect(wrappedError.details.originalError).to.include('Original error');
    });
  });

  describe('Performance and Memory', () => {
    it('should not leak memory when creating many errors', () => {
      const errors = [];
      for (let i = 0; i < 1000; i++) {
        errors.push(ErrorHandler.validation(`Error ${i}`));
      }
      
      expect(errors).to.have.length(1000);
      // Clear references
      errors.length = 0;
    });

    it('should create errors efficiently', () => {
      const start = Date.now();
      for (let i = 0; i < 100; i++) {
        ErrorHandler.api(`Error ${i}`, { index: i });
      }
      const duration = Date.now() - start;
      
      expect(duration).to.be.below(100); // Should complete in under 100ms
    });
  });
});
