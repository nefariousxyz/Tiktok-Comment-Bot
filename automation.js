
const { execSync } = require('child_process');
const inquirer = require('inquirer');
const puppeteer = require('puppeteer');
const fs = require('fs');

// Log file to keep track of posted comments
const logFile = 'comment_log.txt';

// Function to log results
function logResults(deviceId, account, comment) {
    fs.appendFileSync(logFile, `Device: ${deviceId}, Account: ${account}, Comment: ${comment}\n`);
}

// Get connected devices
const getDevices = () => {
    return execSync('adb devices').toString().split('\n').slice(1, -2).map(line => line.split('\t')[0]);
};

// Get comments from a file or list
const getComments = () => {
    return ['First comment', 'Second comment', 'Third comment'];
};

// Function to select devices, accounts, and toggle CAPTCHA handling
const selectOptions = async (devices) => {
    const answers = await inquirer.prompt([
        {
            type: 'list',
            name: 'device',
            message: 'Select device:',
            choices: devices
        },
        {
            type: 'input',
            name: 'account',
            message: 'Enter the account index to switch to:',
            default: 1
        },
        {
            type: 'confirm',
            name: 'useCaptcha',
            message: 'Do you want to enable CAPTCHA handling?',
            default: false
        }
    ]);
    return answers;
};

// Function to switch TikTok accounts
const switchAccount = (deviceId, accountIndex) => {
    console.log(`Switching to account ${accountIndex} on device ${deviceId}...`);
    execSync(`adb -s ${deviceId} shell input tap <profile_icon_x> <profile_icon_y>`);
    execSync(`adb -s ${deviceId} shell input tap <switch_account_x> <switch_account_y>`);
    execSync(`adb -s ${deviceId} shell input tap <account_${accountIndex}_x> <account_${accountIndex}_y>`);
};

// Function to post comments
const postComment = (deviceId, comment) => {
    console.log(`Posting comment: ${comment} on device: ${deviceId}`);
    execSync(`adb -s ${deviceId} shell input text "${comment}"`);
    execSync(`adb -s ${deviceId} shell input tap <submit_button_x> <submit_button_y>`);
    console.log(`Comment posted: ${comment}`);
};

// Function to handle CAPTCHA (optional)
const handleCaptcha = async (deviceId) => {
    console.log(`Handling CAPTCHA on device: ${deviceId}`);
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto('https://www.google.com/recaptcha/api2/demo'); // Example CAPTCHA page
    
    // Add CAPTCHA solving logic here or leave for manual resolution.
    
    await browser.close();
};

// Function to setup proxy for a specific device using DataImpulse
const setProxy = (deviceId, proxy) => {
    console.log(`Setting up proxy on device: ${deviceId}`);
    execSync(`adb -s ${deviceId} shell settings put global http_proxy ${proxy}`);
    console.log(`Proxy set for device: ${deviceId}`);
};

// Main function to automate comment posting and account switching
const main = async () => {
    const devices = getDevices();
    
    if (devices.length === 0) {
        console.log('No devices connected.');
        return;
    }

    const proxy = 'http://204dcb67a023fc59ba0f__cr.ph:4695657cc1e26604@gw.dataimpulse.com:823'; // DataImpulse Proxy

    const comments = getComments();

    for (const comment of comments) {
        const { device, account, useCaptcha } = await selectOptions(devices);

        try {
            // Set proxy for each device
            setProxy(device, proxy);

            // Switch account on the device
            switchAccount(device, account);

            // Post a comment
            postComment(device, comment);
            logResults(device, account, comment);

            // Handle CAPTCHA if enabled
            if (useCaptcha) {
                await handleCaptcha(device);
            }

        } catch (error) {
            console.error(`Error on device ${device}:`, error.message);
        }
    }
};

// Start the main automation
main();
        