'use strict';
const { onMessage } = require('./telegram');

module.exports = function initTelegramListener(app) {
	// Sets up the Telegram message listener
	onMessage(async (msg) => {
		const chatId = msg.chat.id;
		try {
			let commandText = "";
			if (msg.voice) {
				const fileId = msg.voice.file_id;
				app.log(`Voice msg: ${fileId}`);
				const fileInfo = await app.telegram.getFileInfo(fileId);
				const fileUrl = `https://api.telegram.org/file/bot${app.homey.settings.get('telegramBotToken')}/${fileInfo.file_path}`;
				
				// Use helper method to download file data as Buffer
				const buffer = await app.downloadBuffer(fileUrl);
				
				// Transcribe the voice message
				commandText = await app.transcribeVoice(buffer);
			} else if (msg.text) {
				commandText = msg.text;
			} else {
				await app.telegram.sendMessage(chatId, "Unsupported msg type.");
				return;
			}
			if (!commandText || commandText.trim() === "") {
				await app.telegram.sendMessage(chatId, "Empty command.");
				return;
			}
			// Construct and process command
			const jsonCommand = await app.parseCommandWithState(commandText);
			if (jsonCommand.error) {
				await app.telegram.sendMessage(chatId, `Error parsing command: ${jsonCommand.error}`);
				return;
			}
			const resultMessage = await app.executeHomeyCommand(jsonCommand);
			await app.telegram.sendMessage(chatId, `Success: ${resultMessage}`);
			app.log(`Command executed successfully: ${resultMessage}`);
		} catch (error) {
			app.error("Error processing msg:", error);
			await app.telegram.sendMessage(chatId, `Error: ${error.message}`);
		}
	});
};
