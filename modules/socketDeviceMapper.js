'use strict';

/**
 * Socket Device Mapper Module
 * Maps and identifies devices connected to sockets based on Homey device classes
 * and enhances speech recognition with appliance vocabulary
 */

// Socket-connected device types from Homey allowedVirtual array
const SOCKET_CONNECTED_DEVICES = {
  // Lighting devices
  'light': {
    multilingual: {
      'en': ['light', 'lights', 'lamp', 'lamps', 'bulb', 'bulbs', 'lighting', 'led'],
      'sv': ['ljus', 'lampor', 'lampa', 'belysning', 'led'],
      'de': ['licht', 'lichter', 'lampe', 'lampen', 'beleuchtung'],
      'fr': ['lumière', 'lumières', 'lampe', 'lampes', 'éclairage'],
      'es': ['luz', 'luces', 'lámpara', 'lámparas', 'iluminación'],
      'it': ['luce', 'luci', 'lampada', 'lampade', 'illuminazione'],
      'nl': ['licht', 'lichten', 'lamp', 'lampen', 'verlichting']
    },
    category: 'lighting',
    commonCommands: ['turn_on', 'turn_off', 'dim']
  },

  // Kitchen appliances
  'coffeemachine': {
    multilingual: {
      'en': ['coffee machine', 'coffee maker', 'espresso machine', 'coffee pot', 'percolator'],
      'sv': ['kaffemaskin', 'kaffebryggare', 'espressomaskin', 'kaffekanna'],
      'de': ['kaffeemaschine', 'kaffeeautomat', 'espressomaschine', 'kaffeebereiter'],
      'fr': ['machine à café', 'cafetière', 'machine espresso', 'percolateur'],
      'es': ['máquina de café', 'cafetera', 'máquina espresso'],
      'it': ['macchina del caffè', 'caffettiera', 'macchina espresso'],
      'nl': ['koffiezetapparaat', 'koffiemachine', 'espressomachine']
    },
    category: 'kitchen',
    commonCommands: ['turn_on', 'turn_off']
  },

  'kettle': {
    multilingual: {
      'en': ['kettle', 'electric kettle', 'water kettle', 'tea kettle'],
      'sv': ['vattenkokare', 'elkokare', 'tevattenkokare'],
      'de': ['wasserkocher', 'elektrischer wasserkocher', 'teekocher'],
      'fr': ['bouilloire', 'bouilloire électrique', 'théière électrique'],
      'es': ['hervidor', 'hervidor eléctrico', 'tetera eléctrica'],
      'it': ['bollitore', 'bollitore elettrico', 'teiera elettrica'],
      'nl': ['waterkoker', 'elektrische waterkoker', 'theekettel']
    },
    category: 'kitchen',
    commonCommands: ['turn_on', 'turn_off']
  },

  'microwave': {
    multilingual: {
      'en': ['microwave', 'microwave oven', 'micro'],
      'sv': ['mikrovågsugn', 'mikro'],
      'de': ['mikrowelle', 'mikrowellenherd'],
      'fr': ['micro-ondes', 'four micro-ondes'],
      'es': ['microondas', 'horno microondas'],
      'it': ['microonde', 'forno a microonde'],
      'nl': ['magnetron', 'microgolfoven']
    },
    category: 'kitchen',
    commonCommands: ['turn_on', 'turn_off']
  },

  'dishwasher': {
    multilingual: {
      'en': ['dishwasher', 'dish washer'],
      'sv': ['diskmaskin', 'diskmaskinen'],
      'de': ['geschirrspüler', 'spülmaschine'],
      'fr': ['lave-vaisselle', 'lave vaisselle'],
      'es': ['lavavajillas', 'lavaplatos'],
      'it': ['lavastoviglie'],
      'nl': ['vaatwasser', 'afwasmachine']
    },
    category: 'kitchen',
    commonCommands: ['turn_on', 'turn_off']
  },

  'oven': {
    multilingual: {
      'en': ['oven', 'electric oven', 'baking oven'],
      'sv': ['ugn', 'bakugn', 'elugn'],
      'de': ['ofen', 'backofen', 'elektroherd'],
      'fr': ['four', 'four électrique'],
      'es': ['horno', 'horno eléctrico'],
      'it': ['forno', 'forno elettrico'],
      'nl': ['oven', 'bakoven', 'elektrische oven']
    },
    category: 'kitchen',
    commonCommands: ['turn_on', 'turn_off']
  },

  'cooktop': {
    multilingual: {
      'en': ['cooktop', 'stove', 'electric stove', 'hob', 'cooking plate'],
      'sv': ['spis', 'kokplatta', 'häll'],
      'de': ['kochfeld', 'herd', 'elektroherd'],
      'fr': ['plaque de cuisson', 'cuisinière', 'table de cuisson'],
      'es': ['cocina', 'placa de cocción', 'vitrocerámica'],
      'it': ['piano cottura', 'fornello', 'piastra'],
      'nl': ['kookplaat', 'fornuis', 'elektrische kookplaat']
    },
    category: 'kitchen',
    commonCommands: ['turn_on', 'turn_off']
  },

  'airfryer': {
    multilingual: {
      'en': ['air fryer', 'airfryer', 'hot air fryer'],
      'sv': ['airfryer', 'fritös', 'varmluftsfritös'],
      'de': ['heißluftfritteuse', 'airfryer'],
      'fr': ['friteuse à air', 'friteuse sans huile'],
      'es': ['freidora de aire', 'airfryer'],
      'it': ['friggitrice ad aria', 'airfryer'],
      'nl': ['airfryer', 'heteluchtfriteuse']
    },
    category: 'kitchen',
    commonCommands: ['turn_on', 'turn_off']
  },

  'toaster': {
    multilingual: {
      'en': ['toaster', 'bread toaster', 'toaster oven'],
      'sv': ['brödrost', 'toaster'],
      'de': ['toaster', 'brotröster'],
      'fr': ['grille-pain', 'toaster'],
      'es': ['tostadora', 'tostador'],
      'it': ['tostapane', 'toaster'],
      'nl': ['broodrooster', 'toaster']
    },
    category: 'kitchen',
    commonCommands: ['turn_on', 'turn_off']
  },

  'multicooker': {
    multilingual: {
      'en': ['multicooker', 'pressure cooker', 'instant pot', 'slow cooker'],
      'sv': ['multicooker', 'tryckkokare', 'slow cooker'],
      'de': ['multikocher', 'schnellkochtopf', 'schongarer'],
      'fr': ['multicuiseur', 'autocuiseur', 'mijoteuse'],
      'es': ['olla multifunción', 'olla a presión', 'olla lenta'],
      'it': ['multicooker', 'pentola a pressione', 'slow cooker'],
      'nl': ['multicooker', 'snelkookpan', 'slowcooker']
    },
    category: 'kitchen',
    commonCommands: ['turn_on', 'turn_off']
  },

  // Appliances
  'washer': {
    multilingual: {
      'en': ['washing machine', 'washer', 'clothes washer'],
      'sv': ['tvättmaskin', 'tvättmaskinen'],
      'de': ['waschmaschine', 'wäscheschleuder'],
      'fr': ['machine à laver', 'lave-linge'],
      'es': ['lavadora', 'máquina de lavar'],
      'it': ['lavatrice', 'lavabiancheria'],
      'nl': ['wasmachine', 'was']
    },
    category: 'laundry',
    commonCommands: ['turn_on', 'turn_off']
  },

  'dryer': {
    multilingual: {
      'en': ['dryer', 'clothes dryer', 'tumble dryer'],
      'sv': ['torktumlare', 'torkmaskin'],
      'de': ['trockner', 'wäschetrockner'],
      'fr': ['sèche-linge', 'séchoir'],
      'es': ['secadora', 'secadora de ropa'],
      'it': ['asciugatrice', 'asciugabiancheria'],
      'nl': ['droger', 'wasdroger', 'droogmachine']
    },
    category: 'laundry',
    commonCommands: ['turn_on', 'turn_off']
  },

  'washer_and_dryer': {
    multilingual: {
      'en': ['washer dryer', 'combo washer dryer', 'all in one washer'],
      'sv': ['tvätt och tork', 'kombimaskin'],
      'de': ['waschtrockner', 'kombigerät'],
      'fr': ['lave-linge séchant', 'combiné lavage séchage'],
      'es': ['lavadora secadora', 'combo lavado secado'],
      'it': ['lavasciuga', 'combinata'],
      'nl': ['was-droog combinatie', 'wasdroogcombinatie']
    },
    category: 'laundry',
    commonCommands: ['turn_on', 'turn_off']
  },

  // Climate control
  'fan': {
    multilingual: {
      'en': ['fan', 'electric fan', 'cooling fan', 'ventilator'],
      'sv': ['fläkt', 'kylningsfläkt', 'ventilator'],
      'de': ['ventilator', 'lüfter', 'kühlventilator'],
      'fr': ['ventilateur', 'ventilo'],
      'es': ['ventilador', 'abanico eléctrico'],
      'it': ['ventilatore', 'ventaglio elettrico'],
      'nl': ['ventilator', 'koelventilator']
    },
    category: 'climate',
    commonCommands: ['turn_on', 'turn_off']
  },

  'heater': {
    multilingual: {
      'en': ['heater', 'electric heater', 'space heater', 'radiator'],
      'sv': ['värmare', 'elvärmare', 'radiator'],
      'de': ['heizung', 'elektroheizkörper', 'radiator'],
      'fr': ['chauffage', 'radiateur', 'chauffage électrique'],
      'es': ['calefactor', 'radiador', 'estufa eléctrica'],
      'it': ['riscaldatore', 'radiatore', 'stufa elettrica'],
      'nl': ['verwarming', 'elektrische kachel', 'radiator']
    },
    category: 'climate',
    commonCommands: ['turn_on', 'turn_off']
  },

  'airconditioning': {
    multilingual: {
      'en': ['air conditioning', 'air conditioner', 'ac', 'cooling'],
      'sv': ['luftkonditionering', 'ac', 'kylning'],
      'de': ['klimaanlage', 'klimagerät', 'kühlung'],
      'fr': ['climatisation', 'climatiseur', 'clim'],
      'es': ['aire acondicionado', 'climatizador'],
      'it': ['condizionatore', 'aria condizionata'],
      'nl': ['airconditioning', 'airco', 'koeling']
    },
    category: 'climate',
    commonCommands: ['turn_on', 'turn_off']
  },

  // Entertainment
  'tv': {
    multilingual: {
      'en': ['tv', 'television', 'smart tv', 'monitor'],
      'sv': ['tv', 'television', 'teve'],
      'de': ['fernseher', 'tv', 'bildschirm'],
      'fr': ['télé', 'télévision', 'tv'],
      'es': ['televisión', 'tv', 'tele'],
      'it': ['televisione', 'tv', 'tele'],
      'nl': ['tv', 'televisie', 'beeldscherm']
    },
    category: 'entertainment',
    commonCommands: ['turn_on', 'turn_off']
  },

  'mediaplayer': {
    multilingual: {
      'en': ['media player', 'streaming device', 'player'],
      'sv': ['mediaspelare', 'streamingspelare'],
      'de': ['mediaplayer', 'streaming-gerät'],
      'fr': ['lecteur multimédia', 'lecteur streaming'],
      'es': ['reproductor multimedia', 'dispositivo streaming'],
      'it': ['lettore multimediale', 'media player'],
      'nl': ['mediaspeler', 'streaming apparaat']
    },
    category: 'entertainment',
    commonCommands: ['turn_on', 'turn_off']
  },

  'soundsystem': {
    multilingual: {
      'en': ['sound system', 'audio system', 'stereo', 'speakers', 'speaker system', 'hifi'],
      'sv': ['ljudsystem', 'stereoanläggning', 'högtalare', 'hifi'],
      'de': ['soundsystem', 'stereoanlage', 'lautsprechersystem', 'hifi'],
      'fr': ['système audio', 'chaîne hifi', 'système de son'],
      'es': ['sistema de sonido', 'equipo de música', 'altavoces'],
      'it': ['sistema audio', 'impianto stereo', 'altoparlanti'],
      'nl': ['geluidssysteem', 'stereoset', 'luidsprekersysteem']
    },
    category: 'entertainment',
    commonCommands: ['turn_on', 'turn_off']
  },

  // Refrigeration
  'fridge': {
    multilingual: {
      'en': ['fridge', 'refrigerator', 'icebox'],
      'sv': ['kylskåp', 'kyl'],
      'de': ['kühlschrank', 'kühlgerät'],
      'fr': ['réfrigérateur', 'frigo'],
      'es': ['refrigerador', 'nevera', 'frigorífico'],
      'it': ['frigorifero', 'frigo'],
      'nl': ['koelkast', 'ijskast']
    },
    category: 'refrigeration',
    commonCommands: ['turn_on', 'turn_off']
  },

  'freezer': {
    multilingual: {
      'en': ['freezer', 'deep freeze', 'chest freezer'],
      'sv': ['frys', 'djupfrys', 'frysskåp'],
      'de': ['gefrierschrank', 'tiefkühltruhe'],
      'fr': ['congélateur', 'surgélateur'],
      'es': ['congelador', 'arcón congelador'],
      'it': ['congelatore', 'freezer'],
      'nl': ['vriezer', 'diepvries']
    },
    category: 'refrigeration',
    commonCommands: ['turn_on', 'turn_off']
  },

  // Others
  'boiler': {
    multilingual: {
      'en': ['boiler', 'water heater', 'hot water tank'],
      'sv': ['varmvattenberedare', 'panna'],
      'de': ['boiler', 'warmwasserbereiter'],
      'fr': ['chauffe-eau', 'boiler'],
      'es': ['caldera', 'calentador de agua'],
      'it': ['scaldabagno', 'caldaia'],
      'nl': ['boiler', 'warmwatertoestel']
    },
    category: 'utility',
    commonCommands: ['turn_on', 'turn_off']
  },

  'evcharger': {
    multilingual: {
      'en': ['ev charger', 'electric car charger', 'charging station'],
      'sv': ['elbilsladdare', 'laddstation'],
      'de': ['elektroauto-ladegerät', 'ladestation'],
      'fr': ['chargeur voiture électrique', 'borne de recharge'],
      'es': ['cargador coche eléctrico', 'estación de carga'],
      'it': ['caricatore auto elettrica', 'stazione di ricarica'],
      'nl': ['elektrische auto lader', 'laadpaal']
    },
    category: 'utility',
    commonCommands: ['turn_on', 'turn_off']
  },

  'networkrouter': {
    multilingual: {
      'en': ['router', 'wifi router', 'network router', 'modem'],
      'sv': ['router', 'wifi-router', 'nätverksrouter'],
      'de': ['router', 'wlan-router', 'netzwerk-router'],
      'fr': ['routeur', 'routeur wifi', 'box internet'],
      'es': ['router', 'router wifi', 'enrutador'],
      'it': ['router', 'router wifi', 'modem'],
      'nl': ['router', 'wifi router', 'netwerk router']
    },
    category: 'tech',
    commonCommands: ['turn_on', 'turn_off']
  }
};

/**
 * Get all socket-connected device vocabularies for enhanced speech recognition
 * @param {string} language - Language code (default: 'en')
 * @returns {Array} Array of device names/terms for the specified language
 */
function getSocketDeviceVocabulary(language = 'en') {
  const vocabulary = [];
  
  for (const deviceType of Object.values(SOCKET_CONNECTED_DEVICES)) {
    if (deviceType.multilingual[language]) {
      vocabulary.push(...deviceType.multilingual[language]);
    }
  }
  
  return [...new Set(vocabulary)]; // Remove duplicates
}

/**
 * Identify device type from user input (e.g., "coffee machine" -> "coffeemachine")
 * @param {string} userInput - User's speech or text input
 * @param {string} language - Language code
 * @returns {string|null} Identified device type or null if not found
 */
function identifySocketDeviceType(userInput, language = 'en') {
  if (!userInput) return null;
  
  const lowerInput = userInput.toLowerCase().trim();
  
  for (const [deviceType, deviceData] of Object.entries(SOCKET_CONNECTED_DEVICES)) {
    const terms = deviceData.multilingual[language] || [];
    
    for (const term of terms) {
      if (lowerInput.includes(term.toLowerCase()) || term.toLowerCase().includes(lowerInput)) {
        return deviceType;
      }
    }
  }
  
  return null;
}

/**
 * Get enhanced device description for sockets based on what might be connected
 * @param {Object} device - Socket device object
 * @param {string} language - Language code
 * @returns {string} Enhanced description
 */
function getSocketDescription(device, language = 'en') {
  if (!device || device.class !== 'socket') {
    return '';
  }
  
  const deviceName = device.name.toLowerCase();
  
  // Try to identify what's connected based on device name
  for (const [deviceType, deviceData] of Object.entries(SOCKET_CONNECTED_DEVICES)) {
    const terms = deviceData.multilingual[language] || [];
    
    for (const term of terms) {
      if (deviceName.includes(term.toLowerCase())) {
        return `Socket controlling ${term}`;
      }
    }
  }
  
  return 'Socket (smart plug)';
}

/**
 * Get all possible socket-connected device types
 * @returns {Array} Array of all socket-connected device type keys
 */
function getAllSocketDeviceTypes() {
  return Object.keys(SOCKET_CONNECTED_DEVICES);
}

/**
 * Get category for a socket-connected device type
 * @param {string} deviceType - Device type key
 * @returns {string} Category name
 */
function getDeviceCategory(deviceType) {
  const deviceData = SOCKET_CONNECTED_DEVICES[deviceType];
  return deviceData ? deviceData.category : 'unknown';
}

/**
 * Get enhanced speech context for Whisper API based on available socket devices
 * @param {Object} devices - Available devices from Homey
 * @param {string} language - Language code
 * @returns {Array} Context terms for better speech recognition
 */
function getSocketSpeechContext(devices, language = 'en') {
  const context = [];
  const socketDevices = Object.values(devices).filter(device => device.class === 'socket');
  
  // Add general socket vocabulary
  context.push(...getSocketDeviceVocabulary(language));
  
  // Add specific device names that are sockets
  for (const socket of socketDevices) {
    const socketName = socket.name.toLowerCase();
    
    // Try to identify what type of device is connected based on name
    const identifiedType = identifySocketDeviceType(socketName, language);
    if (identifiedType) {
      const deviceData = SOCKET_CONNECTED_DEVICES[identifiedType];
      if (deviceData && deviceData.multilingual[language]) {
        context.push(...deviceData.multilingual[language]);
      }
    }
  }
  
  return [...new Set(context)]; // Remove duplicates
}

module.exports = {
  SOCKET_CONNECTED_DEVICES,
  getSocketDeviceVocabulary,
  identifySocketDeviceType,
  getSocketDescription,
  getAllSocketDeviceTypes,
  getDeviceCategory,
  getSocketSpeechContext
};
