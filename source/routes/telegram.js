const config = require('config');
const router = new require('express').Router();
const http = require('http');

const spawn = require('child_process').spawn;

module.exports = Factory;

function Factory({path, bot, BotCommandsFactory}) {
	const botCommands = BotCommandsFactory(getChatId, getChatMessageText);

	bot.on('message', onBotMessage);
	bot.setWebHook(`${config.hosting.url}${path}/bot${config.protocols.telegram.token}`);

	router.post(`/bot${config.protocols.telegram.token}`, onPostBotMessage);
	router.get('/stickers/:fileId', onGetFile);


	return router;

	function onGetFile(req, res) {
		return bot
			.getFile(req.params.fileId)
			.then((res) => res.file_path)
			.then((filePath) => {
				const imgUrl = `http://api.telegram.org/file/bot${config.protocols.telegram.token}/${filePath}`;

				const magick = (process.platform === 'win32')
					? spawn('magick', ['convert', imgUrl, '-resize', '128', 'png:-'])
					: spawn('convert', [imgUrl, '-resize', '128', 'png:-']);

				magick.stderr.on('data', (data) => console.error(data.toString()));
				magick.stdout.pipe(res);

				res.type('png');
			})
			.catch((err) => {
				console.error(err);
				res.sendStatus(500);
			});
	}


	function onPostBotMessage(req, res) {
		bot.processUpdate(req.body);
		res.sendStatus(200);
	}


	function onBotMessage(message) {
		console.log('telegram: message', JSON.stringify(message));

		switch (true) {
			case isInvited.call(this, message):
				return botCommands.registerChat(message);
			case isRemoved.call(this, message):
				return botCommands.unregisterChat(message);
			default:
				return botCommands.process(message,
					() => {
						/* custom command */
					},
					() => {
						botCommands.send({
							broadcast: true,
							to: getChatId(message),
							from: getUserName(message),
							message: getChatMessageText(message)
						});
					}
				);
		}
	}

	function isInvited(message) {
		return message.new_chat_member &&
			message.new_chat_member.username === config.protocols.telegram.botName;
	}

	function isRemoved(message) {
		return message.left_chat_member &&
			message.left_chat_member.username === config.protocols.telegram.botName;
	}


	function getChatId(message) {
		return `telegram:${message.chat.id}`;
	}

	function getUserName(message) {
		let name = '';

		if (message.from.first_name || message.from.last_name) {
			const names = [];

			message.from.first_name && names.push(message.from.first_name);
			message.from.last_name && names.push(message.from.last_name);

			name = names.join(' ');
		} else {
			name = message.from.username;
		}

		return {name};
	}

	function getChatMessageText(message) {
		if (message.sticker) {
			return `${config.hosting.url}${path}/stickers/${message.sticker.file_id}`;
		}

		return message.text || '';
	}

}
