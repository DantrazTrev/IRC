#!/usr/bin/env node

const io = require('socket.io-client');
const colors = require('./lib/solarized');
const blessed = require('blessed');
const crypto = require('crypto');
let program = blessed.program();
let screen = require('./ui/screen');
let box = require('./ui/box.js');
let input = require('./ui/input');
let list = require('./ui/userlist');

/** Server URL **/

const URL = 'https://danrirc.glitch.me';

// server connection
const socket = io(URL);
let channel, user,key;

// Append elements to the screen.
screen.append(box.box);
screen.append(input.input);
screen.append(list.list);
box.screen = screen;
input.screen = screen;
list.screen = screen;

let loading = blessed.loading({
	tags: true
});
loading.load(`{center}IRC is connecting to the Central server{/center}`);
screen.append(loading);

// when socket connects
socket.on('connect', () => {
	socket.on('/key',(msg)=>{ 
		key=msg;	
	box.box.content = `{center}{${colors.blue}-fg}Connected to the Central server{/${colors.blue}-fg}{/center}`;
	screen.render();
	// stop loading
	loading.stop();

	
})
	// join a channel
	let userJoin = () => {
		box.addPrompt('Enter user handle');
		input.set('Choran IV')
		input.read((val) => {
			user = val;
			box.addInline(` (${user})`);
			// join
			socket.emit('/join', { channel: channel, user: user });
		});
	};
	input.set('River'); // default channel
	box.addPrompt('Enter channel to join');
	input.read((ch) => {
		var encryptedchannel = crypto.publicEncrypt(
			{
				key: key,
				padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
				oaepHash: "sha256",
			},
			// We convert the data string to a buffer using `Buffer.from`
			Buffer.from(ch)
		)
		channel = encryptedchannel.toString("base64");
		box.addInline(` (${channel})`);
		userJoin();
	});

	// set other listener
	socket.on('/status', (msg) => {
		if (msg.type === 'join failed') {
			box.addErr(msg.data);
			userJoin();
		} else if (msg.type === 'joined') {
			// update screen title
			screen.title = `${user} on #${channel} `;
			screen.render();
			// delete old lines
			box.deleteAllLines();
			// get current users in channel
			socket.emit('/users', {channel: channel});
			// set title
			box.setJoinMessage(channel, URL);
			// listener for messages
			socket.on('/msg ' + channel, function (msg) {
				if (msg.user === null) {
					box.addChatAnn(msg.data);
				} else {
					box.addChatMsg(msg);
				}
			});
			// listener for meta messages
			socket.on('/meta ' + channel, (msg) => {
				if (msg.type === 'join'){
					list.addUser(msg.data);
				} else if (msg.type === 'left'){
					list.removeUser(msg.data);
				}
			});
			// get user input messages
			let getInput = () => {
				input.read((val) => {
					socket.emit('/msg ' + channel, { user: user, data: val });
					getInput();
				});
			};
			getInput();
		}
	});

	socket.on('/cb', (msg) => {
		if (msg.type === 'users'){
			list.addUsers(msg.data);
		}
	});
});

// initial render
screen.render();

// force exit feature
program.key('C-c', function (ch, key) {
	program.clear();
	process.exit(0);
});

// clear value when escape pressed
// meant as a way to cancel message operation
program.key('escape', (ch, key) => {
	input.clear();
});
