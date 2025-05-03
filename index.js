const baileys = require('@whiskeysockets/baileys');
const { default: makeWASocket, useSingleFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = baileys;
const { Boom } = require('@hapi/boom');
const axios = require('axios');
const fs = require('fs');

const authFile = './auth_info.json';
const { state, saveState } = useSingleFileAuthState(authFile);

const groqApiKey = process.env.GROQ_API_KEY;

const sock = makeWASocket({
  printQRInTerminal: true,
  auth: state,
});

sock.ev.on('messages.upsert', async (messageUpdate) => {
  try {
    const messages = messageUpdate.messages;
    const message = messages[0];
    const messageText = message?.text;

    if (messageText) {
      const response = await getGroqResponse(messageText);
      await sendMessage(message.key.remoteJid, response);
    }
  } catch (error) {
    console.error('Error processing message:', error);
  }
});

sock.ev.on('connection.update', (update) => {
  const { connection, lastDisconnect } = update;

  if (connection === 'close') {
    if (lastDisconnect.error?.output?.statusCode !== 401) {
      console.log('Unexpected disconnection:', lastDisconnect.error);
    } else {
      console.log('Connection closed. Reconnecting...');
      startBot();
    }
  }
});

async function getGroqResponse(query) {
  try {
    const response = await axios.post(
      'https://api.groq.com/v1/query',
      {
        query: query,
      },
      {
        headers: {
          'Authorization': `Bearer ${groqApiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data?.result || 'Sorry, I didn’t understand that.';
  } catch (error) {
    console.error('Error with Groq API:', error);
    return 'Sorry, there was an issue with the server.';
  }
}

async function sendMessage(to, text) {
  try {
    await sock.sendMessage(to, { text });
  } catch (error) {
    console.error('Error sending message:', error);
  }
}

startBot();

function startBot() {
  console.log('Starting WhatsApp bot...');
  sock.connect();
}
