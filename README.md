# 🤖 SUJAL_LIVE Assistant – Premium Minecraft AFK Bot & Dashboard

A professional-grade, lightweight **Minecraft AFK bot** and **Remote Management Dashboard** built with [mineflayer](https://github.com/PrismarineJS/mineflayer). Designed for 24/7 server stability, promotional broadcasting, and high-fidelity remote monitoring.

---

### 🌟 Premium Features

#### 📦 High-Fidelity Dashboard
- **Pixel-Accurate UI**: A classic Minecraft inventory layout with Armor slots, Crafting grid, Off-hand, and Hotbar.
- **🎨 MOTD Color Support**: Real-time console rendering of Minecraft color codes (`§a`, `§c`, etc.) and modern **Hex Color Gradients**.
- **⏲️ Live Promo Countdown**: Visual real-time timer (MM:SS) showing exactly when the next promotional message will be sent.
- **Remote Interaction**: Full control over inventory (Equip, Consume, Drop) directly from your mobile or desktop browser.

#### 🧠 Advanced Automation
- **🚀 Reliable Auto-Responder**: Detects and responds to chat triggers (`help`, `ping`, `bot`) using a deep packet processor that bypasses server chat plugins.
- **Lobby Escape**: Automated NPC navigation and "Use Held Item" manual fallback to ensure you reach the survival world every time.
- **Chat Game Solver**: Automatically detects and answers Math equations and Word Scrambles in milliseconds.
- **Anti-Stuck Logic**: Intelligent movement and jump-triggers to prevent server kicks for inactivity.

#### 🔒 Enterprise Stability
- **Auto-Reconnect**: 24/7 uptime with automated session recovery and error handling.
- **Dashboard Auth**: Password-protected web console (`ADMIN_PASS`) to keep your controls private.
- **Environment Security**: All credentials stored in `.env` for zero-risk repository management.

---

### 🌐 Bot Configuration

| Setting | Environment Variable | Default / Example |
| :--- | :--- | :--- |
| **Host** | `BOT_HOST` | `play.khushigaming.com` |
| **Port** | `BOT_PORT` | `1241` |
| **Username**| `BOT_USERNAME` | `Sujal_bot` |
| **Admin UI** | `ADMIN_PASS` | `Sujal@8905` |
| **Web Port** | `PORT` | `4000` |

---

### 💬 Live Chat Triggers

The bot actively listens to the public chat and responds to anyone typing:
- **`help`** – ➔ "kya hua bhai"
- **`ping`** – ➔ "pong"
- **`bot`** – ➔ General creator information.
- **`sujal_bot`** – ➔ Detailed project & developer credits.

---

### 🔧 Installation Guide

1. **Clone the Project**
   ```bash
   git clone https://github.com/d66027016-art/Sujal_live_bot.git
   cd Sujal_live_bot
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Set Up Your Identity**
   Create a `.env` file in the root:
   ```env
   BOT_HOST=play.khushigaming.com
   BOT_PORT=1241
   BOT_USERNAME=Sujal_bot
   ADMIN_PASS=Sujal@8905   
   PORT=4000
   ```

4. **Initialize**
   ```bash
   node index.js
   ```

---

### 🧑‍💻 Author

Built with ❤️ by **Sujal_live**

---

### 📜 License

This project is open-source. Please **Give a ⭐** if this bot helps your AFK experience!
