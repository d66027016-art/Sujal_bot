require('dotenv').config();
const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals: { GoalNear } } = require('mineflayer-pathfinder');
const Vec3 = require('vec3');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const ADMIN_PASSWORD = process.env.ADMIN_PASS || 'Sujal8905';
const PORT = process.env.PORT || 4000;

// Validate Environment Variables for Render
const requiredEnv = ['BOT_HOST', 'BOT_PORT', 'BOT_USERNAME'];
const missingEnv = requiredEnv.filter(key => !process.env[key]);
if (missingEnv.length > 0) {
  console.error(`[System] CRITICAL ERROR: Missing environment variables: ${missingEnv.join(', ')}`);
  console.error(`[System] Please add them in the Render Dashboard -> Environment tab.`);
}

const app = express();
const server = http.createServer(app);
const io = new Server(server);
let isAfkEnabled = true;
let autoMsgTimer = null;
let lastAutoMsgTime = Date.now();
let isNavigating = false;
let distanceInterval = null;
let retryTimeout = null;

app.use(express.static('public'));

// Override console.log to stream to web dashboard
const originalLog = console.log;
console.log = function (...args) {
  originalLog.apply(console, args);
  let msg = args.map(a => (typeof a === 'object' ? JSON.stringify(a) : a)).join(' ');

  // Determine type and level, then strip tags for a cleaner UI
  let type = 'System';
  let level = 'info';

  const tags = [
    { tag: '[Server Raw Message]', type: 'Server', level: 'server' },
    { tag: '[Server]', type: 'Server', level: 'server' },
    { tag: '[ChatGame]', type: 'Game', level: 'bot' },
    { tag: '[Interaction]', type: 'Bot', level: 'bot' },
    { tag: '[Web Action]', type: 'Bot', level: 'bot' },
    { tag: '[Web Command Executed]', type: 'Bot', level: 'bot' },
    { tag: '[Inventory Action]', type: 'Bot', level: 'bot' },
    { tag: '[Nav]', type: 'Bot', level: 'bot' },
    { tag: '[Whisper]', type: 'Game', level: 'bot' },
    { tag: '[Manual Action]', type: 'Bot', level: 'bot' },
    { tag: '[Bot]', type: 'Bot', level: 'bot' }
  ];

  for (const t of tags) {
    if (msg.includes(t.tag)) {
      type = t.type;
      level = t.level;
      msg = msg.replace(t.tag, '').trim();
      break;
    }
  }

  // Special case for protocol debug logs
  if (msg.includes('Chunk size is') || msg.includes('DecoderException')) {
    type = 'System';
    level = 'info';
  }

  // Special case for bot status logs that might not have tags
  if (msg.includes('Bot spawned') || msg.includes('Moving to NPC')) {
    type = 'Bot';
    level = 'bot';
  }

  io.sockets.sockets.forEach(s => {
    if (s.authenticated) {
      // If it was a raw server message, we already stripped the tag but kept the JSON string
      if (type === 'Server' && level === 'server' && args[0]?.includes?.('[Server Raw Message]')) {
        try {
          const rawObj = JSON.parse(msg);
          const finalObj = rawObj.json || rawObj;
          s.emit('log', { type: 'Server', msg: finalObj, level: 'server', isRaw: true });
          return;
        } catch (e) {
          // Fallback to plain text
        }
      }
      s.emit('log', { type, msg, level });
    }
  });
};

io.on('connection', (socket) => {
  socket.on('auth', (pass) => {
    if (pass === ADMIN_PASSWORD) {
      socket.authenticated = true;
      socket.emit('auth_success');
    } else {
      socket.emit('auth_fail');
    }
  });

  // Countdown Heartbeat
  setInterval(() => {
    const remaining = Math.max(0, 240000 - (Date.now() - lastAutoMsgTime));
    socket.emit('auto_msg_countdown', { remaining });
  }, 1000);

  socket.on('cmd', (cmd) => {
    if (socket.authenticated && bot) {
      bot.chat(cmd);
      console.log(`[Web Command Executed] ${cmd}`);
    }
  });

  socket.on('action', (action) => {
    if (!socket.authenticated || !bot) return;
    console.log(`[Web Action] ${action}`);
    switch (action) {
      case 'reconnect':
        bot.end();
        break;
      case 'joinSurvival':
        joinSurvival();
        break;
      case 'toggleAfk':
        isAfkEnabled = !isAfkEnabled;
        console.log(`[Bot] AFK Mode is now ${isAfkEnabled ? 'Enabled' : 'Disabled'}`);
        if (isAfkEnabled) randomMovement();
        break;
      case 'useItem':
        if (bot) {
          console.log('[Manual Action] Using held item (Right-Click)...');
          bot.activateItem();
        }
        break;
    }
  });

  socket.on('inv_action', (data) => {
    if (!socket.authenticated || !bot) return;
    console.log(`[Inventory Action] ${data.action} on slot ${data.slot}`);
    const item = bot.inventory.slots[data.slot];
    if (!item) return;

    switch (data.action) {
      case 'equip':
        bot.equip(item, 'hand').catch(err => console.log('Equip error:', err));
        break;
      case 'use':
        bot.equip(item, 'hand').then(() => {
          bot.consume().catch(() => bot.activateItem());
        }).catch(err => console.log('Use error:', err));
        break;
      case 'drop':
        bot.tossStack(item).catch(err => console.log('Drop error:', err));
        break;
      case 'drop1':
        bot.toss(item.type, null, 1).catch(err => console.log('Drop error:', err));
        break;
    }
  });
});

server.listen(PORT, () => {
  console.log(`[System] Admin Console running at http://localhost:${PORT}`);
});

function createBot() {
  console.log(`[Bot] Connecting to ${process.env.BOT_HOST || 'play.khushigaming.com'}:${process.env.BOT_PORT || 25565} as ${process.env.BOT_USERNAME || 'Sujal_bot'}...`);
  
  bot = mineflayer.createBot({
    host: process.env.BOT_HOST || 'play.khushigaming.com',
    port: parseInt(process.env.BOT_PORT) || 25565,
    username: process.env.BOT_USERNAME || 'Sujal_bot',
    version: process.env.BOT_VERSION || false,
    hideErrors: false // Ensure we see full error stacks
  });

  bot.loadPlugin(pathfinder);

  bot.on('message', (jsonMsg) => {
    // preserve § color codes for the web dashboard
    const msg = jsonMsg.toMotd();
    console.log('[Server] ' + msg);
    const clean = jsonMsg.toString();
    const lower = clean.toLowerCase();

    // Specific Registration Trigger (Prevents loop if already registered/logged)
    if ((lower.includes('/register') || lower.includes('register')) && !lower.includes('already')) {
      bot.chat('/register Bot@12345 Bot@12345');
    } else if ((lower.includes('/login') || lower.includes('login') || lower.includes('autenticar')) && !lower.includes('already')) {
      bot.chat('/login Bot@12345');
    }

    solveChatGames(clean);

    // Improved Chat Triggers with Self-Reply Guard
    const lowerClean = clean.toLowerCase();
    const botName = bot.username ? bot.username.toLowerCase() : '';
    
    // Ignore messages from the bot itself to prevent loops
    if (!botName || !lowerClean.startsWith(botName)) {
        if (lowerClean.endsWith('help')) {
            bot.chat('kya hua bhai');
        } else if (lowerClean.endsWith('ping')) {
            bot.chat('pong');
        } else if (lowerClean.endsWith('bot')) {
            bot.chat('I am an AFK bot created by Sujal_live for 24/7 server stability!');
        } else if (lowerClean.endsWith('sujal_bot')) {
            bot.chat('Developer: Sujal_live | Features: Auto-AFK, Auto-Inventory, Live Dashboard. Thanks for using it!');
        }

        // Specific trigger for Sujal_live
        if (lowerClean.includes('sujal_live') && lowerClean.includes('hello bot')) {
          bot.chat('ha bhai m jinda hu tere liye afk kar raha hu');
        }
    }
  });

  bot.on('health', () => {
    if (bot.food < 15) {
      const food = bot.inventory.items().find(i =>
        i.name.includes('apple') || i.name.includes('bread') ||
        i.name.includes('steak') || i.name.includes('cooked') ||
        i.name.includes('carrot') || i.name.includes('potato')
      );
      if (food) {
        console.log(`[Bot] Hungry (${bot.food})! Eating ${food.name}...`);
        bot.equip(food, 'hand').then(() => {
          bot.consume();
        }).catch(err => console.log('Error eating:', err));
      }
    }
  });

  let lastPosCheck = null;
  let stuckCounter = 0;
  setInterval(() => {
    if (bot.entity && isAfkEnabled) {
      if (lastPosCheck && bot.entity.position.distanceTo(lastPosCheck) < 0.1) {
        stuckCounter++;
        if (stuckCounter > 15) { // ~30s if interval is 2s
          console.log('[Bot] Bot seems stuck. Jumping...');
          bot.setControlState('jump', true);
          setTimeout(() => bot.setControlState('jump', false), 500);
          stuckCounter = 0;
        }
      } else {
        stuckCounter = 0;
      }
      lastPosCheck = bot.entity.position.clone();
    }
  }, 2000);

  bot.on('title', (title) => {
    const text = getText(title);
    if (typeof text === 'string' && text.trim()) console.log('[Server Title] ' + text);
  });
  bot.on('actionBar', (msg) => {
    const text = getText(msg);
    if (typeof text === 'string' && text.trim()) console.log('[Server Action Bar] ' + text);
  });
  bot.on('windowOpen', (win) => {
    console.log('[Server Window] Title: ' + win.title + ' ID: ' + win.id);
    sendInventory();
  });


  bot.on('whisper', (username, message) => {
    if (username === bot.username) return;
    console.log(`[Whisper] <${username}>: ${message}`);
    bot.whisper(username, `Hello ${username}, I got your message!`);
  });

  bot.once('spawn', () => {
    console.log('[Bot] Bot spawned successfully!');
    console.log('[Bot] Detected version: ' + bot.version);

    // Status update loop
    setInterval(() => {
      if (bot.entity) {
        io.sockets.sockets.forEach(s => {
          if (s.authenticated) {
            s.emit('status', {
              health: bot.health,
              food: bot.food,
              pos: bot.entity.position,
              isAfk: !bot.pathfinder.isMoving()
            });
          }
        });
      }
    }, 1000);

    // Inventory Sync Loop (Every 5 seconds)
    setInterval(() => {
      sendInventory();
    }, 5000);

    // Immediate initial sync
    setTimeout(() => {
      sendInventory();
      if (bot.entity) {
        io.to('authenticated').emit('status', {
          health: bot.health,
          food: bot.food,
          pos: bot.entity.position,
          isAfk: false
        });
      }
    }, 2000);

    setTimeout(() => {
      bot.chat('/login Bot@12345'); // Fallback login attempt
      setTimeout(() => {
        // Only trigger if not already navigating or in survival
        if (!isNavigating) joinSurvival();
      }, 10000); // Increased delay for server stability
    }, 4000);

    // Start simple auto-messenger
    startAutoMessenger();
  });

  bot.on('end', () => {
    console.log('[Bot] Bot disconnected. Reconnecting in 5 seconds...');
    setTimeout(createBot, 5000);
  });

  bot.on('error', err => {
    console.log('[Bot] Bot error:', err);
  });

  bot.on('kicked', reason => {
    console.log('[Bot] Bot was kicked:', JSON.stringify(reason));
  });

  bot.on('windowOpen', () => sendInventory());
  bot.on('inventoryEvent', () => sendInventory());
}

// --- Global Functions for Bot Control ---

function joinSurvival() {
  if (!bot || isNavigating) return;
  
  // Clear any existing timers to prevent duplicates
  if (distanceInterval) clearInterval(distanceInterval);
  if (retryTimeout) clearTimeout(retryTimeout);

  isNavigating = true;

  // Temporarily disable AFK movement so it doesn't fight the pathfinder
  const wasAfk = isAfkEnabled;
  isAfkEnabled = false;

  const nX = parseFloat(process.env.NPC_X) || 36;
  const nY = parseFloat(process.env.NPC_Y) || 106;
  const nZ = parseFloat(process.env.NPC_Z) || 15;

  console.log(`Checking distance to NPC at ${nX}, ${nY}, ${nZ}...`);
  if (bot.entity && bot.entity.position.distanceTo(new Vec3(nX, nY, nZ)) > 200) {
    console.log('[Nav] Bot is already far from lobby NPC. Assuming Survival.');
    isAfkEnabled = true;
    isNavigating = false;
    randomMovement();
    return;
  }

  const goal = new GoalNear(nX, nY, nZ, 2);

  // Stealth Movements: No digging, sprinting, or parkour in lobby
  const lobbyMovements = new Movements(bot);
  lobbyMovements.allowSprinting = false;
  lobbyMovements.allowParkour = false;
  lobbyMovements.canDig = false;

  bot.pathfinder.setMovements(lobbyMovements);
  bot.pathfinder.setGoal(goal);

  // Diagnostic Path Logging
  const onPathUpdate = (r) => {
    if (r.status === 'noPath') {
      console.log('[Nav] Pathfinder: No path found! Is there a wall? Trying a small jump/move...');
      bot.setControlState('jump', true);
      setTimeout(() => bot.setControlState('jump', false), 500);
    }
  };
  bot.on('path_update', onPathUpdate);

  // Periodic Distance Logging
  distanceInterval = setInterval(() => {
    if (bot.entity && bot.entity.position) {
      const pos = bot.entity.position;
      if (!isNaN(pos.x) && !isNaN(pos.y) && !isNaN(pos.z)) {
        const dist = pos.distanceTo(new Vec3(nX, nY, nZ));
        console.log(`[Nav] Distance to NPC: ${dist.toFixed(1)} blocks (Current: ${Math.round(pos.x)}, ${Math.round(pos.y)}, ${Math.round(pos.z)})`);
        if (dist < 3) clearInterval(distanceInterval);
      }
    }
  }, 5000);

  // No local declaration needed; using global retryTimeout

  bot.once('goal_reached', () => {
    console.log('[Bot] Arrived at NPC location. Stopping and waiting (Human Pause)...');
    bot.pathfinder.setGoal(null); // Stop pathfinder explicitly

    // Configurable Look Direction
    const lX = parseFloat(process.env.LOOK_X) || 36;
    const lY = parseFloat(process.env.LOOK_Y) || 107;
    const lZ = parseFloat(process.env.LOOK_Z) || 24;

    // Wait 2 seconds before interacting (Stealth)
    const interact = () => {
      console.log('[Interaction] Jumping and Interacting...');
      bot.setControlState('jump', true);
      setTimeout(() => bot.setControlState('jump', false), 200);

      bot.lookAt(new Vec3(lX, lY, lZ)).then(() => {
        const entities = Object.values(bot.entities);
        console.log(`[Interaction] Scanning ${entities.length} entities for NPC...`);
        
        // Log all entities within 15 blocks of the bot for debugging
        entities.forEach(e => {
          const dist = e.position.distanceTo(bot.entity.position);
          if (dist < 15) {
            console.log(`[Interaction] Nearby: ${e.username || e.displayName || 'Unnamed'} | Type: ${e.type} | Dist: ${dist.toFixed(1)} | Pos: ${e.position}`);
          }
        });

        const targetPos = new Vec3(nX, nY, nZ);
        let bestEntity = null;
        let minPlayerDist = 999;
        let minOtherDist = 999;

        entities.forEach(e => {
          if (e.id === bot.entity.id) return;
          const dist = e.position.distanceTo(targetPos);
          if (dist > 6) return; // Too far

          // Prioritize by name if possible
          if (e.username?.toLowerCase().includes('survival') || e.displayName?.toLowerCase().includes('survival')) {
            bestEntity = e;
            minPlayerDist = -1; // Force selection
            return;
          }

          if (e.type === 'player' && e.username !== bot.username && e.username !== 'Sujal_live') {
            if (dist < minPlayerDist) {
              minPlayerDist = dist;
              if (minOtherDist > -1) bestEntity = e;
            }
          } else if (e.type !== 'other' && dist < minOtherDist && minPlayerDist === 999) {
            minOtherDist = dist;
            bestEntity = e;
          }
        });

        const entity = bestEntity;

        if (entity) {
          console.log(`[Interaction] Interacting with NPC: ${entity.username || entity.displayName}`);
          bot.activateEntity(entity);
          setTimeout(() => bot.useOn(entity), 500);
        } else {
          console.log('[Interaction] No NPC found within 5 blocks of target. Trying manual use fallback...');
          bot.activateItem(); // Try right-clicking whatever is in hand
        }
      });
    };

    setTimeout(interact, 2000);

    retryTimeout = setTimeout(() => {
      // If 15s later we are still near the lobby spawn, retry
      if (bot.entity && bot.entity.position.distanceTo(new Vec3(nX, nY, nZ)) < 15) {
        console.log('[Nav] Still in lobby area. Retrying Join Survival...');
        console.log('[Nav] Still in lobby area. Retrying Join Survival...');
        bot.removeListener('path_update', onPathUpdate);
        if (distanceInterval) clearInterval(distanceInterval);
        isAfkEnabled = wasAfk;
        isNavigating = false; // Reset to allow retry
        joinSurvival();
      } else {
        console.log('[Bot] AFK bot online in Survival!');
        bot.removeListener('path_update', onPathUpdate);
        if (distanceInterval) clearInterval(distanceInterval);
        isAfkEnabled = true;
        isNavigating = false; // Successfully reached
        randomMovement();
      }
    }, 15000);
  });
}

function randomMovement() {
  if (!bot || !isAfkEnabled) return;

  const directions = ['forward', 'back', 'left', 'right'];
  const dir = directions[Math.floor(Math.random() * directions.length)];

  bot.setControlState(dir, true);
  setTimeout(() => {
    bot.setControlState(dir, false);
    if (bot && isAfkEnabled) setTimeout(randomMovement, 2000);
  }, 3000);
}

const SCRAB_WORDS = [
  'diamond', 'iron', 'gold', 'coal', 'obsidian', 'redstone', 'dirt', 'stone', 'wood', 'crafting',
  'furnace', 'anvil', 'beacon', 'torch', 'bucket', 'creeper', 'skeleton', 'enderman', 'zombie',
  'villager', 'guardian', 'spider', 'wolf', 'pig', 'cow', 'sheep', 'chicken', 'enderdragon',
  'survival', 'creative', 'adventure', 'hardcore', 'enchanting', 'brewing', 'smelting', 'mining',
  'building', 'sprinting', 'sneaking', 'nether', 'biome', 'desert', 'cavern', 'ravine', 'stronghold',
  'dungeon', 'fortress', 'village', 'ocean', 'server', 'lobby', 'spawn', 'chat', 'forum', 'reward',
  'player', 'admin', 'moderator', 'khushi', 'conquer', 'gaming', 'pickaxe', 'sword', 'shovel', 'armor',
  'helmet', 'chestplate', 'leggings', 'boots', 'apple', 'bread', 'steak', 'potato', 'carrot', 'president',
  'member', 'legendary', 'helper', 'builder', 'donator', 'vip', 'mvp', 'owner', 'staff', 'server',
  'bedrock', 'emerald', 'lapis', 'quartz', 'glowstone', 'tnt', 'flint', 'steel', 'elytra', 'firework',
  'shulker', 'trident', 'shield', 'totem', 'undying', 'crossbow', 'bamboo', 'scaffolding', 'honey',
  'piston', 'repeater', 'comparator', 'lever', 'button', 'pressure', 'plate', 'daylight', 'sensor'
];

function getAnagramMatch(scrambled) {
  const sorted = scrambled.toLowerCase().split('').sort().join('');
  return SCRAB_WORDS.find(word => word.toLowerCase().split('').sort().join('') === sorted);
}

function solveMath(equation) {
  try {
    // Handle 'x' as multiplication and remove any symbols like '?' or '='
    const clean = equation.toLowerCase().replace(/x/g, '*').replace(/[^0-9+\-*/().]/g, '');
    return eval(clean);
  } catch (e) {
    return null;
  }
}

function solveChatGames(msg) {
  if (!bot) return;
  const cleanMsg = msg.replace(/\n\s*\n/g, '\n').trim();
  const lower = cleanMsg.toLowerCase();

  // Updated regex: Handles No spaces, 'x' operator, and trailing symbols
  const mathMatch = cleanMsg.match(/(\d+)\s*([\+\-\*\/xX])\s*(\d+)/);
  if (mathMatch) {
    const result = solveMath(mathMatch[0]);
    if (result !== null) {
      console.log(`[ChatGame] Found math: ${mathMatch[0]} = ${result}`);
      setTimeout(() => bot.chat(result.toString()), 2000);
      return;
    }
  }

  if (lower.includes('word scramble') || lower.includes('unscramble')) {
    const lines = cleanMsg.split('\n');
    for (const line of lines) {
      const potentialWord = line.trim().replace(/[\[\]]/g, '');
      if (potentialWord.length >= 3 && /^[A-Z]+$/.test(potentialWord)) {
        const match = getAnagramMatch(potentialWord);
        if (match) {
          console.log(`[ChatGame] Found scramble: ${potentialWord} -> ${match}`);
          setTimeout(() => bot.chat(match), 2000);
          return;
        }
      }
    }
  }
}

function sendInventory() {
  if (!bot) return;
  // Send all slots from 0 to 45 (Classic Inventory + Armor + Crafting)
  const slots = bot.inventory.slots.map((item, index) => {
    if (!item) return { slot: index, isEmpty: true };
    return {
      name: item.name,
      displayName: item.displayName,
      count: item.count,
      slot: index,
      type: item.type
    };
  });
  io.sockets.sockets.forEach(s => {
    if (s.authenticated) s.emit('inventory', slots);
  });
}

function startAutoMessenger() {
  if (autoMsgTimer) clearInterval(autoMsgTimer);
  autoMsgTimer = setInterval(() => {
    if (bot && bot.entity) {
      const now = Date.now();
      const elapsed = now - lastAutoMsgTime;
      
      // If 4 minutes (240,000ms) have passed
      if (elapsed >= 240000) {
        const nX = parseFloat(process.env.NPC_X) || 36;
        const nY = parseFloat(process.env.NPC_Y) || 106;
        const nZ = parseFloat(process.env.NPC_Z) || 15;
        const distToLobby = bot.entity.position.distanceTo(new Vec3(nX, nY, nZ));
        
        // Only send if in survival (far from lobby NPC)
        if (distToLobby > 100) {
          bot.chat("This AFK bot is made up by Sujal_live");
          lastAutoMsgTime = now; // Reset timer ONLY after successful send
          console.log("[Auto-Msg] Loop: Message sent to survival chat.");
        }
      }
    }
  }, 1000); // Check every second for the perfect loop
}

function getText(obj) {
  if (!obj) return '';
  if (typeof obj === 'string') return obj;

  // Handle NBT-style { type: 'string', value: '...' }
  if (obj.type === 'string' && typeof obj.value === 'string') return String(obj.value);

  let text = '';
  if (typeof obj.text === 'string') text += obj.text;

  // Handle NBT-style { type: 'list', value: [...], ... }
  if (Array.isArray(obj.value)) {
    text += obj.value.map(e => getText(e)).join('');
  }

  // Handle standard 'extra' array
  if (obj.extra) {
    if (Array.isArray(obj.extra)) {
      text += obj.extra.map(e => getText(e)).join('');
    } else {
      text += getText(obj.extra);
    }
  }

  // Handle nested objects in 'value'
  if (obj.value && typeof obj.value === 'object' && !Array.isArray(obj.value)) {
    text += getText(obj.value);
  }

  // Handle raw arrays
  if (Array.isArray(obj)) {
    text += obj.map(e => getText(e)).join('');
  }

  return String(text);
}

createBot();
