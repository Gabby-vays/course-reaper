Perfect — let’s get you and Gabby from zero to a working repo in the next 30–60 minutes.  
Here’s the exact “copy-paste → run → win” getting-started sequence (Playwright + TypeScript + email + Twilio ready).

### 1. Create the repo & initial structure (2 minutes)

```bash
# On your laptop or Gabby’s
mkdir classwatch && cd classwatch
git init
npm init -y

# Install everything we need
npm install -D typescript tsx @playwright/test @types/node
npm install dotenv   # for secrets

# Playwright itself
npx playwright install --with-deps

# Create the folders and files
mkdir src screenshots playwright-report
touch src/monitor.ts config.example.json .env.example .gitignore playwright.config.ts
```

Add this to `.gitignore` right now:
```
node_modules
.env
playwright/.cache
screenshots/*
playwright-report/*
.DS_Store
```

### 2. One-command project setup (copy-paste this)

```bash
cat > tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["es2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  }
}
EOF

cat > playwright.config.ts << 'EOF'
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  retries: 2,
  reporter: [['html', { open: 'never' }]],
  use: {
    headless: true,
    viewport: { width: 1280, height: 720 },
    actionTimeout: 20_000,
    video: 'retain-on-failure',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
});
EOF
```

### 3. Create the config & secrets files

`config.example.json`
```json
{
  "portalUrl": "https://your-university-portal.edu",
  "term": "Spring 2026",
  "coursesToWatch": [
    { "crn": "12345", "name": "Advanced Algorithms" },
    { "crn": "67890", "name": "Machine Learning" }
  ],
  "checkIntervalMinutes": 10,
  "notification": {
    "email": {
      "enabled": true,
      "from": "classwatch@example.com",
      "to": ["gabby@gmail.com", "you@gmail.com"]
    },
    "twilio": {
      "enabled": true
    }
  }
}
```

`.env.example`
```
PORTAL_USERNAME=your_netid
PORTAL_PASSWORD=supersecret

# Resend.com (free tier)
RESEND_API_KEY=re_1234567890abcdef

# Twilio (you’ll create this in 2 min)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_FROM_NUMBER=+15551234567
TWILIO_TO_NUMBER=+15559876543
```

→ Later just `cp config.example.json config.json` and `cp .env.example .env` and fill them in.

### 4. Record the real flow (this is the magic 10-minute part)

```bash
npx playwright codegen https://your-university-portal.edu
```

Do exactly this (in order):
1. Log in
2. Navigate to class search / registration / shopping cart
3. Search for Spring 2026 (or whatever the term is called)
4. Make sure the table with CRNs and the “Open / Closed / Waitlist” column is visible
5. Click one or two rows so Playwright learns the row selector pattern
6. Refresh the page once so it records waiting for the table to reload

When you’re done → copy the generated code and let me clean it up for you in the next message (or paste it here and I’ll turn it into beautiful reusable TypeScript in 30 seconds).

### 5. Quick-and-dirty working monitor.ts (you can run this TODAY)

`src/monitor.ts`
```ts
import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import 'dotenv/config';
import { config } from 'dotenv';
config();

const CONFIG = JSON.parse(fs.readFileSync('config.json', 'utf-8'));
const STATUS_FILE = path.join(process.cwd(), 'last-status.json');

interface Status { [crn: string]: string }

async function main() {
  const browser = await chromium.launch({ headless: false }); // change to true later
  const page = await browser.newPage();

  // === YOUR RECORDED STEPS WILL GO HERE (I’ll paste the cleaned version next) ===
  console.log("Waiting for you to paste the cleaned login + navigation code here");

  // Example placeholder — we’ll replace this
  await page.goto(CONFIG.portalUrl);
  await page.waitForTimeout(30000); // give you time to log in manually the first time

  // Find all rows and extract status
  const current: Status = {};
  for (const course of CONFIG.coursesToWatch) {
    const status = await page.locator(`text=${course.crn}`).locator('..').locator('text=/Open|Closed|Waitlist/i').first().textContent();
    current[course.crn] = status?.trim() || 'Unknown';
    console.log(`${course.name} (${course.crn}) → ${current[course.crn]}`);
  }

  // Load previous status and compare
  let previous: Status = {};
  if (fs.existsSync(STATUS_FILE)) {
    previous = JSON.parse(fs.readFileSync(STATUS_FILE, 'utf-8'));
  }

  for (const course of CONFIG.coursesToWatch) {
    const oldStatus = previous[course.crn] || 'Never checked';
    const newStatus = current[course.crn];
    if (oldStatus !== newStatus && newStatus.includes('Open')) {
      const msg = `🎉 ${course.name} (${course.crn}) is now ${newStatus}! Register NOW!`;
      console.log(msg);
      await sendNotifications(msg);
    }
  }

  // Save new status
  fs.writeFileSync(STATUS_FILE, JSON.stringify(current, null, 2));
  await browser.close();
}

async function sendNotifications(message: string) {
  if (CONFIG.notification.email.enabled) {
    // Resend example
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: CONFIG.notification.email.from,
        to: CONFIG.notification.email.to,
        subject: 'ClassWatch: Class Opened!',
        text: message,
      }),
    });
  }

  if (CONFIG.notification.twilio.enabled) {
    const twilioBody = new URLSearchParams({
      To: process.env.TWILIO_TO_NUMBER!,
      From: process.env.TWILIO_FROM_NUMBER!,
      Body: message,
    });

    await fetch(`https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: twilioBody,
    });
  }
}

main().catch(console.error);
```

Run it once with `npx tsx src/monitor.ts` (headless: false) — it will open a real browser so you can watch it work the first time.

### Next step (literally right now)
1. Run the codegen command above
2. Do the full login → shopping cart flow
3. Paste the giant block of code it spits out here

I’ll turn it into the clean, reusable, config-driven version in <2 minutes and you’ll have a working project tonight.

You’re 15 minutes away from something that already looks better than 95% of senior projects. Let’s do this! 🚀