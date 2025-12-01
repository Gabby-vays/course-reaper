<div align="center">
  <img src="https://github.com/user-attachments/assets/6790f4be-6de8-4599-94a2-830aa6be6a73" alt="CourseReaper Logo" width="120" />

  # CourseReaper 🎓

  **Secure your schedule. Automated real-time course monitoring.**

  [![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
  [![Playwright](https://img.shields.io/badge/Playwright-45ba4b?style=for-the-badge&logo=Playwright&logoColor=white)](https://playwright.dev/)
  [![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
  [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)

</div>

---

## 🚀 Overview
**CourseReaper** is a high-performance automation tool designed to monitor university course availability in real-time. Built with **TypeScript** and **Playwright**, it continuously checks your shopping cart and sends instant notifications when a seat opens up.

> **Tech Stack:** Browser Automation • TypeScript • Asynchronous Systems • 2FA Handling

## ✨ Features
*   **🛒 Smart Monitoring**: Auto-detects courses in your shopping cart.
*   **🕵️ Deep Scraping**: Parses hidden status tags and icons (Open/Closed/Waitlist).
*   **⚡ Instant Alerts**: Zero-latency email notifications via Resend.
*   **🔐 Robust Auth**: Handles 2FA and persists sessions to minimize login prompts.
*   **👻 Background Mode**: Runs silently with headless execution.

## 🛠️ Quick Start

### 1. Install
```bash
git clone https://github.com/Gabby-vays/course-reaper.git
cd course-reaper
npm install
```

### 2. Configure
Create a `.env` file:
```env
PORTAL_USERNAME=your_fsuid
PORTAL_PASSWORD=your_password
RESEND_API_KEY=re_12345...
```

Update `config.json` with your term and email.

### 3. Run
**Background Mode (Default):**
```bash
npx tsx src/monitor.ts
```

**Visible Mode (Debug/First Run):**
```bash
npx tsx src/monitor.ts --visible
```

## 🔍 Architecture
1.  **Session Persistence**: Saves `auth.json` to bypass repeated 2FA.
2.  **DOM Strategy**: Targets specific cart containers to avoid false positives.
3.  **State Diffing**: Compares `last-status.json` vs live data to trigger alerts only on status *changes*.

---
<div align="center">
  <sub>Built for educational purposes. Use responsibly.</sub>
</div>
