# CourseReaper 🎓
**Automated University Course Registration Monitor**

CourseReaper is a high-performance automation tool designed to monitor university course availability in real-time. Built with **TypeScript** and **Playwright**, it continuously checks the status of courses in your shopping cart and sends instant notifications when a seat opens up, streamlining the registration process.

> **Note for Recruiters:** This project demonstrates proficiency in **Browser Automation**, **TypeScript**, **Asynchronous Programming**, and **System Design** for reliability (handling 2FA, session persistence, and dynamic DOM elements).

---

## 🚀 Features

*   **Shopping Cart Monitoring**: Automatically detects all courses in your shopping cart—no manual configuration needed.
*   **Smart Status Detection**: Uses advanced DOM scraping to identify "Open", "Closed", or "Waitlist" statuses, even when hidden behind icons or accessibility tags.
*   **Instant Notifications**: Integrates with **Resend** to send email alerts the moment a class opens.
*   **Robust Authentication**: Handles FSU's complex login flow, including **Two-Factor Authentication (2FA)** and session persistence to minimize login prompts.
*   **Background Execution**: Runs silently in the background (headless mode) with configurable check intervals.

---

## 🛠️ Tech Stack

*   **Runtime**: Node.js
*   **Language**: TypeScript
*   **Automation**: Playwright (E2E Testing Framework)
*   **Notifications**: Resend API (Email)
*   **Configuration**: Dotenv & JSON

---

## 📋 Prerequisites

Before you begin, ensure you have the following installed:
1.  **Node.js** (Version 18 or higher) - [Download Here](https://nodejs.org/)
2.  **Git** - [Download Here](https://git-scm.com/)

---

## ⚙️ Setup Guide (For Non-Engineers)

### 1. Download the Project
Open your terminal (Command Prompt on Windows, Terminal on Mac) and run:
```bash
git clone https://github.com/yourusername/ClassWatch.git
cd ClassWatch
```

### 2. Install Dependencies
Install the necessary software libraries:
```bash
npm install
```

### 3. Create Configuration Files
You need to set up your credentials and settings.

**A. Environment Variables (`.env`)**
1.  Duplicate the `.env.example` file and rename it to `.env`.
2.  Open `.env` in a text editor (like Notepad or TextEdit) and fill in your details:
    ```env
    PORTAL_USERNAME=your_fsuid
    PORTAL_PASSWORD=your_password
    RESEND_API_KEY=re_12345... (Get this from resend.com)
    ```

**B. App Configuration (`config.json`)**
1.  Open `config.json`.
2.  Update the `term` (e.g., "2026 Spring") and your email address:
    ```json
    "notification": {
        "email": {
            "enabled": true,
            "from": "onboarding@resend.dev",
            "to": ["your_email@gmail.com"]
        }
    }
    ```

---

## ▶️ How to Run

### Start Monitoring
**Default (Background Mode):**
Runs silently in the background. Perfect for long-term monitoring.
```bash
npx tsx src/monitor.ts
```

**Visible Mode (For Debugging):**
Opens the browser window so you can see what it's doing. Useful for the first login (to handle 2FA) or debugging issues.
```bash
npx tsx src/monitor.ts --visible
```

*   **First Run**: It is recommended to run in **Visible Mode** first to approve the 2FA prompt on your phone.
*   **Subsequent Runs**: Use the default command to run silently.

### Stop Monitoring
To stop the program, press `Ctrl + C` in your terminal.

---

## 🔍 How It Works (Technical Deep Dive)

1.  **Session Management**: The script saves browser storage state (`auth.json`) to reuse cookies, bypassing 2FA on subsequent runs.
2.  **DOM Traversal**: It targets the specific "Shopping Cart" container using robust selectors (e.g., filtering by CRN pattern `(XXXX)`) to avoid false positives from other tables like "Enrolled Classes".
3.  **State Tracking**: It maintains a local state file (`last-status.json`) to compare the current status vs. the previous run. Notifications are **only** triggered on a state change (e.g., Closed → Open).

---

## 🛡️ Disclaimer
This tool is for educational purposes and personal use only. Please use responsibly and adhere to your university's acceptable use policy regarding automated scripts.
