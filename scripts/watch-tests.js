#!/usr/bin/env node

'use strict';

/**
 * Test Watcher
 * Automatically runs tests when files change during development
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// Configuration
const WATCH_DIRS = [
  'modules',
  'test',
  'app.js'
];

const WATCH_EXTENSIONS = ['.js'];
const DEBOUNCE_DELAY = 1000; // ms

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function colorize(text, color) {
  return `${colors[color]}${text}${colors.reset}`;
}

function log(message, color = 'reset') {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`${colorize(`[${timestamp}]`, 'cyan')} ${colorize(message, color)}`);
}

class TestWatcher {
  constructor() {
    this.watchers = new Map();
    this.debounceTimer = null;
    this.isRunning = false;
    this.lastRunTime = 0;
  }

  start() {
    log('🔍 Starting test watcher...', 'cyan');
    log(`📁 Watching directories: ${WATCH_DIRS.join(', ')}`, 'blue');
    log(`📄 Watching extensions: ${WATCH_EXTENSIONS.join(', ')}`, 'blue');
    log('💡 Press Ctrl+C to stop, or type "rs" + Enter to restart tests', 'yellow');
    log('');

    // Watch directories
    WATCH_DIRS.forEach(dir => this.watchDirectory(dir));

    // Watch for manual restart
    this.setupManualRestart();

    // Run initial test
    this.runTests('Initial run');
  }

  watchDirectory(dirPath) {
    const fullPath = path.resolve(dirPath);

    if (!fs.existsSync(fullPath)) {
      log(`⚠️  Directory not found: ${dirPath}`, 'yellow');
      return;
    }

    try {
      const watcher = fs.watch(fullPath, { recursive: true }, (eventType, filename) => {
        if (!filename) return;

        const ext = path.extname(filename);
        if (!WATCH_EXTENSIONS.includes(ext)) return;

        const filePath = path.join(dirPath, filename);
        this.onFileChange(eventType, filePath);
      });

      this.watchers.set(dirPath, watcher);
      log(`👀 Watching: ${dirPath}`, 'green');
    } catch (error) {
      log(`❌ Failed to watch ${dirPath}: ${error.message}`, 'red');
    }
  }

  onFileChange(eventType, filePath) {
    if (this.isRunning) return;

    log(`📝 File ${eventType}: ${filePath}`, 'blue');

    // Debounce rapid file changes
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.runTests(`File changed: ${filePath}`);
    }, DEBOUNCE_DELAY);
  }

  setupManualRestart() {
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', data => {
      const input = data.toString().trim().toLowerCase();

      if (input === 'rs' || input === 'restart') {
        log('🔄 Manual restart triggered', 'yellow');
        this.runTests('Manual restart');
      } else if (input === 'q' || input === 'quit') {
        this.stop();
      } else if (input === 'h' || input === 'help') {
        this.showHelp();
      }
    });
  }

  showHelp() {
    log('');
    log('📖 Available commands:', 'cyan');
    log('  rs, restart - Manually restart tests', 'blue');
    log('  q, quit     - Stop the watcher', 'blue');
    log('  h, help     - Show this help', 'blue');
    log('');
  }

  async runTests(reason) {
    if (this.isRunning) {
      log('⏳ Tests already running, skipping...', 'yellow');
      return;
    }

    // Prevent running tests too frequently
    const now = Date.now();
    if (now - this.lastRunTime < 2000) {
      log('⏳ Tests ran recently, skipping...', 'yellow');
      return;
    }

    this.isRunning = true;
    this.lastRunTime = now;

    log('');
    log('='.repeat(60), 'cyan');
    log(`🧪 Running tests: ${reason}`, 'bright');
    log('='.repeat(60), 'cyan');

    try {
      // Run unit tests first (fastest)
      const unitResult = await this.runTestSuite('Unit Tests', 'npm run test:unit');

      if (unitResult.success) {
        // If unit tests pass, run integration tests
        await this.runTestSuite('Integration Tests', 'npm run test:integration');
      } else {
        log('❌ Skipping integration tests due to unit test failures', 'yellow');
      }

    } catch (error) {
      log(`❌ Test execution failed: ${error.message}`, 'red');
    } finally {
      this.isRunning = false;
      log('');
      log('👀 Watching for changes...', 'cyan');
    }
  }

  async runTestSuite(name, command) {
    log(`\n🔧 Running ${name}...`, 'blue');

    return new Promise(resolve => {
      const startTime = Date.now();
      const [cmd, ...args] = command.split(' ');
      const child = spawn(cmd, args, {
        stdio: 'pipe',
        shell: true
      });

      let output = '';
      let hasOutput = false;

      child.stdout.on('data', data => {
        output += data.toString();
        hasOutput = true;
      });

      child.stderr.on('data', data => {
        output += data.toString();
        hasOutput = true;
      });

      child.on('close', code => {
        const duration = Date.now() - startTime;
        const success = code === 0;

        if (success) {
          log(`✅ ${name} passed (${(duration / 1000).toFixed(2)}s)`, 'green');
        } else {
          log(`❌ ${name} failed (${(duration / 1000).toFixed(2)}s)`, 'red');

          // Show relevant error output
          if (hasOutput) {
            const lines = output.split('\n');
            const errorLines = lines.filter(line => line.includes('failing')
              || line.includes('Error:')
              || line.includes('AssertionError')
              || line.includes('✗')
              || line.includes('❌')).slice(0, 5); // Show first 5 error lines

            if (errorLines.length > 0) {
              log('📋 Error summary:', 'yellow');
              errorLines.forEach(line => {
                log(`   ${line.trim()}`, 'red');
              });
            }
          }
        }

        resolve({ success, duration, output });
      });

      child.on('error', error => {
        log(`❌ ${name} execution error: ${error.message}`, 'red');
        resolve({ success: false, duration: 0, output: '' });
      });
    });
  }

  stop() {
    log('🛑 Stopping test watcher...', 'yellow');

    // Close all watchers
    this.watchers.forEach((watcher, dir) => {
      try {
        watcher.close();
        log(`👋 Stopped watching: ${dir}`, 'blue');
      } catch (error) {
        log(`⚠️  Error closing watcher for ${dir}: ${error.message}`, 'yellow');
      }
    });

    this.watchers.clear();

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    log('✅ Test watcher stopped', 'green');
    process.exit(0);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n');
  log('🛑 Received SIGINT, shutting down...', 'yellow');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n');
  log('🛑 Received SIGTERM, shutting down...', 'yellow');
  process.exit(0);
});

// Start the watcher
if (require.main === module) {
  const watcher = new TestWatcher();
  watcher.start();
}

module.exports = TestWatcher;
