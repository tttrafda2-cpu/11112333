const mineflayer = require('mineflayer');
const Movements = require('mineflayer-pathfinder').Movements;
const pathfinder = require('mineflayer-pathfinder').pathfinder;
const { GoalBlock } = require('mineflayer-pathfinder').goals;

const config = require('./settings.json');
const express = require('express');

const app = express();

app.get('/', (req, res) => {
  res.send('Bot is simulating a real player');
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

   // دالة لتوليد رقم عشوائي بين قيمتين
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
      console.log('\x1b[33m[RealPlayerSim] Bot joined the server as a "real player"', '\x1b[0m');

      if (config.utils['auto-auth'].enabled) {
         const password = config.utils['auto-auth'].password;
         pendingPromise = pendingPromise
            .then(() => new Promise(r => setTimeout(r, getRandom(2000, 5000)))) // تأخير بشري قبل التسجيل
            .then(() => sendRegister(password))
            .then(() => new Promise(r => setTimeout(r, getRandom(1000, 3000))))
            .then(() => sendLogin(password))
            .catch(error => console.error('[ERROR]', error));
      }

      // --- منطق محاكاة اللاعب الحقيقي (Human-like Behavior) ---

      // 1. الحركة العشوائية (تغيير الاتجاهات بشكل غير منتظم)
      const controls = ['forward', 'back', 'left', 'right'];
      function randomMovement() {
         // إيقاف كل الحركات الحالية أولاً
         controls.forEach(c => bot.setControlState(c, false));
         
         // اختيار حركة عشوائية أو التوقف (Idle)
         if (Math.random() > 0.2) { // 80% احتمال للحركة
            const move = controls[getRandom(0, controls.length - 1)];
            bot.setControlState(move, true);
            console.log(`[Sim] Moving: ${move}`);
         } else {
            console.log(`[Sim] Standing still (Idle)`);
         }

         // تكرار العملية بعد وقت عشوائي (بين 3 إلى 7 ثوانٍ)
         setTimeout(randomMovement, getRandom(3000, 7000));
      }
      randomMovement();

      // 2. القفز العشوائي (بين 4 إلى 10 ثوانٍ)
      function randomJump() {
         bot.setControlState('jump', true);
         setTimeout(() => bot.setControlState('jump', false), 400);
         
         setTimeout(randomJump, getRandom(4000, 10000));
      }
      randomJump();

      // 3. الشفت العشوائي (بين 8 إلى 15 ثانية)
      function randomSneak() {
         bot.setControlState('sneak', true);
         setTimeout(() => bot.setControlState('sneak', false), getRandom(500, 2000));
         
         setTimeout(randomSneak, getRandom(8000, 15000));
      }
      randomSneak();

      // 4. الالتفات العشوائي (تحريك الرأس كأنه ينظر حوله)
      function randomLook() {
         const yaw = (Math.random() * Math.PI * 2); // التفات كامل
         const pitch = (Math.random() - 0.5) * Math.PI; // نظر للأعلى والأسفل
         bot.look(yaw, pitch, false);
         
         setTimeout(randomLook, getRandom(2000, 5000));
      }
      randomLook();

      // رسائل الشات بتوقيتات متباعدة
      if (config.utils['chat-messages'].enabled) {
         const messages = config.utils['chat-messages']['messages'];
         let i = 0;
         function sendRandomChat() {
            bot.chat(messages[i]);
            i = (i + 1) % messages.length;
            setTimeout(sendRandomChat, getRandom(15000, 45000)); // رسالة كل 15-45 ثانية
         }
         setTimeout(sendRandomChat, 10000);
      }
   });

   bot.on('death', () => {
      console.log(`\x1b[33m[Sim] Bot died, waiting to respawn...\x1b[0m`);
   });

   if (config.utils['auto-reconnect']) {
      bot.on('end', () => {
         setTimeout(() => createBot(), getRandom(5000, 10000)); // إعادة اتصال بتوقيت عشوائي
      });
   }

   bot.on('error', (err) => console.log(`\x1b[31m[ERROR] ${err.message}`, '\x1b[0m'));
}

createBot();
