const { default: makeWASocket, useSingleFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const axios = require('axios');
const fs = require('fs');

const authFile = './auth_info.json';
const { state, saveState } = useSingleFileAuthState(authFile);

async function connectToWhatsApp() {
  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: true,
  });

  sock.ev.on('creds.update', saveState);

  sock.ev.on('messages.upsert', async (m) => {
    const msg = m.messages[0];
    if (!msg.message || msg.key.fromMe) return;

    const sender = msg.key.remoteJid;
    const text = msg.message.conversation || msg.message.extendedTextMessage?.text;

    if (text) {
      console.log('📩 New message:', text);

      // Send message to Groq API
      try {
        const res = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
          model: 'llama3-8b-8192',
          messages: [
            { role: 'system', content: 'You are a helpful assistant.' },
            { role: 'user', content: text },
          ],
        }, {
          headers: {
            'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
            'Content-Type': 'application/json',
          },
        });

        const reply = res.data.choices[0].message.content;
        await sock.sendMessage(sender, { text: reply });
      } catch (err) {
        console.error('Groq API error:', err.response?.data || err.message);
        await sock.sendMessage(sender, { text: 'Sorry, I had an issue replying.' });
      }
    }
  });

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === 'close') {
      const shouldReconnect = (lastDisconnect.error = new Boom(lastDisconnect?.error))?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log('connection closed due to', lastDisconnect.error, ', reconnecting:', shouldReconnect);
      if (shouldReconnect) connectToWhatsApp();
    } else if (connection === 'open') {
      console.log('✅ Connected to WhatsApp');
    }
  });
}

connectToWhatsApp();
