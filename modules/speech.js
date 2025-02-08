'use strict';

const https = require('https');
const fs = require('fs');

let whisperApiKey = null;

/**
 * Initialize the Whisper API key.
 * @param {string} apiKey - The OpenAI API key for Whisper.
 */
function initWhisper(apiKey) {
  if (!apiKey) {
    throw new Error('Whisper API key is required');
  }
  whisperApiKey = apiKey;
}

/**
 * Create a unique multipart form-data boundary.
 * @returns {string} A unique boundary string.
 */
function generateBoundary() {
  return '---------------------------' + Date.now().toString();
}

/**
 * Create multipart form-data body.
 * @param {Buffer|string} input - Either a Buffer containing the file data or a file path to the audio file.
 * @param {string} boundary - The form-data boundary string.
 * @returns {Buffer} The complete form-data as a Buffer.
 */
function createFormData(input, boundary) {
  let fileContent;
  if (Buffer.isBuffer(input)) {
    fileContent = input;
  } else if (typeof input === 'string') {
    fileContent = fs.readFileSync(input);
  } else {
    throw new Error('Unsupported input type for createFormData. Expected Buffer or string.');
  }

  const parts = [
    `--${boundary}\r\n`,
    'Content-Disposition: form-data; name="model"\r\n\r\n',
    'whisper-1\r\n',
    `--${boundary}\r\n`,
    `Content-Disposition: form-data; name="file"; filename="audio.oga"\r\n`,
    'Content-Type: audio/ogg\r\n\r\n',
    fileContent,
    '\r\n',
    `--${boundary}--\r\n`
  ];

  return Buffer.concat(parts.map(part => typeof part === 'string' ? Buffer.from(part) : part));
}

/**
 * Transcribes audio input using OpenAI's Whisper API.
 * The input can be either a Buffer or a file path (string).
 *
 * @param {Buffer|string} input - The audio data or path to the audio file.
 * @returns {Promise<string>} - A promise that resolves to the transcribed text.
 */
async function transcribeVoice(input) {
  if (!whisperApiKey) {
    throw new Error('Whisper API key not initialized. Call initWhisper first.');
  }

  return new Promise((resolve, reject) => {
    const boundary = generateBoundary();
    const formData = createFormData(input, boundary);

    const options = {
      hostname: 'api.openai.com',
      path: '/v1/audio/transcriptions',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${whisperApiKey}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': formData.length
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          if (res.statusCode !== 200) {
            reject(new Error(`API request failed with status ${res.statusCode}: ${data}`));
            return;
          }
          const response = JSON.parse(data);
          if (response.text) {
            resolve(response.text);
          } else {
            reject(new Error('No transcription text in API response'));
          }
        } catch (error) {
          reject(new Error(`Failed to parse API response: ${error.message}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`Transcription request failed: ${error.message}`));
    });

    req.write(formData);
    req.end();
  });
}

module.exports = { transcribeVoice, initWhisper };
