# Homey Assistant with ChatGPT Integration

A powerful Homey assistant that integrates ChatGPT capabilities with your Homey home automation system, allowing natural language control through Telegram.

## Features

- Natural language processing for home automation commands
- Voice message support with automatic transcription
- Telegram bot integration for remote control
- Support for multiple device types and capabilities
- Room-based and device-specific commands
- Secure API key management

## Prerequisites

- Homey device running firmware >=8.1.1
- Telegram Bot Token (obtain from [@BotFather](https://t.me/botfather))
- OpenAI API Key (obtain from [OpenAI Platform](https://platform.openai.com))
- Node.js dependencies:
  ```bash
  npm install homey@latest
  npm install @types/homey@latest
  ```

## Installation

1. Install the app from the Homey App Store
2. Configure the required API keys in the app settings
3. Start chatting with your Telegram bot

## Configuration

### Setting up API Keys

1. Open the Homey app
2. Navigate to Apps > Homey Assistant
3. Go to Settings
4. Enter your Telegram Bot Token
5. Enter your OpenAI API Key
6. Click Save

### Supported Commands

The assistant understands various command types:

- Room-based commands: "Turn off all lights in the living room"
- Device-specific commands: "Set bedroom thermostat to 22 degrees"
- Status queries: "What's the temperature in the kitchen?"
- Multiple device commands: "Turn on all lights in the house"

### Smart Socket Integration

The assistant features intelligent socket integration that automatically recognizes what devices are connected to smart sockets:

**Automatic Device Recognition:**
- Lamp sockets are included when you say "turn on lights"
- TV/media sockets respond to entertainment commands
- Kitchen appliance sockets are recognized for cooking commands
- Climate control sockets work with heating/cooling commands

**Supported Socket Categories:**
- **Lighting**: Table lamps, reading lights, floor lamps
- **Entertainment**: TVs, sound systems, media players
- **Kitchen Appliances**: Coffee machines, microwaves, toasters, dishwashers
- **Climate Control**: Fans, heaters, air conditioning
- **Laundry**: Washing machines, dryers

**Example Commands:**
- "Turn on the lights" → Controls both ceiling lights AND table lamps (via sockets)
- "What lights are on?" → Shows both traditional lights and lamp sockets
- "Start the coffee machine" → Finds and controls coffee machine socket
- "Turn on entertainment devices" → Controls TVs and sound systems via sockets

**Multilingual Support:**
Socket recognition works in multiple languages with vocabulary for device names in English, Swedish, German, Spanish, and French.

## Architecture

The app consists of several key components:

- Telegram Bot: Handles message reception and delivery
- ChatGPT Integration: Processes natural language commands
- Homey API: Executes commands on your devices
- Voice Processing: Transcribes voice messages to text

## Troubleshooting

### Common Issues

1. Bot not responding
   - Check if the Telegram Bot Token is correct
   - Verify the bot is running in Homey

2. Commands not working
   - Ensure the OpenAI API key is valid
   - Check if the requested devices are available in Homey

3. Voice messages not working
   - Verify the OpenAI API key has access to the Whisper API
   - Check the audio file format is supported

## Contributing

Contributions are welcome! Please read our [Contributing Guidelines](CONTRIBUTING.md) and [Code of Conduct](CODE_OF_CONDUCT.md).

## Support

For support:
- Create an issue in our [GitHub repository](https://github.com/decline27/com.chatgtp.assistent/issues)
- Contact the developer at decline27@gmail.com

## License

This project is licensed under the terms specified in the [LICENSE](LICENSE) file.

## Author

Kjetil Vetlejord (decline27@gmail.com)