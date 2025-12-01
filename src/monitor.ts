import { chromium, Browser, Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import 'dotenv/config';

// Load configuration
const CONFIG_PATH = path.join(process.cwd(), 'config.json');
const CONFIG = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
const STATUS_FILE = path.join(process.cwd(), 'last-status.json');
const AUTH_FILE = path.join(process.cwd(), 'auth.json');

interface CourseStatus {
    [crn: string]: {
        name: string;
        status: string;
    };
}

async function main() {
    console.log('Starting ClassWatch (Shopping Cart Mode)...');

    const browser = await chromium.launch({ headless: false }); // Keep false for now to see it work

    // Check for existing session
    let context;
    if (fs.existsSync(AUTH_FILE)) {
        console.log('Found existing session file. Attempting to restore...');
        context = await browser.newContext({
            viewport: { width: 1280, height: 720 },
            storageState: AUTH_FILE
        });
    } else {
        console.log('No session file found. Starting fresh session.');
        context = await browser.newContext({
            viewport: { width: 1280, height: 720 }
        });
    }

    const page = await context.newPage();

    try {
        await loginAndNavigate(page, context);

        // Check all courses in the cart
        const currentStatus = await checkShoppingCart(page);

        // Compare and notify
        await processStatus(currentStatus);

    } catch (error) {
        console.error('Error during execution:', error);
        await page.screenshot({ path: `screenshots/error-${Date.now()}.png` });
    } finally {
        console.log('Closing browser...');
        await browser.close();
    }
}

async function loginAndNavigate(page: Page, context: any) {
    console.log('Logging in...');
    const username = process.env.PORTAL_USERNAME || 'UNDEFINED';
    console.log(`Using FSUID: ${username}`);

    if (username === 'your_netid' || username === 'UNDEFINED') {
        throw new Error('❌ STOP! You are still using the default "your_netid". Please edit the .env file with your real FSUID.');
    }

    await page.goto(CONFIG.portalUrl);

    // Handle potential intermediate "FSU Central Authentication" link for resumed sessions
    try {
        const authLink = page.getByRole('link', { name: 'FSU Central Authentication' });
        if (await authLink.isVisible({ timeout: 3000 })) {
            console.log('Clicking "FSU Central Authentication" link...');
            await authLink.click();
        }
    } catch (e) {
        // Ignore if not found
    }

    // Check if we are already logged in
    // If we see "Student Central" link, we are good.
    try {
        await page.getByRole('link', { name: 'Student Central' }).waitFor({ timeout: 15000 });
        console.log('✅ Session restored! Skipping login.');

        // Refresh session file just in case
        await context.storageState({ path: AUTH_FILE });

        // Proceed to navigation
        await navigateToCart(page);
        return;
    } catch (e) {
        console.log('Session expired or invalid. Proceeding with full login.');
    }

    await page.getByRole('textbox', { name: 'FSUID' }).click();
    await page.getByRole('textbox', { name: 'FSUID' }).fill(process.env.PORTAL_USERNAME || '');

    await page.getByRole('textbox', { name: 'Password' }).click();
    await page.getByRole('textbox', { name: 'Password' }).fill(process.env.PORTAL_PASSWORD || '');

    await page.getByRole('button', { name: 'Sign In' }).click();

    // 3. Handle Duo/Device Confirmation
    // This can take a while because the user has to approve on their phone.
    console.log('Waiting for 2FA approval and "Is this your device?" prompt...');
    try {
        // Wait up to 30 seconds for the prompt
        await page.getByRole('heading', { name: 'Is this your device?', exact: false }).waitFor({ timeout: 30000 });
        console.log('Found "Is this your device?" prompt. Clicking "Yes"...');
        await page.getByRole('button', { name: 'Yes, this is my device' }).click();
    } catch (e) {
        // If it times out, maybe we skipped it or are already logged in.
        console.log('Device confirmation prompt did not appear within 30s. Checking for dashboard...');
    }

    // Save session after successful login
    console.log('Login successful. Saving session state...');
    await context.storageState({ path: AUTH_FILE });

    await navigateToCart(page);
}

async function navigateToCart(page: Page) {

    console.log('Navigating to Add Classes...');
    await page.getByRole('link', { name: 'Student Central' }).click();
    await page.getByRole('link', { name: 'My Classes' }).click();
    await page.getByRole('link', { name: 'Enrollment: Add Classes' }).click();

    console.log(`Selecting term: ${CONFIG.term}`);
    const mainFrame = page.frameLocator('iframe[title="Main Content"]');

    // The radio button has an accessible name like "Select a term... Select 2026 Spring"
    // So we can just match the term name in the radio's name.
    await mainFrame.getByRole('radio', { name: new RegExp(CONFIG.term, 'i') }).check();

    await mainFrame.getByRole('button', { name: 'Continue' }).click();

    await page.waitForTimeout(5000); // Wait for cart to load
}

async function checkShoppingCart(page: Page): Promise<CourseStatus> {
    console.log('Scanning Shopping Cart...');
    const status: CourseStatus = {};
    const mainFrame = page.frameLocator('iframe[title="Main Content"]');

    // Dump HTML for debugging (Absolute path to be safe)
    const debugPath = path.join(process.cwd(), 'debug-page.html');
    // const html = await mainFrame.locator('body').innerHTML();
    // fs.writeFileSync(debugPath, html);
    // console.log(`Saved page HTML to ${debugPath}`);

    // Strategy based on debug-page.html:
    // 1. The Shopping Cart is in a div with class "shopping-cart".
    // 2. The table inside it has class "PSLEVEL1GRID".
    // 3. The rows have IDs starting with "trSSR_REGFORM_VW".
    // 4. Status is in a span with class "sr-only" (e.g., "Closed") OR FontAwesome icon.

    const cartContainer = mainFrame.locator('div.shopping-cart');

    // Ensure we are looking at the right table
    const rows = await cartContainer.locator('tr[id^="trSSR_REGFORM_VW"]').all();

    console.log(`Found ${rows.length} course rows in the Shopping Cart.`);

    for (const row of rows) {
        try {
            const text = await row.textContent();
            if (!text) continue;

            // Extract CRN from format like "CNT 4406-0001 (1679)"
            const crnMatch = text.match(/\((\d{4,5})\)/);
            if (!crnMatch) continue;

            const crn = crnMatch[1];

            // Extract Status
            // The debug HTML shows: <span class="sr-only" id="...">Closed</span>
            // It also shows icons: <span class="fa fa-times-circle-o danger"></span>

            let courseStatus = 'Unknown';

            // Try to find the hidden text first (most reliable)
            const statusSpan = row.locator('.sr-only').filter({ hasText: /Open|Closed|Wait/i }).first();
            if (await statusSpan.count() > 0) {
                const statusText = await statusSpan.textContent();
                if (statusText?.match(/Open/i)) courseStatus = 'Open';
                else if (statusText?.match(/Closed/i)) courseStatus = 'Closed';
                else if (statusText?.match(/Wait/i)) courseStatus = 'Waitlist';
            }

            // Fallback: Check for specific icon classes
            if (courseStatus === 'Unknown') {
                if (await row.locator('.fa-check-circle-o').count() > 0) courseStatus = 'Open';
                else if (await row.locator('.fa-times-circle-o').count() > 0) courseStatus = 'Closed';
                else if (await row.locator('.fa-square').count() > 0) courseStatus = 'Waitlist'; // Guessing for waitlist
            }

            // Extract Name
            const nameMatch = text.match(/[A-Z]{3}\s+\d{4}[-\w]*/);
            const name = nameMatch ? nameMatch[0] : 'Unknown Course';

            status[crn] = {
                name: name,
                status: courseStatus
            };
            console.log(`Found in Cart: ${name} (${crn}) - ${courseStatus}`);

        } catch (e) {
            console.error('Error parsing row:', e);
        }
    }

    return status;
}

async function processStatus(current: CourseStatus) {
    let previous: CourseStatus = {};
    const exists = fs.existsSync(STATUS_FILE);
    if (exists) {
        previous = JSON.parse(fs.readFileSync(STATUS_FILE, 'utf-8'));
    }

    for (const [crn, data] of Object.entries(current)) {
        const oldData = previous[crn];
        const oldStatus = oldData ? oldData.status : null;
        const newStatus = data.status;

        if (newStatus === 'Unknown') continue;

        // ONLY notify on transition (change)
        // We explicitly check if oldStatus exists (not first run) and is different
        if (oldStatus && oldStatus !== newStatus) {
            const msg = `Update: ${data.name} (${crn}) changed from ${oldStatus} to ${newStatus}`;
            console.log(msg);

            if (newStatus === 'Open') {
                await sendNotifications(`🎉 ${msg} - GO REGISTER!`);
            }
        } else if (!oldStatus) {
            console.log(`Initial check for ${data.name} (${crn}): ${newStatus}`);
        }
    }

    fs.writeFileSync(STATUS_FILE, JSON.stringify(current, null, 2));
}

async function sendNotifications(message: string) {
    if (CONFIG.notification.email.enabled && process.env.RESEND_API_KEY) {
        console.log('Sending email...');
        try {
            await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    from: CONFIG.notification.email.from,
                    to: CONFIG.notification.email.to,
                    subject: 'ClassWatch Alert',
                    text: message,
                }),
            });
        } catch (e) {
            console.error('Failed to send email', e);
        }
    }
}

main().catch(console.error);
