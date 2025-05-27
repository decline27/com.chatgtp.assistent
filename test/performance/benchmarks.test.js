'use strict';

/**
 * Performance Tests and Benchmarks
 * Tests system performance under various load conditions
 */

const { expect, TEST_CONFIG, TestDataGenerators } = require('../utils/testSetup');
const { createMockHomeState, createMockLLMFunction } = require('../utils/mockHomeyAPI');
const { handleStatusQuery } = require('../../modules/statusQueryHandler');
const { processMultilingualCommand } = require('../../modules/multilingualProcessor');
const { preprocessCommand } = require('../../modules/commandProcessor');
const { comprehensiveRoomMatch } = require('../../modules/advancedMultilingualMatcher');

describe('Performance Benchmarks', function() {
  this.timeout(TEST_CONFIG.timeout.performance);

  let mockHomeState;
  let mockLLMFunction;
  let largeHomeState;

  beforeEach(function() {
    mockHomeState = createMockHomeState();
    mockLLMFunction = createMockLLMFunction();
    
    // Create a large home state for stress testing
    largeHomeState = createMockHomeState();
    
    // Add many devices and zones
    for (let i = 0; i < 100; i++) {
      const zoneId = `zone_${i}`;
      const zoneName = `Room ${i}`;
      
      largeHomeState.zones[zoneId] = {
        id: zoneId,
        name: zoneName
      };
      
      // Add multiple devices per zone
      for (let j = 0; j < 5; j++) {
        const deviceId = `device_${i}_${j}`;
        const deviceClasses = ['light', 'speaker', 'thermostat', 'lock', 'sensor'];
        const deviceClass = deviceClasses[j % deviceClasses.length];
        
        largeHomeState.devices[deviceId] = {
          id: deviceId,
          name: `${zoneName} ${deviceClass} ${j}`,
          class: deviceClass,
          zone: zoneId,
          available: Math.random() > 0.1, // 90% online
          capabilities: ['onoff'],
          capabilitiesObj: { onoff: { value: Math.random() > 0.5 } },
          getCapabilityValue: async () => Math.random() > 0.5,
          setCapabilityValue: async () => true
        };
      }
    }
  });

  describe('Command Processing Performance', function() {
    it('should process simple commands quickly', function() {
      const commands = [
        'Turn on kitchen lights',
        'Dim bedroom to 50%',
        'Set temperature to 22',
        'Play music in living room'
      ];

      const startTime = Date.now();
      
      commands.forEach(command => {
        const result = processMultilingualCommand(command, 'en');
        expect(result).to.have.property('confidence').above(0.5);
      });
      
      const endTime = Date.now();
      const avgTime = (endTime - startTime) / commands.length;
      
      expect(avgTime).to.be.below(50); // Should average under 50ms per command
    });

    it('should handle batch command processing efficiently', function() {
      const commands = [];
      
      // Generate 50 commands across different languages
      TEST_CONFIG.languages.forEach(language => {
        const langCommands = TestDataGenerators.generateMultilingualCommands(language);
        commands.push(...langCommands.slice(0, 6)); // 6 commands per language
      });

      const startTime = Date.now();
      
      const results = commands.map(command => 
        processMultilingualCommand(command, 'auto')
      );
      
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      const avgTime = totalTime / commands.length;
      
      expect(avgTime).to.be.below(100); // Should average under 100ms per command
      expect(totalTime).to.be.below(5000); // Total should be under 5 seconds
      
      // Verify all commands were processed successfully
      results.forEach(result => {
        expect(result).to.have.property('confidence').that.is.a('number');
      });
    });

    it('should handle concurrent command processing', async function() {
      const commands = [
        'Turn on kitchen lights',
        'Sätt på vardagsrum ljus',
        'Allumer les lumières du salon',
        'Licht einschalten im Wohnzimmer',
        'Encender luces de la cocina'
      ];

      const startTime = Date.now();
      
      const promises = commands.map(command => 
        Promise.resolve(processMultilingualCommand(command, 'auto'))
      );
      
      const results = await Promise.all(promises);
      
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      
      expect(totalTime).to.be.below(1000); // Should complete within 1 second
      
      results.forEach(result => {
        expect(result).to.have.property('confidence').above(0.5);
      });
    });
  });

  describe('Status Query Performance', function() {
    it('should handle status queries on large home states efficiently', async function() {
      const queries = [
        'Show me all devices',
        'What\'s the status of lights?',
        'Tell me about Room 50',
        'Show me devices in Room 25'
      ];

      for (const query of queries) {
        const startTime = Date.now();
        
        const result = await handleStatusQuery(
          query,
          'en',
          largeHomeState,
          mockLLMFunction,
          { maxDevices: 20 }
        );
        
        const endTime = Date.now();
        const queryTime = endTime - startTime;
        
        expect(queryTime).to.be.below(2000); // Should complete within 2 seconds
        expect(result).to.have.property('success');
      }
    });

    it('should handle concurrent status queries', async function() {
      const queries = [
        'Show me kitchen devices',
        'What\'s the status of bedroom?',
        'Tell me about living room',
        'How are the lights?',
        'Show me all thermostats'
      ];

      const startTime = Date.now();
      
      const promises = queries.map(query => 
        handleStatusQuery(query, 'en', mockHomeState, mockLLMFunction)
      );
      
      const results = await Promise.all(promises);
      
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      
      expect(totalTime).to.be.below(3000); // Should complete within 3 seconds
      
      results.forEach(result => {
        expect(result).to.have.property('success');
      });
    });

    it('should limit response size for large device sets', async function() {
      const result = await handleStatusQuery(
        'Show me all devices',
        'en',
        largeHomeState,
        mockLLMFunction,
        { maxDevices: 10 }
      );

      expect(result).to.have.property('success', true);
      
      // Response should be limited in size
      expect(result.formattedText.length).to.be.below(5000); // Under 5KB
      
      // Should mention the limit
      expect(result.formattedText).to.include('10');
    });
  });

  describe('Room Matching Performance', function() {
    it('should perform fuzzy room matching quickly', async function() {
      const roomNames = Array.from({ length: 100 }, (_, i) => `Room ${i}`);
      const testInputs = [
        'room 50',
        'rom 25', // Typo
        'room fifty',
        'bedroom',
        'kitchen'
      ];

      for (const input of testInputs) {
        const startTime = Date.now();
        
        const result = await comprehensiveRoomMatch(
          input,
          roomNames,
          'en',
          mockLLMFunction
        );
        
        const endTime = Date.now();
        const matchTime = endTime - startTime;
        
        expect(matchTime).to.be.below(500); // Should complete within 500ms
        expect(result).to.have.property('match');
        expect(result).to.have.property('confidence');
      }
    });

    it('should handle large room lists efficiently', async function() {
      const largeRoomList = Array.from({ length: 1000 }, (_, i) => `Room ${i}`);
      
      const startTime = Date.now();
      
      const result = await comprehensiveRoomMatch(
        'room 500',
        largeRoomList,
        'en',
        mockLLMFunction
      );
      
      const endTime = Date.now();
      const matchTime = endTime - startTime;
      
      expect(matchTime).to.be.below(1000); // Should complete within 1 second
      expect(result).to.have.property('match', 'Room 500');
      expect(result).to.have.property('confidence', 1.0);
    });
  });

  describe('Memory Usage', function() {
    it('should not leak memory during repeated operations', function() {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Perform many operations
      for (let i = 0; i < 1000; i++) {
        const command = `Turn on device ${i}`;
        processMultilingualCommand(command, 'en');
      }
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      // Memory increase should be reasonable (under 50MB)
      expect(memoryIncrease).to.be.below(50 * 1024 * 1024);
    });

    it('should handle large data structures efficiently', async function() {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Process status query on large home state
      await handleStatusQuery(
        'Show me all devices',
        'en',
        largeHomeState,
        mockLLMFunction,
        { maxDevices: 50 }
      );
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      // Memory increase should be reasonable
      expect(memoryIncrease).to.be.below(20 * 1024 * 1024); // Under 20MB
    });
  });

  describe('Stress Testing', function() {
    it('should handle rapid-fire commands without degradation', function() {
      const commands = Array.from({ length: 100 }, (_, i) => 
        `Turn on device ${i} in room ${i % 10}`
      );

      const times = [];
      
      commands.forEach(command => {
        const startTime = Date.now();
        const result = processMultilingualCommand(command, 'en');
        const endTime = Date.now();
        
        times.push(endTime - startTime);
        expect(result).to.have.property('confidence').above(0.5);
      });

      // Performance should not degrade significantly
      const firstHalf = times.slice(0, 50);
      const secondHalf = times.slice(50);
      
      const avgFirstHalf = firstHalf.reduce((a, b) => a + b) / firstHalf.length;
      const avgSecondHalf = secondHalf.reduce((a, b) => a + b) / secondHalf.length;
      
      // Second half should not be more than 50% slower than first half
      expect(avgSecondHalf).to.be.below(avgFirstHalf * 1.5);
    });

    it('should handle mixed workload efficiently', async function() {
      const operations = [];
      
      // Mix of different operation types
      for (let i = 0; i < 50; i++) {
        operations.push({
          type: 'command',
          data: `Turn on device ${i}`
        });
        
        operations.push({
          type: 'status',
          data: `Show me room ${i % 10} devices`
        });
        
        operations.push({
          type: 'multilingual',
          data: `Sätt på enhet ${i}`
        });
      }

      const startTime = Date.now();
      
      for (const operation of operations) {
        switch (operation.type) {
          case 'command':
            processMultilingualCommand(operation.data, 'en');
            break;
          case 'status':
            await handleStatusQuery(operation.data, 'en', mockHomeState, mockLLMFunction);
            break;
          case 'multilingual':
            processMultilingualCommand(operation.data, 'sv');
            break;
        }
      }
      
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      const avgTime = totalTime / operations.length;
      
      expect(avgTime).to.be.below(200); // Should average under 200ms per operation
      expect(totalTime).to.be.below(30000); // Should complete within 30 seconds
    });
  });

  describe('Scalability Limits', function() {
    it('should handle maximum reasonable home size', async function() {
      // Create an extremely large home state
      const extremeHomeState = createMockHomeState();
      
      // Add 1000 zones and 5000 devices
      for (let i = 0; i < 1000; i++) {
        const zoneId = `zone_${i}`;
        extremeHomeState.zones[zoneId] = {
          id: zoneId,
          name: `Zone ${i}`
        };
        
        for (let j = 0; j < 5; j++) {
          const deviceId = `device_${i}_${j}`;
          extremeHomeState.devices[deviceId] = {
            id: deviceId,
            name: `Device ${i}-${j}`,
            class: 'light',
            zone: zoneId,
            available: true,
            capabilities: ['onoff'],
            capabilitiesObj: { onoff: { value: false } },
            getCapabilityValue: async () => false,
            setCapabilityValue: async () => true
          };
        }
      }

      const startTime = Date.now();
      
      const result = await handleStatusQuery(
        'Show me all devices',
        'en',
        extremeHomeState,
        mockLLMFunction,
        { maxDevices: 100 }
      );
      
      const endTime = Date.now();
      const queryTime = endTime - startTime;
      
      expect(queryTime).to.be.below(10000); // Should complete within 10 seconds
      expect(result).to.have.property('success', true);
    });
  });
});
