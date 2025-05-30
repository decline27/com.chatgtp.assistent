'use strict';

/**
 * Multilingual Command Processing Module
 * Handles natural language understanding across multiple languages
 */

const { getSocketDeviceVocabulary, SOCKET_CONNECTED_DEVICES } = require('./socketDeviceMapper');

// Multilingual room name mappings
const ROOM_TRANSLATIONS = {
  'en': {
    'living room': ['living room', 'lounge', 'sitting room', 'family room'],
    'bedroom': ['bedroom', 'bed room', 'master bedroom', 'guest bedroom'],
    'kitchen': ['kitchen', 'cook room'],
    'bathroom': ['bathroom', 'bath room', 'toilet', 'restroom', 'washroom'],
    'office': ['office', 'study', 'work room', 'home office'],
    'dining room': ['dining room', 'dining area'],
    'garage': ['garage', 'car port'],
    'basement': ['basement', 'cellar'],
    'attic': ['attic', 'loft'],
    'hallway': ['hallway', 'corridor', 'hall'],
    'balcony': ['balcony', 'terrace', 'patio'],
    'garden': ['garden', 'yard', 'backyard']
  },
  'es': {
    'living room': ['sala de estar', 'salón', 'sala', 'cuarto de estar'],
    'bedroom': ['dormitorio', 'habitación', 'cuarto', 'alcoba'],
    'kitchen': ['cocina'],
    'bathroom': ['baño', 'aseo', 'servicio'],
    'office': ['oficina', 'estudio', 'despacho'],
    'dining room': ['comedor', 'sala de comedor'],
    'garage': ['garaje', 'cochera'],
    'basement': ['sótano', 'bodega'],
    'attic': ['ático', 'desván'],
    'hallway': ['pasillo', 'corredor'],
    'balcony': ['balcón', 'terraza'],
    'garden': ['jardín', 'patio']
  },
  'fr': {
    'living room': ['salon', 'salle de séjour', 'séjour', 'living'],
    'bedroom': ['chambre', 'chambre à coucher'],
    'kitchen': ['cuisine'],
    'bathroom': ['salle de bain', 'salle de bains', 'toilettes'],
    'office': ['bureau', 'cabinet de travail'],
    'dining room': ['salle à manger'],
    'garage': ['garage'],
    'basement': ['sous-sol', 'cave'],
    'attic': ['grenier', 'combles'],
    'hallway': ['couloir', 'hall', 'entrée'],
    'balcony': ['balcon', 'terrasse'],
    'garden': ['jardin']
  },
  'de': {
    'living room': ['wohnzimmer', 'wohnraum', 'stube'],
    'bedroom': ['schlafzimmer', 'schlafraum'],
    'kitchen': ['küche'],
    'bathroom': ['badezimmer', 'bad', 'toilette'],
    'office': ['büro', 'arbeitszimmer', 'homeoffice'],
    'dining room': ['esszimmer', 'speisezimmer'],
    'garage': ['garage'],
    'basement': ['keller', 'untergeschoss'],
    'attic': ['dachboden', 'speicher'],
    'hallway': ['flur', 'diele', 'gang'],
    'balcony': ['balkon', 'terrasse'],
    'garden': ['garten']
  },
  'it': {
    'living room': ['soggiorno', 'salotto', 'sala'],
    'bedroom': ['camera da letto', 'camera', 'stanza da letto'],
    'kitchen': ['cucina'],
    'bathroom': ['bagno', 'toilette'],
    'office': ['ufficio', 'studio'],
    'dining room': ['sala da pranzo'],
    'garage': ['garage', 'box'],
    'basement': ['cantina', 'seminterrato'],
    'attic': ['soffitta', 'mansarda'],
    'hallway': ['corridoio', 'ingresso'],
    'balcony': ['balcone', 'terrazza'],
    'garden': ['giardino']
  },
  'pt': {
    'living room': ['sala de estar', 'sala', 'living'],
    'bedroom': ['quarto', 'dormitório', 'quarto de dormir'],
    'kitchen': ['cozinha'],
    'bathroom': ['banheiro', 'casa de banho', 'wc'],
    'office': ['escritório', 'gabinete'],
    'dining room': ['sala de jantar'],
    'garage': ['garagem'],
    'basement': ['porão', 'cave'],
    'attic': ['sótão', 'águas-furtadas'],
    'hallway': ['corredor', 'hall'],
    'balcony': ['varanda', 'terraço'],
    'garden': ['jardim']
  },
  'nl': {
    'living room': ['woonkamer', 'zitkamer', 'huiskamer'],
    'bedroom': ['slaapkamer', 'bedroom'],
    'kitchen': ['keuken'],
    'bathroom': ['badkamer', 'toilet', 'wc'],
    'office': ['kantoor', 'studeerkamer', 'werkkamer'],
    'dining room': ['eetkamer'],
    'garage': ['garage'],
    'basement': ['kelder', 'souterrain'],
    'attic': ['zolder', 'vliering'],
    'hallway': ['gang', 'hal'],
    'balcony': ['balkon', 'terras'],
    'garden': ['tuin']
  },
  'sv': {
    'living room': ['vardagsrum', 'vardagsrummet', 'allrum'],
    'bedroom': ['sovrum', 'sovrummet'],
    'kitchen': ['kök', 'köket'],
    'bathroom': ['badrum', 'badrummet', 'toalett'],
    'office': ['kontor', 'arbetsrum'],
    'dining room': ['matsal', 'matsalen'],
    'garage': ['garage', 'garaget'],
    'basement': ['källare', 'källaren'],
    'attic': ['vind', 'vinden'],
    'hallway': ['hall', 'hallen', 'korridor'],
    'balcony': ['balkong', 'balkongen', 'terrass'],
    'garden': ['trädgård', 'trädgården', 'trägård', 'trägården']
  }
};

// Multilingual action/intent mappings
const ACTION_TRANSLATIONS = {
  'en': {
    'turn_on': ['turn on', 'switch on', 'activate', 'enable', 'start', 'power on', 'turn', 'on'],
    'turn_off': ['turn off', 'switch off', 'deactivate', 'disable', 'stop', 'power off', 'off'],
    'dim': ['dim', 'lower', 'reduce brightness', 'make dimmer'],
    'brighten': ['brighten', 'increase brightness', 'make brighter'],
    'set_temperature': ['set temperature', 'temperature', 'heat', 'cool', 'set temp'],
    'play_music': ['play music', 'start music', 'music on', 'play', 'music'],
    'stop_music': ['stop music', 'pause music', 'music off'],
    'open': ['open', 'raise', 'lift'],
    'close': ['close', 'lower', 'shut'],
    'lock': ['lock', 'secure'],
    'unlock': ['unlock', 'open lock']
  },
  'es': {
    'turn_on': ['encender', 'prender', 'activar', 'conectar'],
    'turn_off': ['apagar', 'desactivar', 'desconectar'],
    'dim': ['atenuar', 'bajar', 'reducir brillo'],
    'brighten': ['aumentar brillo', 'subir', 'iluminar más'],
    'set_temperature': ['temperatura', 'calentar', 'enfriar'],
    'play_music': ['poner música', 'reproducir música'],
    'stop_music': ['parar música', 'pausar música'],
    'open': ['abrir', 'levantar'],
    'close': ['cerrar', 'bajar'],
    'lock': ['cerrar con llave', 'bloquear'],
    'unlock': ['abrir', 'desbloquear']
  },
  'fr': {
    'turn_on': ['allumer', 'activer', 'mettre en marche'],
    'turn_off': ['éteindre', 'désactiver', 'arrêter'],
    'dim': ['tamiser', 'baisser', 'réduire luminosité'],
    'brighten': ['augmenter luminosité', 'éclaircir'],
    'set_temperature': ['température', 'chauffer', 'refroidir'],
    'play_music': ['jouer musique', 'jouer', 'mettre musique', 'musique'],
    'stop_music': ['arrêter musique', 'pause musique'],
    'open': ['ouvrir', 'lever'],
    'close': ['fermer', 'baisser'],
    'lock': ['verrouiller', 'fermer à clé'],
    'unlock': ['déverrouiller', 'ouvrir']
  },
  'de': {
    'turn_on': ['einschalten', 'anmachen', 'aktivieren'],
    'turn_off': ['ausschalten', 'ausmachen', 'deaktivieren'],
    'dim': ['dimmen', 'dunkler machen', 'reduzieren'],
    'brighten': ['heller machen', 'aufhellen'],
    'set_temperature': ['temperatur', 'heizen', 'kühlen'],
    'play_music': ['musik abspielen', 'abspielen', 'musik an', 'musik'],
    'stop_music': ['musik stoppen', 'musik aus'],
    'open': ['öffnen', 'aufmachen'],
    'close': ['schließen', 'zumachen'],
    'lock': ['abschließen', 'sperren'],
    'unlock': ['aufschließen', 'entsperren']
  },
  'it': {
    'turn_on': ['accendere', 'attivare', 'accendi'],
    'turn_off': ['spegnere', 'disattivare', 'spegni'],
    'dim': ['attenuare', 'abbassare', 'ridurre luminosità'],
    'brighten': ['aumentare luminosità', 'schiarire'],
    'set_temperature': ['temperatura', 'riscaldare', 'raffreddare'],
    'play_music': ['suonare musica', 'metti musica'],
    'stop_music': ['fermare musica', 'pausa musica'],
    'open': ['aprire', 'alzare'],
    'close': ['chiudere', 'abbassare'],
    'lock': ['chiudere a chiave', 'bloccare'],
    'unlock': ['aprire', 'sbloccare']
  },
  'pt': {
    'turn_on': ['ligar', 'acender', 'ativar'],
    'turn_off': ['desligar', 'apagar', 'desativar'],
    'dim': ['diminuir', 'atenuar', 'reduzir brilho'],
    'brighten': ['aumentar brilho', 'clarear'],
    'set_temperature': ['temperatura', 'aquecer', 'esfriar'],
    'play_music': ['tocar música', 'tocar', 'música'],
    'stop_music': ['parar música', 'pausar música'],
    'open': ['abrir', 'levantar'],
    'close': ['fechar', 'baixar'],
    'lock': ['trancar', 'bloquear'],
    'unlock': ['destrancar', 'desbloquear']
  },
  'nl': {
    'turn_on': ['aanzetten', 'inschakelen', 'activeren'],
    'turn_off': ['uitzetten', 'uitschakelen', 'deactiveren'],
    'dim': ['dimmen', 'zachter maken', 'verlagen'],
    'brighten': ['feller maken', 'verhogen'],
    'set_temperature': ['temperatuur', 'verwarmen', 'koelen'],
    'play_music': ['muziek afspelen', 'muziek aan'],
    'stop_music': ['muziek stoppen', 'muziek uit'],
    'open': ['openen', 'omhoog'],
    'close': ['sluiten', 'omlaag'],
    'lock': ['vergrendelen', 'op slot'],
    'unlock': ['ontgrendelen', 'van slot']
  },
  'sv': {
    'turn_on': ['sätta på', 'sätt på', 'slå på', 'aktivera', 'tända'],
    'turn_off': ['stänga av', 'stäng av', 'slå av', 'deaktivera', 'släcka'],
    'dim': ['dimma', 'sänka', 'minska ljusstyrka'],
    'brighten': ['öka ljusstyrka', 'ljusare'],
    'set_temperature': ['temperatur', 'värma', 'kyla'],
    'play_music': ['spela musik', 'spela', 'musik på'],
    'stop_music': ['stoppa musik', 'musik av'],
    'open': ['öppna', 'höja'],
    'close': ['stänga', 'sänka'],
    'lock': ['låsa', 'lås'],
    'unlock': ['låsa upp', 'öppna lås']
  }
};

// Device type translations
const DEVICE_TRANSLATIONS = {
  'en': {
    'light': ['light', 'lights', 'lamp', 'lamps', 'bulb', 'bulbs'],
    'speaker': ['speaker', 'speakers', 'music', 'audio'],
    'thermostat': ['thermostat', 'heating', 'temperature', 'heat', 'temp'],
    'lock': ['lock', 'locks', 'door lock'],
    'curtain': ['curtain', 'curtains', 'blinds', 'shades'],
    'fan': ['fan', 'fans', 'ventilation'],
    'tv': ['tv', 'television', 'telly'],
    'socket': ['socket', 'plug', 'outlet', 'power']
  },
  'es': {
    'light': ['luz', 'luces', 'lámpara', 'lámparas', 'bombilla'],
    'speaker': ['altavoz', 'altavoces', 'música', 'audio'],
    'thermostat': ['termostato', 'calefacción', 'temperatura'],
    'lock': ['cerradura', 'cerraduras', 'cerrojo'],
    'curtain': ['cortina', 'cortinas', 'persiana', 'persianas'],
    'fan': ['ventilador', 'ventiladores'],
    'tv': ['tv', 'televisión', 'televisor'],
    'socket': ['enchufe', 'enchufes', 'toma']
  },
  'fr': {
    'light': ['lumière', 'lumières', 'lampe', 'lampes', 'éclairage'],
    'speaker': ['haut-parleur', 'haut-parleurs', 'musique', 'audio'],
    'thermostat': ['thermostat', 'chauffage', 'température'],
    'lock': ['serrure', 'serrures', 'verrou'],
    'curtain': ['rideau', 'rideaux', 'store', 'stores'],
    'fan': ['ventilateur', 'ventilateurs'],
    'tv': ['tv', 'télévision', 'télé'],
    'socket': ['prise', 'prises', 'prise électrique']
  },
  'de': {
    'light': ['licht', 'lichter', 'lampe', 'lampen', 'beleuchtung'],
    'speaker': ['lautsprecher', 'musik', 'audio'],
    'thermostat': ['thermostat', 'heizung', 'temperatur'],
    'lock': ['schloss', 'schlösser', 'türschloss'],
    'curtain': ['vorhang', 'vorhänge', 'jalousie', 'jalousien'],
    'fan': ['ventilator', 'ventilatoren', 'lüfter'],
    'tv': ['tv', 'fernseher', 'fernsehen'],
    'socket': ['steckdose', 'steckdosen', 'stecker']
  },
  'it': {
    'light': ['luce', 'luci', 'lampada', 'lampade', 'illuminazione'],
    'speaker': ['altoparlante', 'altoparlanti', 'musica', 'audio'],
    'thermostat': ['termostato', 'riscaldamento', 'temperatura'],
    'lock': ['serratura', 'serrature', 'lucchetto'],
    'curtain': ['tenda', 'tende', 'persiana', 'persiane'],
    'fan': ['ventilatore', 'ventilatori'],
    'tv': ['tv', 'televisione', 'televisore'],
    'socket': ['presa', 'prese', 'spina']
  },
  'pt': {
    'light': ['luz', 'luzes', 'lâmpada', 'lâmpadas', 'iluminação'],
    'speaker': ['alto-falante', 'alto-falantes', 'música', 'áudio'],
    'thermostat': ['termostato', 'aquecimento', 'temperatura'],
    'lock': ['fechadura', 'fechaduras', 'tranca'],
    'curtain': ['cortina', 'cortinas', 'persiana', 'persianas'],
    'fan': ['ventilador', 'ventiladores'],
    'tv': ['tv', 'televisão', 'televisor'],
    'socket': ['tomada', 'tomadas', 'plugue']
  },
  'nl': {
    'light': ['licht', 'lichten', 'lamp', 'lampen', 'verlichting'],
    'speaker': ['luidspreker', 'luidsprekers', 'muziek', 'audio'],
    'thermostat': ['thermostaat', 'verwarming', 'temperatuur'],
    'lock': ['slot', 'sloten', 'deurslot'],
    'curtain': ['gordijn', 'gordijnen', 'jaloezie', 'jaloezieën'],
    'fan': ['ventilator', 'ventilatoren'],
    'tv': ['tv', 'televisie', 'toestel'],
    'socket': ['stopcontact', 'stopcontacten', 'stekker']
  },
  'sv': {
    'light': ['ljus', 'lampa', 'lampor', 'belysning'],
    'speaker': ['högtalare', 'musik', 'ljud'],
    'thermostat': ['termostat', 'värme', 'temperatur'],
    'lock': ['lås', 'dörrlås'],
    'curtain': ['gardin', 'gardiner', 'persienner'],
    'fan': ['fläkt', 'fläktar', 'ventilation'],
    'tv': ['tv', 'television', 'teve'],
    'socket': ['uttag', 'eluttag', 'kontakt']
  }
};

/**
 * Get enhanced device translations including socket-connected devices
 * @param {string} language - Language code
 * @returns {Object} Enhanced device translations for the language
 */
function getEnhancedDeviceTranslations(language = 'en') {
  const baseTranslations = DEVICE_TRANSLATIONS[language] || {};
  const enhancedTranslations = { ...baseTranslations };
  
  // Add socket-connected device vocabulary from socketDeviceMapper
  for (const [deviceType, deviceData] of Object.entries(SOCKET_CONNECTED_DEVICES)) {
    const terms = deviceData.multilingual[language] || [];
    if (terms.length > 0) {
      // If device type already exists, merge the terms
      if (enhancedTranslations[deviceType]) {
        enhancedTranslations[deviceType] = [...new Set([...enhancedTranslations[deviceType], ...terms])];
      } else {
        enhancedTranslations[deviceType] = terms;
      }
    }
  }
  
  return enhancedTranslations;
}

// Import advanced matching capabilities
const {
  findBestRoomMatch,
  comprehensiveRoomMatch,
  normalizeUnicode,
  SIMILARITY_THRESHOLD
} = require('./advancedMultilingualMatcher');

/**
 * Enhanced normalize room name with advanced fuzzy matching
 * @param {string} roomName - The room name to normalize
 * @param {string} language - The detected language
 * @param {Array} availableRooms - Optional array of available room names from Homey
 * @param {Function} llmFunction - Optional LLM function for semantic matching
 * @returns {Promise<string>} Normalized room name or best match
 */
async function normalizeRoomNameAdvanced(roomName, language = 'en', availableRooms = [], llmFunction = null) {
  if (!roomName) return '';

  const lowerRoomName = roomName.toLowerCase().trim();

  // If no available rooms provided, fall back to legacy behavior
  if (availableRooms.length === 0) {
    return normalizeRoomNameLegacy(roomName, language, availableRooms);
  }

  // Use advanced matching for better results
  try {
    const matchResult = await comprehensiveRoomMatch(roomName, availableRooms, language, llmFunction);

    if (matchResult.match && matchResult.confidence >= SIMILARITY_THRESHOLD) {
      console.log(`🎯 Advanced room match: "${roomName}" -> "${matchResult.match}" (${matchResult.method}, confidence: ${matchResult.confidence.toFixed(2)})`);
      return matchResult.match.toLowerCase();
    }
  } catch (error) {
    console.warn('Advanced room matching failed, falling back to legacy:', error);
  }

  // Fall back to legacy matching if advanced matching fails
  return normalizeRoomNameLegacy(roomName, language, availableRooms);
}

/**
 * Legacy normalize room name function (original implementation)
 * @param {string} roomName - The room name to normalize
 * @param {string} language - The detected language
 * @param {Array} availableRooms - Optional array of available room names from Homey
 * @returns {string} Normalized room name in English or original if it matches available rooms
 */
function normalizeRoomNameLegacy(roomName, language = 'en', availableRooms = []) {
  if (!roomName) return '';

  const lowerRoomName = roomName.toLowerCase().trim();
  const originalRoomName = roomName.trim();

  // If already in English, return as-is
  if (language === 'en') {
    return lowerRoomName;
  }

  // Check if the original room name (with proper casing) exists in available rooms
  if (availableRooms.length > 0) {
    const exactMatch = availableRooms.find(room => room.toLowerCase() === lowerRoomName);
    if (exactMatch) {
      return exactMatch.toLowerCase();
    }

    // Check for case-insensitive partial matches with original room names
    const partialMatch = availableRooms.find(room => room.toLowerCase().includes(lowerRoomName)
      || lowerRoomName.includes(room.toLowerCase()));
    if (partialMatch) {
      return partialMatch.toLowerCase();
    }

    // Special handling for Swedish definite articles and character variations
    if (language === 'sv') {
      // Check if adding/removing definite articles creates a match
      const withoutArticle = lowerRoomName.replace(/(en|et|n)$/, '');
      const withArticle = `${lowerRoomName}en`;

      // Also handle character variations (ä vs ä, etc.)
      const normalizeSwedish = str => {
        return str.replace(/ä/g, 'ä').replace(/ö/g, 'ö').replace(/å/g, 'å');
      };

      const articleMatch = availableRooms.find(room => {
        const roomLower = normalizeSwedish(room.toLowerCase());
        const normalizedWithout = normalizeSwedish(withoutArticle);
        const normalizedWith = normalizeSwedish(withArticle);
        const normalizedOriginal = normalizeSwedish(lowerRoomName);

        return roomLower === normalizedWithout
               || roomLower === normalizedWith
               || roomLower === normalizedOriginal
               || roomLower.includes(normalizedWithout)
               || roomLower.includes(normalizedWith)
               || roomLower.includes(normalizedOriginal)
               || normalizedWithout.includes(roomLower)
               || normalizedWith.includes(roomLower)
               || normalizedOriginal.includes(roomLower);
      });

      if (articleMatch) {
        return articleMatch.toLowerCase();
      }
    }
  }

  // Check translations for the detected language
  const languageRooms = ROOM_TRANSLATIONS[language] || {};

  for (const [englishRoom, translations] of Object.entries(languageRooms)) {
    if (translations.some(translation => lowerRoomName.includes(translation.toLowerCase())
      || translation.toLowerCase().includes(lowerRoomName))) {
      // If we have available rooms, check if the English translation would match
      if (availableRooms.length > 0) {
        const englishMatch = availableRooms.find(room => room.toLowerCase().includes(englishRoom.toLowerCase())
          || englishRoom.toLowerCase().includes(room.toLowerCase()));
        if (!englishMatch) {
          // English translation doesn't match available rooms, keep original
          return lowerRoomName;
        }
      }
      return englishRoom;
    }
  }

  // Fallback: check all languages for fuzzy matching
  for (const [lang, rooms] of Object.entries(ROOM_TRANSLATIONS)) {
    for (const [englishRoom, translations] of Object.entries(rooms)) {
      if (translations.some(translation => lowerRoomName.includes(translation.toLowerCase())
        || translation.toLowerCase().includes(lowerRoomName))) {
        // If we have available rooms, check if the English translation would match
        if (availableRooms.length > 0) {
          const englishMatch = availableRooms.find(room => room.toLowerCase().includes(englishRoom.toLowerCase())
            || englishRoom.toLowerCase().includes(room.toLowerCase()));
          if (!englishMatch) {
            // English translation doesn't match available rooms, keep original
            return lowerRoomName;
          }
        }
        return englishRoom;
      }
    }
  }

  return lowerRoomName; // Return original if no match found
}

/**
 * Backward-compatible wrapper for normalizeRoomName
 * @param {string} roomName - The room name to normalize
 * @param {string} language - The detected language
 * @param {Array} availableRooms - Optional array of available room names from Homey
 * @returns {string} Normalized room name (synchronous, uses legacy method)
 */
function normalizeRoomName(roomName, language = 'en', availableRooms = []) {
  return normalizeRoomNameLegacy(roomName, language, availableRooms);
}

/**
 * Normalize action/intent across languages
 * @param {string} action - The action to normalize
 * @param {string} language - The detected language
 * @returns {string} Normalized action in English
 */
function normalizeAction(action, language = 'en') {
  if (!action) return '';

  const lowerAction = action.toLowerCase().trim();

  // If already in English, check if it's a valid English action
  if (language === 'en') {
    const englishActions = ACTION_TRANSLATIONS.en || {};
    for (const [englishAction, translations] of Object.entries(englishActions)) {
      if (translations.some(translation => lowerAction === translation.toLowerCase()
        || lowerAction.includes(translation.toLowerCase()))) {
        return englishAction;
      }
    }
    return lowerAction;
  }

  // Check translations for the detected language
  const languageActions = ACTION_TRANSLATIONS[language] || {};

  // First pass: exact matches
  for (const [englishAction, translations] of Object.entries(languageActions)) {
    if (translations.some(translation => lowerAction === translation.toLowerCase())) {
      return englishAction;
    }
  }

  // Second pass: contains matches (but prioritize longer matches)
  let bestMatch = '';
  let bestAction = '';
  for (const [englishAction, translations] of Object.entries(languageActions)) {
    for (const translation of translations) {
      if (lowerAction.includes(translation.toLowerCase()) && translation.length > bestMatch.length) {
        bestMatch = translation;
        bestAction = englishAction;
      }
    }
  }

  if (bestAction) {
    return bestAction;
  }

  // Fallback: check all languages for exact matching
  for (const [lang, actions] of Object.entries(ACTION_TRANSLATIONS)) {
    for (const [englishAction, translations] of Object.entries(actions)) {
      if (translations.some(translation => lowerAction === translation.toLowerCase()
        || lowerAction.includes(translation.toLowerCase())
        || translation.toLowerCase().includes(lowerAction))) {
        return englishAction;
      }
    }
  }

  return lowerAction; // Return original if no match found
}

/**
 * Normalize device type across languages
 * @param {string} deviceType - The device type to normalize
 * @param {string} language - The detected language
 * @returns {string} Normalized device type in English
 */
function normalizeDeviceType(deviceType, language = 'en') {
  if (!deviceType) return '';

  const lowerDeviceType = deviceType.toLowerCase().trim();

  // If already in English, return as-is
  if (language === 'en') {
    return lowerDeviceType;
  }

  // Check translations for the detected language
  const languageDevices = DEVICE_TRANSLATIONS[language] || {};

  for (const [englishDevice, translations] of Object.entries(languageDevices)) {
    if (translations.some(translation => lowerDeviceType.includes(translation.toLowerCase())
      || translation.toLowerCase().includes(lowerDeviceType))) {
      return englishDevice;
    }
  }

  // Fallback: check all languages for fuzzy matching
  for (const [lang, devices] of Object.entries(DEVICE_TRANSLATIONS)) {
    for (const [englishDevice, translations] of Object.entries(devices)) {
      if (translations.some(translation => lowerDeviceType.includes(translation.toLowerCase())
        || translation.toLowerCase().includes(lowerDeviceType))) {
        return englishDevice;
      }
    }
  }

  return lowerDeviceType; // Return original if no match found
}

/**
 * Process multilingual command and normalize to English
 * @param {string} commandText - The command text to process
 * @param {string} detectedLanguage - The detected language from Whisper
 * @param {Array} availableRooms - Optional array of available room names from Homey
 * @returns {Object} Processed command with normalized entities
 */
function processMultilingualCommand(commandText, detectedLanguage = 'en', availableRooms = []) {
  if (!commandText) {
    return {
      originalText: '',
      normalizedText: '',
      language: detectedLanguage,
      rooms: [],
      actions: [],
      deviceTypes: [],
      confidence: 0
    };
  }

  const originalText = commandText.trim();
  const normalizedText = originalText.toLowerCase();

  // Extract and normalize rooms
  const rooms = [];
  const roomMatches = extractRoomsFromText(originalText, detectedLanguage);
  roomMatches.forEach(room => {
    const normalized = normalizeRoomName(room, detectedLanguage, availableRooms);
    if (normalized && !rooms.includes(normalized)) {
      rooms.push(normalized);
    }
  });

  // Extract and normalize actions
  const actions = [];
  const actionMatches = extractActionsFromText(originalText, detectedLanguage);
  actionMatches.forEach(action => {
    const normalized = normalizeAction(action, detectedLanguage);
    if (normalized && !actions.includes(normalized)) {
      actions.push(normalized);
    }
  });

  // Extract and normalize device types
  const deviceTypes = [];
  const deviceMatches = extractDeviceTypesFromText(originalText, detectedLanguage);
  deviceMatches.forEach(device => {
    const normalized = normalizeDeviceType(device, detectedLanguage);
    if (normalized && !deviceTypes.includes(normalized)) {
      deviceTypes.push(normalized);
    }
  });

  // Calculate confidence based on matches found
  const totalMatches = rooms.length + actions.length + deviceTypes.length;
  const confidence = Math.min(totalMatches * 0.3, 1.0);

  return {
    originalText,
    normalizedText,
    language: detectedLanguage,
    rooms,
    actions,
    deviceTypes,
    confidence
  };
}

/**
 * Extract room names from text in any supported language
 * @param {string} text - The text to analyze
 * @param {string} language - The detected language
 * @returns {Array} Array of found room names
 */
function extractRoomsFromText(text, language = 'en') {
  const rooms = [];
  const lowerText = text.toLowerCase();

  // Check the detected language first
  const languageRooms = ROOM_TRANSLATIONS[language] || {};
  for (const [englishRoom, translations] of Object.entries(languageRooms)) {
    for (const translation of translations) {
      if (lowerText.includes(translation.toLowerCase())) {
        rooms.push(translation);
        break;
      }
    }
  }

  // If no rooms found, check all languages
  if (rooms.length === 0) {
    for (const [lang, roomTranslations] of Object.entries(ROOM_TRANSLATIONS)) {
      for (const [englishRoom, translations] of Object.entries(roomTranslations)) {
        for (const translation of translations) {
          if (lowerText.includes(translation.toLowerCase())) {
            rooms.push(translation);
            break;
          }
        }
      }
    }
  }

  return rooms;
}

/**
 * Extract actions from text in any supported language
 * @param {string} text - The text to analyze
 * @param {string} language - The detected language
 * @returns {Array} Array of found actions
 */
function extractActionsFromText(text, language = 'en') {
  const actions = [];
  const lowerText = text.toLowerCase();

  // Check the detected language first - prioritize longer matches
  const languageActions = ACTION_TRANSLATIONS[language] || {};
  const foundActions = [];

  for (const [englishAction, translations] of Object.entries(languageActions)) {
    for (const translation of translations) {
      // Simple contains check for better accent handling
      if (lowerText.includes(translation.toLowerCase())) {
        foundActions.push({ action: translation, length: translation.length });
      }
    }
  }

  // Sort by length (longest first) and add unique actions
  foundActions.sort((a, b) => b.length - a.length);
  const addedActions = new Set();

  for (const found of foundActions) {
    if (!addedActions.has(found.action)) {
      actions.push(found.action);
      addedActions.add(found.action);
    }
  }

  // If no actions found, check all languages
  if (actions.length === 0) {
    for (const [lang, actionTranslations] of Object.entries(ACTION_TRANSLATIONS)) {
      for (const [englishAction, translations] of Object.entries(actionTranslations)) {
        for (const translation of translations) {
          // Simple contains check for better accent handling
          if (lowerText.includes(translation.toLowerCase())) {
            actions.push(translation);
            break;
          }
        }
      }
    }
  }

  return actions;
}

/**
 * Extract device types from text in any supported language
 * @param {string} text - The text to analyze
 * @param {string} language - The detected language
 * @returns {Array} Array of found device types
 */
function extractDeviceTypesFromText(text, language = 'en') {
  const deviceTypes = [];
  const lowerText = text.toLowerCase();

  // Check the detected language first
  const languageDevices = DEVICE_TRANSLATIONS[language] || {};
  for (const [englishDevice, translations] of Object.entries(languageDevices)) {
    for (const translation of translations) {
      if (lowerText.includes(translation.toLowerCase())) {
        deviceTypes.push(translation);
        break;
      }
    }
  }

  // If no device types found, check all languages
  if (deviceTypes.length === 0) {
    for (const [lang, deviceTranslations] of Object.entries(DEVICE_TRANSLATIONS)) {
      for (const [englishDevice, translations] of Object.entries(deviceTranslations)) {
        for (const translation of translations) {
          if (lowerText.includes(translation.toLowerCase())) {
            deviceTypes.push(translation);
            break;
          }
        }
      }
    }
  }

  return deviceTypes;
}

module.exports = {
  ROOM_TRANSLATIONS,
  ACTION_TRANSLATIONS,
  DEVICE_TRANSLATIONS,
  normalizeRoomName,
  normalizeRoomNameAdvanced,
  normalizeRoomNameLegacy,
  normalizeAction,
  normalizeDeviceType,
  processMultilingualCommand,
  extractRoomsFromText,
  extractActionsFromText,
  extractDeviceTypesFromText,
  getEnhancedDeviceTranslations
};
