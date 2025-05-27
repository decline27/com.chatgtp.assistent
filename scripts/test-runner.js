#!/usr/bin/env node
'use strict';

/**
 * Automated Test Runner
 * Runs comprehensive test suites and generates reports
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Test configuration
const TEST_SUITES = {
  unit: {
    name: 'Unit Tests',
    command: 'npm run test:unit',
    timeout: 30000
  },
  integration: {
    name: 'Integration Tests',
    command: 'npm run test:integration',
    timeout: 60000
  },
  regression: {
    name: 'Regression Tests',
    command: 'npm run test:regression',
    timeout: 30000
  },
  performance: {
    name: 'Performance Tests',
    command: 'npm run test:performance',
    timeout: 120000
  },
  legacy: {
    name: 'Legacy Tests',
    command: 'npm run test:legacy',
    timeout: 60000
  },
  coverage: {
    name: 'Coverage Report',
    command: 'npm run test:coverage',
    timeout: 90000
  }
};

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function colorize(text, color) {
  return `${colors[color]}${text}${colors.reset}`;
}

function log(message, color = 'reset') {
  console.log(colorize(message, color));
}

function logHeader(message) {
  const border = '='.repeat(60);
  log(border, 'cyan');
  log(message, 'bright');
  log(border, 'cyan');
}

function logSection(message) {
  log(`\n${'-'.repeat(40)}`, 'blue');
  log(message, 'blue');
  log('-'.repeat(40), 'blue');
}

async function runCommand(command, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const [cmd, ...args] = command.split(' ');
    const child = spawn(cmd, args, { 
      stdio: 'pipe',
      shell: true 
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`Command timed out after ${timeout}ms`));
    }, timeout);

    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({
        code,
        stdout,
        stderr,
        success: code === 0
      });
    });

    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

function parseTestResults(output) {
  const results = {
    total: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
    duration: 0
  };

  // Parse Mocha output
  const passMatch = output.match(/(\d+) passing/);
  const failMatch = output.match(/(\d+) failing/);
  const skipMatch = output.match(/(\d+) pending/);
  const durationMatch = output.match(/(\d+(?:\.\d+)?)(ms|s)/);

  if (passMatch) results.passed = parseInt(passMatch[1]);
  if (failMatch) results.failed = parseInt(failMatch[1]);
  if (skipMatch) results.skipped = parseInt(skipMatch[1]);
  
  results.total = results.passed + results.failed + results.skipped;

  if (durationMatch) {
    const value = parseFloat(durationMatch[1]);
    const unit = durationMatch[2];
    results.duration = unit === 's' ? value * 1000 : value;
  }

  return results;
}

function generateReport(suiteResults) {
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      totalSuites: Object.keys(suiteResults).length,
      passedSuites: 0,
      failedSuites: 0,
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      skippedTests: 0,
      totalDuration: 0
    },
    suites: suiteResults
  };

  Object.values(suiteResults).forEach(suite => {
    if (suite.success) {
      report.summary.passedSuites++;
    } else {
      report.summary.failedSuites++;
    }

    if (suite.results) {
      report.summary.totalTests += suite.results.total;
      report.summary.passedTests += suite.results.passed;
      report.summary.failedTests += suite.results.failed;
      report.summary.skippedTests += suite.results.skipped;
      report.summary.totalDuration += suite.results.duration;
    }
  });

  return report;
}

function saveReport(report) {
  const reportsDir = path.join(__dirname, '..', 'test-reports');
  
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportFile = path.join(reportsDir, `test-report-${timestamp}.json`);
  
  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
  
  return reportFile;
}

function printSummary(report) {
  logHeader('TEST EXECUTION SUMMARY');
  
  log(`Total Test Suites: ${report.summary.totalSuites}`);
  log(`Passed Suites: ${colorize(report.summary.passedSuites, 'green')}`);
  log(`Failed Suites: ${colorize(report.summary.failedSuites, 'red')}`);
  log('');
  log(`Total Tests: ${report.summary.totalTests}`);
  log(`Passed: ${colorize(report.summary.passedTests, 'green')}`);
  log(`Failed: ${colorize(report.summary.failedTests, 'red')}`);
  log(`Skipped: ${colorize(report.summary.skippedTests, 'yellow')}`);
  log('');
  log(`Total Duration: ${(report.summary.totalDuration / 1000).toFixed(2)}s`);
  
  const successRate = ((report.summary.passedTests / report.summary.totalTests) * 100).toFixed(1);
  log(`Success Rate: ${colorize(successRate + '%', successRate > 90 ? 'green' : successRate > 70 ? 'yellow' : 'red')}`);
  
  log('');
  logSection('Suite Details');
  
  Object.entries(report.suites).forEach(([suiteName, suite]) => {
    const status = suite.success ? colorize('✅ PASSED', 'green') : colorize('❌ FAILED', 'red');
    const duration = suite.results ? `(${(suite.results.duration / 1000).toFixed(2)}s)` : '';
    log(`${suite.name}: ${status} ${duration}`);
    
    if (suite.results) {
      log(`  Tests: ${suite.results.passed}/${suite.results.total} passed`);
    }
    
    if (!suite.success && suite.error) {
      log(`  Error: ${colorize(suite.error, 'red')}`);
    }
  });
}

async function runTestSuite(suiteName, suite) {
  logSection(`Running ${suite.name}`);
  
  try {
    const result = await runCommand(suite.command, suite.timeout);
    
    const suiteResult = {
      name: suite.name,
      command: suite.command,
      success: result.success,
      results: parseTestResults(result.stdout),
      output: result.stdout,
      error: result.success ? null : result.stderr
    };

    if (result.success) {
      log(`✅ ${suite.name} completed successfully`, 'green');
      if (suiteResult.results.total > 0) {
        log(`   ${suiteResult.results.passed}/${suiteResult.results.total} tests passed`);
      }
    } else {
      log(`❌ ${suite.name} failed`, 'red');
      if (suiteResult.results.failed > 0) {
        log(`   ${suiteResult.results.failed} tests failed`);
      }
    }

    return suiteResult;
  } catch (error) {
    log(`❌ ${suite.name} failed with error: ${error.message}`, 'red');
    
    return {
      name: suite.name,
      command: suite.command,
      success: false,
      results: null,
      output: '',
      error: error.message
    };
  }
}

async function main() {
  const args = process.argv.slice(2);
  const suitesToRun = args.length > 0 ? args : Object.keys(TEST_SUITES);
  
  logHeader('HOMEY CHATGPT ASSISTANT - AUTOMATED TEST RUNNER');
  
  log(`Running test suites: ${suitesToRun.join(', ')}`, 'cyan');
  log(`Start time: ${new Date().toISOString()}`, 'cyan');
  log('');

  const suiteResults = {};
  const startTime = Date.now();

  for (const suiteName of suitesToRun) {
    if (!TEST_SUITES[suiteName]) {
      log(`⚠️  Unknown test suite: ${suiteName}`, 'yellow');
      continue;
    }

    suiteResults[suiteName] = await runTestSuite(suiteName, TEST_SUITES[suiteName]);
  }

  const endTime = Date.now();
  const totalDuration = endTime - startTime;

  log('');
  log(`Total execution time: ${(totalDuration / 1000).toFixed(2)}s`, 'cyan');

  const report = generateReport(suiteResults);
  const reportFile = saveReport(report);
  
  log('');
  printSummary(report);
  
  log('');
  log(`📊 Detailed report saved to: ${reportFile}`, 'cyan');
  
  // Exit with error code if any tests failed
  const hasFailures = report.summary.failedSuites > 0 || report.summary.failedTests > 0;
  process.exit(hasFailures ? 1 : 0);
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    log(`Fatal error: ${error.message}`, 'red');
    process.exit(1);
  });
}

module.exports = { runTestSuite, generateReport, parseTestResults };
