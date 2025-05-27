'use strict';

const fs = require('fs');
const https = require('https');

/**
 * Downloads a file from the given URL and writes it to the specified output path.
 * @param {string} fileUrl - The URL to download.
 * @param {string} outputPath - The local file path to write to.
 * @returns {Promise<void>}
 */
function downloadFile(fileUrl, outputPath) {
  return new Promise((resolve, reject) => {
    const dest = fs.createWriteStream(outputPath);
    https.get(fileUrl, response => {
      if (response.statusCode !== 200) {
        dest.end();
        reject(new Error(`HTTP error! status: ${response.statusCode}`));
        return;
      }
      response.pipe(dest);
      dest.on('finish', () => {
        dest.close();
        resolve();
      });
    }).on('error', err => {
      dest.end();
      reject(err);
    });
  });
}

/**
 * Downloads a file from the given URL and returns its content as a Buffer.
 * @param {string} fileUrl - The URL to download.
 * @returns {Promise<Buffer>}
 */
function downloadBuffer(fileUrl) {
  return new Promise((resolve, reject) => {
    const data = [];
    https.get(fileUrl, response => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download file, status: ${response.statusCode}`));
        return;
      }
      response.on('data', chunk => data.push(chunk));
      response.on('end', () => resolve(Buffer.concat(data)));
    }).on('error', reject);
  });
}

module.exports = { downloadFile, downloadBuffer };
