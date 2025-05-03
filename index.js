import makeWASocket, { useSingleFileAuthState } from '@whiskeysockets/baileys';
import axios from 'axios';
import { readFileSync, writeFileSync } from 'fs';
import path from 'path';

const __dirname = path.resolve();
const authFile = path.join(__dirname, './auth.json');
const { state, saveState } = useSingleFileAuthState(authFile);

async function startBot() {
  const sock = makeWASocket({ auth: state });
  sock.ev.on('creds.update', saveState);

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;

    const chatId = msg.key.remoteJid;
    const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text;
    if (!text) return;

    try {
      const groqRes = await axios.post(
        'https://api.groq.com/openai/v1/chat/completions',
        {
          model: 'llama3-8b-8192',
          messages: [
            { role: 'system', content: 'You are a helpful assistant replying to customers.' },
            { role: 'user', content: text }
          ]
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.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}`
          }
        }
      );

      const reply = groqRes.data.choices[0].message.content;
      await sock.sendMessage(chatId, { text: reply });
    } catch (error) {
      console.error('Error from Groq:', error.message);
      await sock.sendMessage(chatId, { text: 'Sorry, something went wrong!' });
    }
  });
}

startBot();
