'use strict';

const { HomeyAPIV3 } = require('homey-api');

/**
 * Retrieves the full home state (devices and zones) using homey-api.
 * @param {object} app - The ChatGPTAssistant instance.
 * @returns {Promise<{devices: object, zones: object}>}
 */
async function getHomeState(app) {
  try {
    if (!app._apiClient) {
      app._apiClient = await HomeyAPIV3.createAppAPI({ homey: app.homey });
      app.log('Connected to Homey via homey-api.');
    }
    const devicesObj = await app._apiClient.devices.getDevices();
    const zones = await app._apiClient.zones.getZones();
    return { devices: devicesObj, zones };
  } catch (error) {
    app.error('Failed to retrieve home state:', error);
    throw error;
  }
}

/**
 * Retrieves a mapping of devices as an object.
 * Falls back to drivers API if needed.
 * @param {object} app - The ChatGPTAssistant instance.
 * @returns {Promise<object>}
 */
async function getDevicesMapping(app) {
  try {
    const homeState = await getHomeState(app);
    return homeState.devices;
  } catch (error) {
    app.log('Falling back to drivers API for devices.');
    const devicesObj = {};
    if (app.homey.drivers && typeof app.homey.drivers.getDrivers === 'function') {
      const drivers = app.homey.drivers.getDrivers();
      for (const driver of Object.values(drivers)) {
        if (typeof driver.ready === 'function') await driver.ready();
        const driverDevices = await driver.getDevices();
        driverDevices.forEach(device => { devicesObj[device.id] = device; });
      }
    }
    return devicesObj;
  }
}

module.exports = { getHomeState, getDevicesMapping };
