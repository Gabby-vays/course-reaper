import { chromium, Browser, Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import 'dotenv/config';

// Load configuration
const CONFIG_PATH = path.join(process.cwd(), 'config.json');
const CONFIG = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
const STATUS_FILE = path.join(process.cwd(), 'last-status.json');

interface CourseStatus {
    [crn: string]: {
        name: string;
        status: string;
    };
}

async function main() {
    console.log('Starting ClassWatch (Shopping Cart Mode)...');

    const browser = await chromium.launch({ headless: false }); // Keep false for now to see it work
    const context = await browser.newContext({
        viewport: { width: 1280, height: 720 }
    });
    const page = await context.newPage();

    try {
        await loginAndNavigate(page);

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

async function loginAndNavigate(page: Page) {
    console.log('Logging in...');
    const username = process.env.PORTAL_USERNAME || 'UNDEFINED';
    console.log(`Using FSUID: ${username}`);

    if (username === 'your_netid' || username === 'UNDEFINED') {
        throw new Error('❌ STOP! You are still using the default "your_netid". Please edit the .env file with your real FSUID.');
    }

    await page.goto(CONFIG.portalUrl);

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

    // Target the specific "Shopping Cart" table
    // Based on screenshot, it has a header "2026 Spring Shopping Cart"
    // We'll look for the table that contains this text in its header or caption

    // Find the container for the cart
    // The screenshot shows a box with title "2026 Spring Shopping Cart"
    // We'll look for a grid/table inside a container with that text

    // Let's try to find all rows in the table that has "Shopping Cart" in the title
    // This is safer than just "tr" which picks up the "Add to Cart" box

    // Find the header first
    const cartHeader = mainFrame.getByText(/Shopping Cart/i).last(); // "2026 Spring Shopping Cart"

    // Find the table associated with this header. 
    // Usually in PeopleSoft, the header is above the grid.
    // We'll look for the nearest table or grid.

    // Let's try a more specific row selector based on the columns we see: "Delete", "Class", "Days/Times"
    // Any row that has a "Delete" button is likely a course row in the cart.

    const rows = await mainFrame.locator('tr').filter({ has: mainFrame.getByRole('button', { name: 'Delete' }) }).all();

    console.log(`Found ${rows.length} course rows in the cart.`);

    for (const row of rows) {
        try {
            const text = await row.textContent();
            if (!text) continue;

            // Extract CRN from format like "CNT 4406-0001 (1679)"
            // Regex: look for 4-5 digits inside parentheses
            const crnMatch = text.match(/\((\d{4,5})\)/);
            if (!crnMatch) continue;

            const crn = crnMatch[1];

            // Extract Status
            // Look for the status icon image in this row
            // It usually has alt text "Open", "Closed", or "Wait List"
            let courseStatus = 'Unknown';

            const images = await row.locator('img').all();
            for (const img of images) {
                const alt = await img.getAttribute('alt');
                if (alt) {
                    if (alt.match(/Open/i)) courseStatus = 'Open';
                    else if (alt.match(/Closed/i)) courseStatus = 'Closed';
                    else if (alt.match(/Wait/i)) courseStatus = 'Waitlist';
                }
            }

            // Extract Name (Class code)
            // "CNT 4406-0001 (1679)"
            // We'll grab the text from the "Class" column (usually 2nd column)
            // Or just grab the text that looks like a course code
            const nameMatch = text.match(/[A-Z]{3}\s+\d{4}[-\w]*/);
            const name = nameMatch ? nameMatch[0] : 'Unknown Course';

            status[crn] = {
                name: name,
                status: courseStatus
            };
            console.log(`Found: ${name} (${crn}) - ${courseStatus}`);

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
        const oldStatus = oldData ? oldData.status : null; // null means never checked
        const newStatus = data.status;

        // Notify if:
        // 1. Status changed (and is not Unknown)
        // 2. OR it's the first time we see it AND it's Open (User request)

        if (newStatus === 'Unknown') continue;

        if (oldStatus !== newStatus) {
            const msg = `Update: ${data.name} (${crn}) is now ${newStatus}`;
            console.log(msg);

            if (newStatus === 'Open') {
                await sendNotifications(`🎉 ${msg} - GO REGISTER!`);
            }
        } else if (!oldStatus && newStatus === 'Open') {
            // First run (or new course added) and it's ALREADY Open
            const msg = `Found Open Class: ${data.name} (${crn}) is currently Open!`;
            console.log(msg);
            await sendNotifications(`🎉 ${msg} - GO REGISTER!`);
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
