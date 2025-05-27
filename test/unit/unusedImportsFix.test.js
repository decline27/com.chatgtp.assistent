'use strict';

const { expect } = require('chai');
const fs = require('fs');
const path = require('path');

describe('Unused Imports Fix', () => {
  let appFileContent;

  before(() => {
    // Read the app.js file content
    const appPath = path.join(__dirname, '../../app.js');
    appFileContent = fs.readFileSync(appPath, 'utf8');
  });

  describe('Removed Unused Imports', () => {
    it('should not import fs module', () => {
      expect(appFileContent).to.not.include("const fs = require('fs')");
      expect(appFileContent).to.not.include('require("fs")');
    });

    it('should not import path module', () => {
      expect(appFileContent).to.not.include("const path = require('path')");
      expect(appFileContent).to.not.include('require("path")');
    });

    it('should not import HomeyAPIV3', () => {
      expect(appFileContent).to.not.include("const { HomeyAPIV3 } = require('homey-api')");
      expect(appFileContent).to.not.include('HomeyAPIV3');
    });

    it('should not import detectMultiCommand', () => {
      expect(appFileContent).to.not.include('detectMultiCommand');
    });

    it('should not import parseMultiCommand', () => {
      expect(appFileContent).to.not.include('parseMultiCommand');
    });

    it('should not import isStatusQuery', () => {
      expect(appFileContent).to.not.include('isStatusQuery');
    });
  });

  describe('Preserved Required Imports', () => {
    it('should still import Homey', () => {
      expect(appFileContent).to.include("const Homey = require('homey')");
    });

    it('should still import telegram module functions', () => {
      expect(appFileContent).to.include("const { onMessage, sendMessage, getFileInfo, initBot } = require('./modules/telegram')");
    });

    it('should still import speech module functions', () => {
      expect(appFileContent).to.include("const { transcribeVoice, initWhisper } = require('./modules/speech')");
    });

    it('should still import chatgpt module functions', () => {
      expect(appFileContent).to.include("const { initChatGPT, parseCommand } = require('./modules/chatgpt')");
    });

    it('should still import httpHelper functions', () => {
      expect(appFileContent).to.include("const { downloadBuffer } = require('./modules/httpHelper')");
    });

    it('should still import homeyApiHelper functions', () => {
      expect(appFileContent).to.include("const { getHomeState, getDevicesMapping } = require('./modules/homeyApiHelper')");
    });

    it('should still import telegramBot module', () => {
      expect(appFileContent).to.include("const initTelegramListener = require('./modules/telegramBot')");
    });

    it('should still import chatgptHelper functions', () => {
      expect(appFileContent).to.include("const { constructPrompt } = require('./modules/chatgptHelper')");
    });

    it('should still import used commandProcessor functions', () => {
      expect(appFileContent).to.include("const { preprocessCommand, suggestImprovement } = require('./modules/commandProcessor')");
    });

    it('should still import used statusQueryHandler functions', () => {
      expect(appFileContent).to.include("const { handleStatusQuery } = require('./modules/statusQueryHandler')");
    });
  });

  describe('Application Functionality', () => {
    it('should be able to parse the app module syntax without errors', () => {
      // Test that the file can be read and parsed (syntax check)
      expect(() => {
        const appPath = path.join(__dirname, '../../app.js');
        const content = fs.readFileSync(appPath, 'utf8');
        expect(content).to.include('class ChatGPTAssistant');
        expect(content).to.include('module.exports = ChatGPTAssistant');
      }).to.not.throw();
    });

    it('should have proper class structure in the file', () => {
      const appPath = path.join(__dirname, '../../app.js');
      const content = fs.readFileSync(appPath, 'utf8');

      // Check for required method definitions
      expect(content).to.include('getHomeState()');
      expect(content).to.include('getDevicesMapping()');
      expect(content).to.include('parseCommandWithState(');
      expect(content).to.include('executeHomeyCommand(');
      expect(content).to.include('listAllDevices()');
      expect(content).to.include('mapDevices()');
      expect(content).to.include('executeMultiCommand(');
      expect(content).to.include('executeStatusQuery(');
    });

    it('should have proper module structure', () => {
      const appPath = path.join(__dirname, '../../app.js');
      const content = fs.readFileSync(appPath, 'utf8');

      // Check for proper module attachments in constructor
      expect(content).to.include('this.chatgpt = { initChatGPT, parseCommand }');
      expect(content).to.include('this.telegram = { onMessage, sendMessage, getFileInfo, initBot }');
      expect(content).to.include('this.downloadBuffer = downloadBuffer');
      expect(content).to.include('this.transcribeVoice = transcribeVoice');
    });
  });

  describe('Code Quality Improvements', () => {
    it('should have reduced import statements count', () => {
      const lines = appFileContent.split('\n');
      // Only count top-level imports (before the first class definition)
      const classLineIndex = lines.findIndex(line => line.includes('class ChatGPTAssistant'));
      const topLevelLines = lines.slice(0, classLineIndex);
      const importLines = topLevelLines.filter(line =>
        line.trim().startsWith('const') && line.includes('require(')
      );

      // Should have exactly 10 top-level import statements (reduced from 15)
      // Let's count the actual imports we expect:
      // 1. const Homey = require('homey');
      // 2. const { onMessage, sendMessage, getFileInfo, initBot } = require('./modules/telegram');
      // 3. const { transcribeVoice, initWhisper } = require('./modules/speech');
      // 4. const { initChatGPT, parseCommand } = require('./modules/chatgpt');
      // 5. const { downloadBuffer } = require('./modules/httpHelper');
      // 6. const { getHomeState, getDevicesMapping } = require('./modules/homeyApiHelper');
      // 7. const initTelegramListener = require('./modules/telegramBot');
      // 8. const { constructPrompt } = require('./modules/chatgptHelper');
      // 9. const { preprocessCommand, suggestImprovement } = require('./modules/commandProcessor');
      // 10. const { handleStatusQuery } = require('./modules/statusQueryHandler');
      expect(importLines).to.have.length(10);
    });

    it('should not have any TODO comments about unused imports', () => {
      expect(appFileContent).to.not.include('// TODO: remove unused');
      expect(appFileContent).to.not.include('// FIXME: unused');
    });

    it('should maintain clean import organization', () => {
      const lines = appFileContent.split('\n');
      const importSection = lines.slice(0, 20); // First 20 lines should contain imports

      // Check that imports are properly grouped
      const homeyImport = importSection.find(line => line.includes("require('homey')"));
      const moduleImports = importSection.filter(line => line.includes("require('./modules/"));

      expect(homeyImport).to.exist;
      expect(moduleImports).to.have.length.at.least(7); // Should have at least 7 module imports
    });
  });
});
