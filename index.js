const mineflayer = require('mineflayer');
const Movements = require('mineflayer-pathfinder').Movements;
const pathfinder = require('mineflayer-pathfinder').pathfinder;
const { GoalBlock } = require('mineflayer-pathfinder').goals;

const config = require('./settings.json');
const express = require('express');

const app = express();

app.get('/', (req, res) => {
  res.send('Bot is simulating a real player with 5-hour chat intervals');
});

app.listen(8000, () => {
  console.log('Server started');
});

function createBot() {
   const bot = mineflayer.createBot({
      username: config['bot-account']['username'],
      password: config['bot-account']['password'],
      auth: config['bot-account']['type'],
      host: config.server.ip,
      port: config.server.port,
      version: config.server.version,
   });

   bot.loadPlugin(pathfinder);
   const mcData = require('minecraft-data')(bot.version || config.server.version);
   const defaultMove = new Movements(bot, mcData);

   let pendingPromise = Promise.resolve();

   const getRandom = (min, max) => Math.floor(Math.random() * (max - min + 1) + min);

   function sendRegister(password) {
      return new Promise((resolve) => {
         bot.chat(`/register ${password} ${password}`);
         console.log(`[Auth] Sent /register command.`);
         bot.once('chat', (username, message) => {
            console.log(`[ChatLog] <${username}> ${message}`);
            resolve();
         });
      });
   }

   function sendLogin(password) {
      return new Promise((resolve) => {
         bot.chat(`/login ${password}`);
         console.log(`[Auth] Sent /login command.`);
         bot.once('chat', (username, message) => {
            console.log(`[ChatLog] <${username}> ${message}`);
            resolve();
         });
      });
   }

   bot.once('spawn', () => {
      console.log('\x1b[33m[RealPlayerSim] Bot joined. Chat interval: 5 hours.', '\x1b[0m');

      if (config.utils['auto-auth'].enabled) {
         const password = config.utils['auto-auth'].password;
         pendingPromise = pendingPromise
            .then(() => new Promise(r => setTimeout(r, getRandom(2000, 5000))))
            .then(() => sendRegister(password))
            .then(() => new Promise(r => setTimeout(r, getRandom(1000, 3000))))
            .then(() => sendLogin(password))
            .catch(error => console.error('[ERROR]', error));
      }

      // 1. الحركة العشوائية
      const controls = ['forward', 'back', 'left', 'right'];
      function randomMovement() {
         controls.forEach(c => bot.setControlState(c, false));
         if (Math.random() > 0.2) {
            const move = controls[getRandom(0, controls.length - 1)];
            bot.setControlState(move, true);
         }
         setTimeout(randomMovement, getRandom(3000, 7000));
      }
      randomMovement();

      // 2. القفز العشوائي
      function randomJump() {
         bot.setControlState('jump', true);
         setTimeout(() => bot.setControlState('jump', false), 400);
         setTimeout(randomJump, getRandom(4000, 10000));
      }
      randomJump();

      // 3. الشفت العشوائي
      function randomSneak() {
         bot.setControlState('sneak', true);
         setTimeout(() => bot.setControlState('sneak', false), getRandom(500, 2000));
         setTimeout(randomSneak, getRandom(8000, 15000));
      }
      randomSneak();

      // 4. الالتفات العشوائي
      function randomLook() {
         const yaw = (Math.random() * Math.PI * 2); 
         const pitch = (Math.random() - 0.5) * Math.PI; 
         bot.look(yaw, pitch, false);
         setTimeout(randomLook, getRandom(2000, 5000));
      }
      randomLook();

      // --- تعديل الشات: رسالة واحدة كل 5 ساعات ---
      if (config.utils['chat-messages'].enabled) {
         const messages = config.utils['chat-messages']['messages'];
         let i = 0;
         const FIVE_HOURS = 5 * 60 * 60 * 1000; // 18,000,000 مللي ثانية

         function sendRandomChat() {
            if (messages.length > 0) {
               bot.chat(messages[i]);
               console.log(`[Chat] Sent message: ${messages[i]}. Next message in 5 hours.`);
               i = (i + 1) % messages.length;
            }
            setTimeout(sendRandomChat, FIVE_HOURS);
         }
         // إرسال أول رسالة بعد 10 ثوانٍ من الدخول، ثم كل 5 ساعات
         setTimeout(sendRandomChat, 10000);
      }
   });

   bot.on('death', () => {
      console.log(`\x1b[33m[Sim] Bot died, waiting to respawn...\x1b[0m`);
   });

   if (config.utils['auto-reconnect']) {
      bot.on('end', () => {
         setTimeout(() => createBot(), getRandom(5000, 10000)); 
      });
   }

   bot.on('error', (err) => console.log(`\x1b[31m[ERROR] ${err.message}`, '\x1b[0m'));
}

createBot();
