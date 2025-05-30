# Smart Socket Integration Guide

This guide explains the advanced socket integration feature that allows the Homey Assistant to intelligently recognize and control devices connected to smart sockets.

## Overview

The socket integration feature automatically identifies what type of devices are connected to smart sockets based on their names, allowing you to control them naturally through voice commands and status queries.

## How It Works

### Device Recognition
The system uses comprehensive vocabulary matching to identify connected devices:

```javascript
// Example: A socket named "Living Room Table Lamp" is automatically recognized as a lighting device
// When you say "turn on lights", it includes both ceiling lights AND the table lamp socket
```

### Categories of Recognized Devices

#### 🏠 Lighting Devices
- **Keywords**: light, lamp, ljus, lampa, belysning, lumière, luz, licht
- **Examples**: "Table Lamp", "Reading Light", "Floor Lamp"
- **Integration**: Included in light commands and status queries

#### 📺 Entertainment Devices  
- **Keywords**: tv, television, media, sound, speaker, audio, stereo
- **Examples**: "TV Stand", "Sound System", "Media Center"
- **Integration**: Included in entertainment and speaker commands

#### 🍳 Kitchen Appliances
- **Keywords**: coffee, microwave, toaster, dishwasher, oven, kettle
- **Examples**: "Coffee Machine", "Kitchen Microwave", "Toaster Socket"
- **Integration**: Recognized for kitchen appliance commands

#### 🌡️ Climate Control
- **Keywords**: fan, heater, air, climate, heating, cooling
- **Examples**: "Bedroom Fan", "Space Heater", "AC Unit"
- **Integration**: Included in climate control commands

#### 🧺 Laundry Appliances
- **Keywords**: washing, washer, dryer, laundry
- **Examples**: "Washing Machine", "Dryer Socket"
- **Integration**: Recognized for laundry commands

## Command Examples

### Light Control
```
User: "Turn on the lights in the living room"
System: Controls ceiling lights + table lamp sockets + floor lamp sockets

User: "What lights are on?"
System: "Living Room Ceiling Light: On, 75% brightness
         Living Room Table Lamp: On (controlling lamp)"
```

### Entertainment Control
```
User: "Turn on entertainment devices"
System: Controls TV sockets + sound system sockets + media player sockets

User: "Turn off the TV"
System: Controls both TV devices and TV sockets
```

### Kitchen Commands
```
User: "Start the coffee machine"
System: Finds and controls coffee machine socket automatically

User: "Turn on kitchen appliances"
System: Controls dishwasher, microwave, coffee machine, toaster sockets
```

### Status Queries
```
User: "What's on in the kitchen?"
System: Shows both traditional appliances AND smart socket appliances
```

## Technical Implementation

### Socket Device Identification

The system uses a sophisticated matching algorithm:

1. **Exact vocabulary matching** for device types
2. **Multilingual support** with terms in 5+ languages  
3. **Category-based grouping** for logical device organization
4. **Pattern recognition** for device name variations

### Enhanced Status Display

Socket devices show enhanced status information:

```
🔌 Living Room Table Lamp: On (controlling lamp)
🔌 Kitchen Coffee Machine: On (controlling coffeemachine - kitchen appliance) - 150W
🔌 TV Stand Media Center: Off (controlling tv - entertainment device)
```

### Room Filtering

Socket integration respects room filtering:
- "Turn on lights in bedroom" includes bedroom lamp sockets only
- "What's on in the kitchen?" shows kitchen appliance sockets only

## Configuration

### No Setup Required
The socket integration works automatically without any configuration. The system intelligently identifies devices based on their names.

### Custom Device Names
For best results, name your sockets descriptively:

✅ **Good names:**
- "Living Room Table Lamp"
- "Kitchen Coffee Machine"
- "Bedroom Reading Light"
- "TV Stand Media Center"

❌ **Less optimal names:**
- "Socket 1"
- "Power Outlet"
- "Plug"

### Multilingual Support

The system recognizes device names in multiple languages:

| Device Type | English | Swedish | German | Spanish | French |
|-------------|---------|---------|---------|---------|---------|
| Light | light, lamp | ljus, lampa | licht, lampe | luz, lámpara | lumière, lampe |
| Coffee | coffee | kaffe | kaffee | café | café |
| TV | tv, television | tv, television | fernseher, tv | televisión, tv | télévision, tv |

## Benefits

### 1. **Natural Language Control**
- Say "turn on lights" and control ALL lighting devices
- No need to remember specific socket names
- Intuitive commands work as expected

### 2. **Comprehensive Status**
- Status queries show complete picture
- See both traditional devices and socket devices
- Power usage information for appliances

### 3. **Room Intelligence**
- Room-based commands include relevant sockets
- Filtering works across device types
- Consistent behavior throughout the system

### 4. **Multilingual Ready**
- Works in multiple languages
- Recognizes local device terminology
- Seamless international support

## Troubleshooting

### Socket Not Recognized?

1. **Check the name**: Ensure the socket name contains recognizable device keywords
2. **Use descriptive names**: "Coffee Machine" works better than "Kitchen Socket"
3. **Include device type**: "Table Lamp" is clearer than just "Lamp"

### Command Not Including Sockets?

1. **Verify device category**: Check if the socket matches the command type
2. **Use specific commands**: "Turn on entertainment devices" for media sockets
3. **Check room filtering**: Ensure the socket is in the target room

### Multilingual Issues?

1. **Use local terms**: Include local language device names
2. **Mix languages**: "Kitchen Kaffemaskin" works with both English and Swedish
3. **Check vocabulary**: Refer to the multilingual support table above

## Advanced Features

### Power Usage Tracking
Socket devices show power consumption when available:
```
🔌 Kitchen Coffee Machine: On (controlling coffeemachine - kitchen appliance) - 150W (high power usage)
```

### Category-Based Commands
```
User: "Turn on all kitchen appliances"
System: Activates all kitchen category sockets + traditional kitchen devices
```

### Smart Filtering
The system intelligently includes relevant sockets while excluding others:
```
User: "Turn on lights"
✅ Includes: Lamp sockets, light sockets
❌ Excludes: TV sockets, appliance sockets
```

## Testing

Run the integration tests to verify socket functionality:

```bash
# Run socket integration tests
npm test -- --grep "Socket Integration"

# Run practical demonstration
node integration-socket-test.js
```

The tests verify:
- ✅ Socket device type identification
- ✅ Category-based filtering
- ✅ Room filtering with sockets
- ✅ Status display enhancements
- ✅ Power usage information
- ✅ Multilingual device recognition

## API Reference

### Core Functions

```javascript
// Identify what type of device a socket controls
identifySocketDeviceType(socketName)

// Get device category (lighting, kitchen, entertainment, etc.)
getDeviceCategory(deviceType)

// Check if socket controls specific device type
isSocketOfType(device, targetType)

// Enhanced device status with socket integration
getDeviceTypeStatus(deviceType, devices, zones, roomFilter, language)
```

This socket integration makes your smart home more intuitive and powerful, allowing natural control of all your devices regardless of how they're connected to your Homey system.
