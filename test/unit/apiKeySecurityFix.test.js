'use strict';

const { expect } = require('chai');
const sinon = require('sinon');
const crypto = require('crypto');
const { SecureKeyManager, getKeyManager, initializeKeys } = require('../../modules/secureKeyManager');

describe('API Key Security Enhancement Fix', () => {
  let keyManager;
  let consoleStub;

  beforeEach(() => {
    // Create a fresh instance for each test
    keyManager = new SecureKeyManager();
    consoleStub = {
      log: sinon.stub(),
      warn: sinon.stub(),
      error: sinon.stub()
    };
  });

  afterEach(() => {
    sinon.restore();
    // Clear the singleton instance and its state
    const manager = getKeyManager();
    manager.clearAll();

    // Reset the singleton instance for clean tests
    const keyManagerModule = require('../../modules/secureKeyManager');
    if (keyManagerModule.keyManagerInstance) {
      keyManagerModule.keyManagerInstance = null;
    }
  });

  describe('SecureKeyManager Class', () => {
    describe('Key Validation', () => {
      it('should validate traditional OpenAI API keys correctly', () => {
        expect(keyManager.validateApiKey('sk-1234567890abcdef1234567890abcdef12345678', 'openai')).to.be.true;
        expect(keyManager.validateApiKey('sk-1234567890abcdef1234567890abcdef12345678_extra', 'openai')).to.be.true;
        expect(keyManager.validateApiKey('sk-1234567890abcdef1234567890abcdef12345678-extra', 'openai')).to.be.true;
        expect(keyManager.validateApiKey('invalid-key', 'openai')).to.be.false;
        expect(keyManager.validateApiKey('sk-short', 'openai')).to.be.false;
        expect(keyManager.validateApiKey('', 'openai')).to.be.false;
        expect(keyManager.validateApiKey(null, 'openai')).to.be.false;
      });

      it('should validate new OpenAI API key formats (2024)', () => {
        // Project keys
        expect(keyManager.validateApiKey('sk-proj-1234567890abcdef1234567890abcdef12345678', 'openai')).to.be.true;
        expect(keyManager.validateApiKey('sk-proj-1234567890abcdef1234567890abcdef12345678_extra_long_key_with_underscores', 'openai')).to.be.true;

        // User keys
        expect(keyManager.validateApiKey('sk-None-1234567890abcdef1234567890abcdef12345678', 'openai')).to.be.true;
        expect(keyManager.validateApiKey('sk-None-1234567890abcdef1234567890abcdef12345678_extra_long_key', 'openai')).to.be.true;

        // Service account keys
        expect(keyManager.validateApiKey('sk-svcacct-1234567890abcdef1234567890abcdef12345678', 'openai')).to.be.true;
        expect(keyManager.validateApiKey('sk-svcacct-1234567890abcdef1234567890abcdef12345678_extra', 'openai')).to.be.true;

        // Invalid formats
        expect(keyManager.validateApiKey('sk-invalid-prefix-1234567890abcdef1234567890abcdef12345678', 'openai')).to.be.false;
        expect(keyManager.validateApiKey('not-sk-1234567890abcdef1234567890abcdef12345678', 'openai')).to.be.false;
        expect(keyManager.validateApiKey('sk-proj-short', 'openai')).to.be.false;
      });

      it('should validate Telegram bot tokens correctly', () => {
        expect(keyManager.validateApiKey('123456789:ABC-DEF1234ghIkl-zyx57W2v1u123ew11', 'telegram')).to.be.true;
        expect(keyManager.validateApiKey('invalid-token', 'telegram')).to.be.false;
        expect(keyManager.validateApiKey('123:short', 'telegram')).to.be.false;
        expect(keyManager.validateApiKey('', 'telegram')).to.be.false;
        expect(keyManager.validateApiKey(null, 'telegram')).to.be.false;
      });

      it('should validate generic keys with minimum length', () => {
        expect(keyManager.validateApiKey('1234567890', 'generic')).to.be.true;
        expect(keyManager.validateApiKey('short', 'generic')).to.be.false;
      });
    });

    describe('Encryption and Decryption', () => {
      it('should encrypt and decrypt values correctly', () => {
        const originalValue = 'sk-1234567890abcdef1234567890abcdef12345678';
        const encrypted = keyManager.encrypt(originalValue);

        expect(encrypted).to.have.property('encrypted');
        expect(encrypted).to.have.property('iv');
        expect(encrypted.encrypted).to.be.a('string');
        expect(encrypted.iv).to.be.a('string');

        const decrypted = keyManager.decrypt(encrypted);
        expect(decrypted).to.equal(originalValue);
      });

      it('should generate different encrypted values for the same input', () => {
        const value = 'test-value';
        const encrypted1 = keyManager.encrypt(value);
        const encrypted2 = keyManager.encrypt(value);

        expect(encrypted1.encrypted).to.not.equal(encrypted2.encrypted);
        expect(encrypted1.iv).to.not.equal(encrypted2.iv);
      });

      it('should fail to decrypt with corrupted data', () => {
        const originalValue = 'test-value';
        const encrypted = keyManager.encrypt(originalValue);

        // Corrupt the encrypted data
        encrypted.encrypted = 'invalid-encrypted-data';

        expect(() => {
          keyManager.decrypt(encrypted);
        }).to.throw();
      });
    });

    describe('Key Storage and Retrieval', () => {
      it('should store and retrieve API keys securely', () => {
        const openaiKey = 'sk-1234567890abcdef1234567890abcdef12345678';
        const telegramToken = '123456789:ABC-DEF1234ghIkl-zyx57W2v1u123ew11';

        keyManager.setKey('openai', openaiKey, 'openai');
        keyManager.setKey('telegram', telegramToken, 'telegram');

        expect(keyManager.hasKey('openai')).to.be.true;
        expect(keyManager.hasKey('telegram')).to.be.true;
        expect(keyManager.hasKey('nonexistent')).to.be.false;

        expect(keyManager.getKey('openai')).to.equal(openaiKey);
        expect(keyManager.getKey('telegram')).to.equal(telegramToken);
      });

      it('should throw error for invalid API key format', () => {
        expect(() => {
          keyManager.setKey('openai', 'invalid-key', 'openai');
        }).to.throw('Invalid openai API key format');
      });

      it('should throw error for missing key', () => {
        expect(() => {
          keyManager.getKey('nonexistent');
        }).to.throw('API key not found: nonexistent');
      });

      it('should validate input parameters', () => {
        expect(() => {
          keyManager.setKey('', 'sk-1234567890abcdef1234567890abcdef12345678', 'openai');
        }).to.throw('Key ID must be a non-empty string');

        expect(() => {
          keyManager.setKey('openai', '', 'openai');
        }).to.throw('API key must be a non-empty string');

        expect(() => {
          keyManager.setKey('openai', 'sk-1234567890abcdef1234567890abcdef12345678', '');
        }).to.throw('Key type must be specified');
      });
    });

    describe('Key Information and Management', () => {
      it('should provide key information without exposing actual keys', () => {
        const openaiKey = 'sk-1234567890abcdef1234567890abcdef12345678';
        keyManager.setKey('openai', openaiKey, 'openai');

        const keyInfo = keyManager.getKeyInfo('openai');
        expect(keyInfo).to.have.property('keyId', 'openai');
        expect(keyInfo).to.have.property('type', 'openai');
        expect(keyInfo).to.have.property('hash');
        expect(keyInfo).to.have.property('timestamp');
        expect(keyInfo).to.have.property('exists', true);
        expect(keyInfo.hash).to.be.a('string');
        expect(keyInfo.hash).to.have.length(8);
      });

      it('should remove keys correctly', () => {
        const openaiKey = 'sk-1234567890abcdef1234567890abcdef12345678';
        keyManager.setKey('openai', openaiKey, 'openai');

        expect(keyManager.hasKey('openai')).to.be.true;
        const removed = keyManager.removeKey('openai');
        expect(removed).to.be.true;
        expect(keyManager.hasKey('openai')).to.be.false;

        const notRemoved = keyManager.removeKey('nonexistent');
        expect(notRemoved).to.be.false;
      });

      it('should clear all keys', () => {
        keyManager.setKey('openai', 'sk-1234567890abcdef1234567890abcdef12345678', 'openai');
        keyManager.setKey('telegram', '123456789:ABC-DEF1234ghIkl-zyx57W2v1u123ew11', 'telegram');

        expect(keyManager.listKeys()).to.have.length(2);
        keyManager.clearAll();
        expect(keyManager.listKeys()).to.have.length(0);
      });

      it('should validate key accessibility', () => {
        const openaiKey = 'sk-1234567890abcdef1234567890abcdef12345678';
        keyManager.setKey('openai', openaiKey, 'openai');

        expect(keyManager.validateKey('openai')).to.be.true;
        expect(keyManager.validateKey('nonexistent')).to.be.false;
      });

      it('should create authorization headers', () => {
        const openaiKey = 'sk-1234567890abcdef1234567890abcdef12345678';
        keyManager.setKey('openai', openaiKey, 'openai');

        const authHeader = keyManager.createAuthHeader('openai', 'Bearer');
        expect(authHeader).to.equal(`Bearer ${openaiKey}`);

        const botHeader = keyManager.createAuthHeader('openai', 'Bot');
        expect(botHeader).to.equal(`Bot ${openaiKey}`);
      });

      it('should provide statistics', () => {
        keyManager.setKey('openai', 'sk-1234567890abcdef1234567890abcdef12345678', 'openai');
        keyManager.setKey('telegram', '123456789:ABC-DEF1234ghIkl-zyx57W2v1u123ew11', 'telegram');

        const stats = keyManager.getStats();
        expect(stats).to.have.property('totalKeys', 2);
        expect(stats).to.have.property('typeCount');
        expect(stats.typeCount).to.deep.equal({ openai: 1, telegram: 1 });
        expect(stats).to.have.property('encryptionAlgorithm', 'aes-256-cbc');
      });
    });
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = getKeyManager();
      const instance2 = getKeyManager();
      expect(instance1).to.equal(instance2);
    });

    it('should maintain state across calls', () => {
      const manager1 = getKeyManager();
      manager1.setKey('test', 'sk-1234567890abcdef1234567890abcdef12345678', 'openai');

      const manager2 = getKeyManager();
      expect(manager2.hasKey('test')).to.be.true;
      expect(manager2.getKey('test')).to.equal('sk-1234567890abcdef1234567890abcdef12345678');
    });
  });

  describe('initializeKeys Function', () => {
    it('should initialize both OpenAI and Telegram keys', () => {
      const keys = {
        openaiApiKey: 'sk-1234567890abcdef1234567890abcdef12345678',
        telegramBotToken: '123456789:ABC-DEF1234ghIkl-zyx57W2v1u123ew11'
      };

      initializeKeys(keys);

      const manager = getKeyManager();
      expect(manager.hasKey('openai')).to.be.true;
      expect(manager.hasKey('telegram')).to.be.true;
      expect(manager.getKey('openai')).to.equal(keys.openaiApiKey);
      expect(manager.getKey('telegram')).to.equal(keys.telegramBotToken);
    });

    it('should initialize with new OpenAI key formats', () => {
      const keys = {
        openaiApiKey: 'sk-proj-1234567890abcdef1234567890abcdef12345678_extra_long_key'
      };

      initializeKeys(keys);

      const manager = getKeyManager();
      expect(manager.hasKey('openai')).to.be.true;
      expect(manager.getKey('openai')).to.equal(keys.openaiApiKey);
    });

    it('should initialize only provided keys', () => {
      const keys = {
        openaiApiKey: 'sk-None-1234567890abcdef1234567890abcdef12345678'
      };

      initializeKeys(keys);

      const manager = getKeyManager();
      expect(manager.hasKey('openai')).to.be.true;
      expect(manager.hasKey('telegram')).to.be.false;
    });
  });

  describe('Security Features', () => {
    it('should generate unique encryption keys per instance', () => {
      const manager1 = new SecureKeyManager();
      const manager2 = new SecureKeyManager();

      const value = 'test-value';
      const encrypted1 = manager1.encrypt(value);
      const encrypted2 = manager2.encrypt(value);

      expect(encrypted1.encrypted).to.not.equal(encrypted2.encrypted);

      // Each manager should only be able to decrypt its own encrypted data
      expect(manager1.decrypt(encrypted1)).to.equal(value);
      expect(manager2.decrypt(encrypted2)).to.equal(value);

      expect(() => {
        manager1.decrypt(encrypted2);
      }).to.throw();
    });

    it('should generate consistent hashes for the same key', () => {
      const key = 'sk-1234567890abcdef1234567890abcdef12345678';
      const hash1 = keyManager.generateKeyHash(key);
      const hash2 = keyManager.generateKeyHash(key);

      expect(hash1).to.equal(hash2);
      expect(hash1).to.have.length(8);
    });

    it('should not expose keys in logs or errors', () => {
      const openaiKey = 'sk-1234567890abcdef1234567890abcdef12345678';
      keyManager.setKey('openai', openaiKey, 'openai');

      const keyInfo = keyManager.getKeyInfo('openai');
      const stats = keyManager.getStats();
      const keyList = keyManager.listKeys();

      // Ensure no actual key values are exposed
      expect(JSON.stringify(keyInfo)).to.not.include(openaiKey);
      expect(JSON.stringify(stats)).to.not.include(openaiKey);
      expect(JSON.stringify(keyList)).to.not.include(openaiKey);
    });
  });

  describe('Error Handling', () => {
    it('should handle encryption errors gracefully', () => {
      // Test with invalid input
      expect(() => {
        keyManager.encrypt(null);
      }).to.throw();

      expect(() => {
        keyManager.encrypt(undefined);
      }).to.throw();
    });

    it('should handle decryption errors gracefully', () => {
      expect(() => {
        keyManager.decrypt({ encrypted: 'invalid', iv: 'invalid', authTag: 'invalid' });
      }).to.throw();

      expect(() => {
        keyManager.decrypt(null);
      }).to.throw();
    });
  });

  describe('Memory Management', () => {
    it('should not leak sensitive data in memory', () => {
      const openaiKey = 'sk-1234567890abcdef1234567890abcdef12345678';
      keyManager.setKey('openai', openaiKey, 'openai');

      // Get the key and then remove it
      const retrievedKey = keyManager.getKey('openai');
      expect(retrievedKey).to.equal(openaiKey);

      keyManager.removeKey('openai');
      expect(keyManager.hasKey('openai')).to.be.false;
    });

    it('should handle large numbers of keys efficiently', () => {
      const start = Date.now();

      // Store 100 keys
      for (let i = 0; i < 100; i++) {
        keyManager.setKey(`key${i}`, 'sk-1234567890abcdef1234567890abcdef12345678', 'openai');
      }

      // Retrieve all keys
      for (let i = 0; i < 100; i++) {
        keyManager.getKey(`key${i}`);
      }

      const duration = Date.now() - start;
      expect(duration).to.be.below(1000); // Should complete in under 1 second

      // Clean up
      keyManager.clearAll();
    });
  });
});
