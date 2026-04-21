# 🚀 Render.com Deployment Guide

Follow these steps to host your Minecraft AFK bot 24/7 on Render.

---

### Step 1: Create a New Web Service
1.  Log in to [Render.com](https://render.com).
2.  Click **New +** and select **Web Service**.
3.  Connect your GitHub account and select the **Sujal_live_bot** repository.

### Step 2: Configure the Service
Set the following options in the Render dashboard:
- **Name**: `sujal-bot` (or any name you like)
- **Region**: Select the one closest to you (e.g., Singapore or Oregon).
- **Runtime**: `Node`
- **Build Command**: `npm install`
- **Start Command**: `npm start`

### Step 3: Add Environment Variables
This is the most important step! Under the **Environment** tab, click **Add Environment Variable** and add everything from your local `.env` file:

| Key | Value (Example) |
| :--- | :--- |
| `BOT_HOST` | `play.khushigaming.com` |
| `BOT_PORT` | `1241` |
| `BOT_USERNAME` | `Sujal_bot` |
| `ADMIN_PASS` | `YourSecretPassword` |
| `PORT` | `10000` (Render's default internal port) |

### Step 4: Deploy & Verify
1.  Click **Create Web Service**.
2.  Watch the **Logs**. Once you see `[System] Admin Console running at http://localhost:10000`, the bot is online!
3.  You can access your dashboard using the URL provided by Render (e.g., `https://sujal-bot.onrender.com`).

---

### ⚠️ Pro-Tip for 24/7 AFK
If you are using the **Free Tier**, Render will "sleep" the bot if you don't visit the dashboard for 15 minutes. 
- **To keep it awake**: Use a free service like [Cron-job.org](https://cron-job.org) to ping your dashboard URL every 10 minutes. This will keep the bot online infinitely!
