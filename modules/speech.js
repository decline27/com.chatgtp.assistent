'use strict';

const https = require('https');
const fs = require('fs');
const { getKeyManager } = require('./secureKeyManager');
const { ErrorHandler, ErrorTypes } = require('./errorHandler');
const { getSocketSpeechContext, identifySocketDeviceType } = require('./socketDeviceMapper');

// Supported languages for Whisper API (99+ languages)
const SUPPORTED_LANGUAGES = {
  'auto': 'Automatic Detection',
  'en': 'English',
  'es': 'Spanish',
  'fr': 'French',
  'de': 'German',
  'it': 'Italian',
  'pt': 'Portuguese',
  'ru': 'Russian',
  'ja': 'Japanese',
  'ko': 'Korean',
  'zh': 'Chinese',
  'ar': 'Arabic',
  'hi': 'Hindi',
  'nl': 'Dutch',
  'sv': 'Swedish',
  'no': 'Norwegian',
  'da': 'Danish',
  'fi': 'Finnish',
  'pl': 'Polish',
  'tr': 'Turkish',
  'cs': 'Czech',
  'hu': 'Hungarian',
  'ro': 'Romanian',
  'bg': 'Bulgarian',
  'hr': 'Croatian',
  'sk': 'Slovak',
  'sl': 'Slovenian',
  'et': 'Estonian',
  'lv': 'Latvian',
  'lt': 'Lithuanian',
  'uk': 'Ukrainian',
  'be': 'Belarusian',
  'mk': 'Macedonian',
  'sq': 'Albanian',
  'sr': 'Serbian',
  'bs': 'Bosnian',
  'mt': 'Maltese',
  'is': 'Icelandic',
  'ga': 'Irish',
  'cy': 'Welsh',
  'eu': 'Basque',
  'ca': 'Catalan',
  'gl': 'Galician',
  'he': 'Hebrew',
  'fa': 'Persian',
  'ur': 'Urdu',
  'bn': 'Bengali',
  'ta': 'Tamil',
  'te': 'Telugu',
  'ml': 'Malayalam',
  'kn': 'Kannada',
  'gu': 'Gujarati',
  'pa': 'Punjabi',
  'mr': 'Marathi',
  'ne': 'Nepali',
  'si': 'Sinhala',
  'my': 'Myanmar',
  'km': 'Khmer',
  'lo': 'Lao',
  'vi': 'Vietnamese',
  'th': 'Thai',
  'ms': 'Malay',
  'id': 'Indonesian',
  'tl': 'Filipino',
  'sw': 'Swahili',
  'am': 'Amharic',
  'yo': 'Yoruba',
  'ig': 'Igbo',
  'zu': 'Zulu',
  'af': 'Afrikaans',
  'az': 'Azerbaijani',
  'kk': 'Kazakh',
  'ky': 'Kyrgyz',
  'uz': 'Uzbek',
  'tg': 'Tajik',
  'mn': 'Mongolian',
  'ka': 'Georgian',
  'hy': 'Armenian',
  'lb': 'Luxembourgish',
  'fo': 'Faroese',
  'br': 'Breton',
  'oc': 'Occitan',
  'la': 'Latin',
  'mi': 'Maori',
  'haw': 'Hawaiian',
  'ln': 'Lingala',
  'mg': 'Malagasy',
  'sn': 'Shona',
  'so': 'Somali',
  'sd': 'Sindhi',
  'ps': 'Pashto',
  'tk': 'Turkmen',
  'tt': 'Tatar',
  'ba': 'Bashkir',
  'cv': 'Chuvash',
  'ce': 'Chechen',
  'kv': 'Komi',
  'mhr': 'Mari',
  'udm': 'Udmurt',
  'sah': 'Yakut',
  'tyv': 'Tuvan',
  'xal': 'Kalmyk',
  'bua': 'Buryat',
  'alt': 'Altai',
  'kjh': 'Khakas',
  'cjs': 'Shor',
  'yrk': 'Nenets',
  'evn': 'Evenki',
  'eve': 'Even',
  'chm': 'Mari',
  'mdf': 'Moksha',
  'myv': 'Erzya',
  'koi': 'Komi-Permyak',
  'kpv': 'Komi-Zyrian',
  'krc': 'Karachay-Balkar',
  'kbd': 'Kabardian',
  'ady': 'Adyghe',
  'abq': 'Abaza',
  'ab': 'Abkhazian',
  'os': 'Ossetian',
  'inh': 'Ingush',
  'av': 'Avar',
  'dar': 'Dargwa',
  'lbe': 'Lak',
  'lez': 'Lezghian',
  'tab': 'Tabasaran',
  'rut': 'Rutul',
  'tsz': 'Tsakhur',
  'udi': 'Udi'
};

/**
 * Initialize the Whisper API key.
 * @param {string} apiKey - The OpenAI API key for Whisper.
 * @throws {StandardError} When validation fails
 */
function initWhisper(apiKey) {
  // Input validation
  ErrorHandler.validateInput(apiKey && typeof apiKey === 'string', 'Whisper API key is required and must be a string');

  try {
    // Store API key securely (reuse the same OpenAI key)
    const keyManager = getKeyManager();
    if (!keyManager.hasKey('openai')) {
      keyManager.setKey('openai', apiKey, 'openai');
    }

    console.log('Whisper module initialized securely');
  } catch (error) {
    throw ErrorHandler.wrap(error, ErrorTypes.AUTHENTICATION_ERROR, 'Failed to initialize Whisper');
  }
}

/**
 * Create a unique multipart form-data boundary.
 * @returns {string} A unique boundary string.
 */
function generateBoundary() {
  return `---------------------------${Date.now().toString()}`;
}

/**
 * Create multipart form-data body with language support and enhanced context.
 * @param {Buffer|string} input - Either a Buffer containing the file data or a file path to the audio file.
 * @param {string} boundary - The form-data boundary string.
 * @param {string} language - Language code for transcription (optional, defaults to auto-detection).
 * @param {Object} devices - Available devices from Homey (optional, for enhanced context).
 * @returns {Buffer} The complete form-data as a Buffer.
 */
function createFormData(input, boundary, language = 'auto', devices = null) {
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
    '\r\n'
  ];

  // Add language parameter if specified and not auto-detection
  if (language && language !== 'auto' && SUPPORTED_LANGUAGES[language]) {
    parts.push(
      `--${boundary}\r\n`,
      'Content-Disposition: form-data; name="language"\r\n\r\n',
      `${language}\r\n`
    );
  }

  // Add response format for better parsing
  parts.push(
    `--${boundary}\r\n`,
    'Content-Disposition: form-data; name="response_format"\r\n\r\n',
    'verbose_json\r\n'
  );

  // Add enhanced prompt with context for socket devices if available
  if (devices) {
    const socketContext = getSocketSpeechContext(devices, language);
    if (socketContext && socketContext.length > 0) {
      // Create context prompt for better recognition of appliances and devices
      const contextPrompt = `Smart home devices: ${socketContext.slice(0, 20).join(', ')}`;
      parts.push(
        `--${boundary}\r\n`,
        'Content-Disposition: form-data; name="prompt"\r\n\r\n',
        `${contextPrompt}\r\n`
      );
    }
  }

  parts.push(`--${boundary}--\r\n`);

  return Buffer.concat(parts.map(part => (typeof part === 'string' ? Buffer.from(part) : part)));
}

/**
 * Transcribes audio input using OpenAI's Whisper API with multilingual support and enhanced device context.
 * The input can be either a Buffer or a file path (string).
 *
 * @param {Buffer|string} input - The audio data or path to the audio file.
 * @param {string} language - Language code for transcription (optional, defaults to auto-detection).
 * @param {Object} devices - Available devices from Homey (optional, for enhanced context).
 * @returns {Promise<Object>} - A promise that resolves to transcription result with text and detected language.
 */
async function transcribeVoice(input, language = 'auto', devices = null) {
  // Input validation
  ErrorHandler.validateInput(input, 'Audio input is required');
  ErrorHandler.validateInput(language && typeof language === 'string', 'Language must be a string');

  const keyManager = getKeyManager();
  if (!keyManager.hasKey('openai')) {
    throw ErrorHandler.authentication('Whisper API key not initialized. Call initWhisper first.');
  }



  return new Promise((resolve, reject) => {
    try {
      const boundary = generateBoundary();
      const formData = createFormData(input, boundary, language, devices);

      // Create secure authorization header
      const authHeader = keyManager.createAuthHeader('openai', 'Bearer');

      const options = {
        hostname: 'api.openai.com',
        path: '/v1/audio/transcriptions',
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': formData.length
        }
      };

      const req = https.request(options, res => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            if (res.statusCode !== 200) {
              const error = ErrorHandler.api(`Whisper API request failed with status ${res.statusCode}`, {
                statusCode: res.statusCode,
                responseData: data.substring(0, 500)
              });
              reject(error);
              return;
            }
            const response = JSON.parse(data);

            if (response.text) {
              // Return enhanced response with language information
              const result = {
                text: response.text,
                language: response.language || language,
                duration: response.duration || null,
                confidence: response.confidence || null,
                segments: response.segments || null
              };
              resolve(result);
            } else {
              const error = ErrorHandler.api('No transcription text in API response', { response });
              reject(error);
            }
          } catch (parseError) {
            const error = ErrorHandler.parsing(`Failed to parse Whisper API response: ${parseError.message}`, {
              originalError: parseError.message,
              responseLength: data.length
            });
            reject(error);
          }
        });
      });

      req.on('error', networkError => {
        const error = ErrorHandler.network(`Transcription request failed: ${networkError.message}`);
        reject(error);
      });

      req.write(formData);
      req.end();
    } catch (error) {
      const wrappedError = ErrorHandler.wrap(error, ErrorTypes.API_ERROR, 'Failed to setup transcription request');
      reject(wrappedError);
    }
  });
}

/**
 * Get list of supported languages.
 * @returns {Object} Object containing language codes and names.
 */
function getSupportedLanguages() {
  return { ...SUPPORTED_LANGUAGES };
}

/**
 * Check if a language is supported.
 * @param {string} languageCode - The language code to check.
 * @returns {boolean} True if the language is supported.
 */
function isLanguageSupported(languageCode) {
  return languageCode === 'auto' || SUPPORTED_LANGUAGES.hasOwnProperty(languageCode);
}



module.exports = {
  transcribeVoice,
  initWhisper,
  getSupportedLanguages,
  isLanguageSupported
};
