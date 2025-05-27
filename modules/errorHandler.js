'use strict';

/**
 * Standardized Error Handler Module
 * Provides consistent error handling patterns across the application
 */

/**
 * Standard error types used throughout the application
 */
const ErrorTypes = {
  VALIDATION_ERROR: 'ValidationError',
  API_ERROR: 'ApiError',
  NETWORK_ERROR: 'NetworkError',
  PARSING_ERROR: 'ParsingError',
  DEVICE_ERROR: 'DeviceError',
  AUTHENTICATION_ERROR: 'AuthenticationError',
  TIMEOUT_ERROR: 'TimeoutError',
  NOT_FOUND_ERROR: 'NotFoundError'
};

/**
 * Standard error response format
 */
class StandardError extends Error {
  constructor(message, type = ErrorTypes.API_ERROR, details = null, code = null) {
    super(message);
    this.name = 'StandardError';
    this.type = type;
    this.details = details;
    this.code = code;
    this.timestamp = new Date().toISOString();
  }

  /**
   * Convert error to JSON format for API responses
   */
  toJSON() {
    return {
      error: true,
      type: this.type,
      message: this.message,
      details: this.details,
      code: this.code,
      timestamp: this.timestamp
    };
  }

  /**
   * Convert error to user-friendly message
   */
  toUserMessage() {
    switch (this.type) {
      case ErrorTypes.VALIDATION_ERROR:
        return `❌ Invalid input: ${this.message}`;
      case ErrorTypes.API_ERROR:
        return `❌ Service error: ${this.message}`;
      case ErrorTypes.NETWORK_ERROR:
        return `❌ Connection error: ${this.message}`;
      case ErrorTypes.PARSING_ERROR:
        return `❌ Data format error: ${this.message}`;
      case ErrorTypes.DEVICE_ERROR:
        return `❌ Device error: ${this.message}`;
      case ErrorTypes.AUTHENTICATION_ERROR:
        return `❌ Authentication error: ${this.message}`;
      case ErrorTypes.TIMEOUT_ERROR:
        return `❌ Request timeout: ${this.message}`;
      case ErrorTypes.NOT_FOUND_ERROR:
        return `❌ Not found: ${this.message}`;
      default:
        return `❌ Error: ${this.message}`;
    }
  }
}

/**
 * Error handler utility functions
 */
class ErrorHandler {
  /**
   * Create a validation error
   */
  static validation(message, details = null) {
    return new StandardError(message, ErrorTypes.VALIDATION_ERROR, details);
  }

  /**
   * Create an API error
   */
  static api(message, details = null, code = null) {
    return new StandardError(message, ErrorTypes.API_ERROR, details, code);
  }

  /**
   * Create a network error
   */
  static network(message, details = null) {
    return new StandardError(message, ErrorTypes.NETWORK_ERROR, details);
  }

  /**
   * Create a parsing error
   */
  static parsing(message, details = null) {
    return new StandardError(message, ErrorTypes.PARSING_ERROR, details);
  }

  /**
   * Create a device error
   */
  static device(message, details = null) {
    return new StandardError(message, ErrorTypes.DEVICE_ERROR, details);
  }

  /**
   * Create an authentication error
   */
  static authentication(message, details = null) {
    return new StandardError(message, ErrorTypes.AUTHENTICATION_ERROR, details);
  }

  /**
   * Create a timeout error
   */
  static timeout(message, details = null) {
    return new StandardError(message, ErrorTypes.TIMEOUT_ERROR, details);
  }

  /**
   * Create a not found error
   */
  static notFound(message, details = null) {
    return new StandardError(message, ErrorTypes.NOT_FOUND_ERROR, details);
  }

  /**
   * Wrap an existing error with standard format
   */
  static wrap(error, type = ErrorTypes.API_ERROR, additionalMessage = null) {
    const message = additionalMessage ? `${additionalMessage}: ${error.message}` : error.message;
    return new StandardError(message, type, { originalError: error.stack });
  }

  /**
   * Handle async function with standardized error handling
   */
  static async handle(asyncFunction, errorType = ErrorTypes.API_ERROR, errorMessage = null) {
    try {
      return await asyncFunction();
    } catch (error) {
      if (error instanceof StandardError) {
        throw error;
      }
      const message = errorMessage || error.message;
      throw new StandardError(message, errorType, { originalError: error.stack });
    }
  }

  /**
   * Validate input and throw standardized error if invalid
   */
  static validateInput(condition, message, details = null) {
    if (!condition) {
      throw ErrorHandler.validation(message, details);
    }
  }

  /**
   * Check if error is of specific type
   */
  static isType(error, type) {
    return error instanceof StandardError && error.type === type;
  }

  /**
   * Extract user-friendly message from any error
   */
  static getUserMessage(error) {
    if (error instanceof StandardError) {
      return error.toUserMessage();
    }
    return `❌ Error: ${error.message || 'Unknown error occurred'}`;
  }

  /**
   * Log error with consistent format
   */
  static log(error, logger = console, context = null) {
    const logData = {
      timestamp: new Date().toISOString(),
      context: context,
      error: error instanceof StandardError ? error.toJSON() : {
        message: error.message,
        stack: error.stack
      }
    };
    
    if (error instanceof StandardError) {
      switch (error.type) {
        case ErrorTypes.VALIDATION_ERROR:
        case ErrorTypes.NOT_FOUND_ERROR:
          logger.warn('Application Warning:', logData);
          break;
        case ErrorTypes.NETWORK_ERROR:
        case ErrorTypes.TIMEOUT_ERROR:
          logger.error('Network Error:', logData);
          break;
        default:
          logger.error('Application Error:', logData);
      }
    } else {
      logger.error('Unhandled Error:', logData);
    }
  }
}

module.exports = {
  ErrorTypes,
  StandardError,
  ErrorHandler
};
