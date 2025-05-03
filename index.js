const baileys = require('@whiskeysockets/baileys');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const { default: makeWASocket, useSingleFileAuthState } = baileys;

const authFile = path.join(__dirname, './auth.json');
const { state, saveState } = useSingleFileAuthState(authFile);

async function startBot() {
  const sock = makeWASocket({ auth: state });
  sock.ev.on('creds.update', saveState);

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;

    const chatId = msg.key.remoteJid;
    const text =
      msg.message?.conversation ||
      msg.message?.extendedTextMessage?.text ||
      '';

    if (!text) return;

    try {
      const groqRes = await axios.post(
        'https://api.groq.com/openai/v1/chat/completions',
        {
          model: 'llama3-8b-8192',
          messages: [
            {
              role: 'system',
              content: 'You are a helpful assistant replying to customers.',
            },
            { role: 'user', content: text },
          ],
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const reply = groqRes.data.choices[0].message.content;
      await sock.sendMessage(chatId, { text: reply });
    } catch (error) {
      console.error('Error from Groq:', error.message);
      await sock.sendMessage(chatId, {
        text: 'Sorry, something went wrong!',
      });
    }
  });
}

startBot();
