const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { execSync } = require('child_process');
const fs = require('fs');

let logWindow;  // Variable for the log window
let shouldStop = false;  // A flag to track if the automation should stop

// Coordinates for buttons and actions
const PROFILE_BUTTON_X = 975;
const PROFILE_BUTTON_Y = 2029;
const PROFILE_NAME_BUTTON_X = 540;  // Replace with actual coordinates for the profile name button
const PROFILE_NAME_BUTTON_Y = 127;   // Replace with actual coordinates for the profile name button
const COMMENT_BUTTON_X = 1024;        // Coordinates for tapping the comment button
const COMMENT_BUTTON_Y = 1354;       // Coordinates for tapping the comment button
const SUBMIT_BUTTON_X = 1010;
const SUBMIT_BUTTON_Y = 1172;
const COMMENT_BOX_X = 414;
const COMMENT_BOX_Y = 2014;

// Account-specific coordinates
const accountCoordinates = {
    1: { x: 362, y: 1028 }, // Coordinates for account 1
    2: { x: 432, y: 1237 }, // Coordinates for account 2
    3: { x: 295, y: 1433 }, // Coordinates for account 3
    4: { x: 398, y: 1622 }, // Coordinates for account 4
    5: { x: 359, y: 1794 }, // Coordinates for account 5
    // 6: { x: 350, y: 450 }, // Coordinates for account 6
    // 7: { x: 400, y: 500 }  // Coordinates for account 7
};

// Function to add a delay
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Helper function to introduce a random delay between actions
const randomDelay = (min, max) => new Promise(resolve => setTimeout(resolve, Math.random() * (max - min) + min));

// Function to log results to both a file and the log window
function logResults(deviceId, account, comment) {
    const logFile = 'comment_log.txt';
    const logMessage = `Device: ${deviceId}, Account: ${account}, Comment: ${comment}`;
    fs.appendFileSync(logFile, logMessage + '\n');

    if (logWindow) {
        logWindow.webContents.send('log-message', logMessage);  // Send the log message to the log window
    }
}

// Get connected devices
const getDevices = () => {
    return execSync('adb devices').toString().split('\n').slice(1, -2).map(line => line.split('\t')[0]);
};

// Function to launch TikTok app
const launchTikTokApp = async (deviceId, packageName) => {
    const logMessage = `Launching TikTok app on device: ${deviceId}`;
    console.log(logMessage);
    execSync(`adb -s ${deviceId} shell monkey -p ${packageName} -c android.intent.category.LAUNCHER 1`);
    if (logWindow) logWindow.webContents.send('log-message', logMessage);
    await delay(5000); // Delay to ensure TikTok app is fully launched
};

// Function to close TikTok app
const closeTikTokApp = async (deviceId, packageName) => {
    const logMessage = `Closing TikTok app on device: ${deviceId}`;
    console.log(logMessage);
    execSync(`adb -s ${deviceId} shell am force-stop ${packageName}`);
    if (logWindow) logWindow.webContents.send('log-message', logMessage);
    await delay(2000); // Small delay after closing
};

// Function to switch TikTok accounts using account-specific coordinates
const switchAccount = async (deviceId, accountIndex, packageName) => {
    const coordinates = accountCoordinates[accountIndex];
    if (!coordinates) {
        const errorMessage = `No coordinates defined for account ${accountIndex}`;
        console.error(errorMessage);
        if (logWindow) logWindow.webContents.send('log-message', errorMessage);
        return;
    }

    // Launch TikTok app before switching accounts
    await launchTikTokApp(deviceId, packageName);

    // Tap the profile button after TikTok has fully loaded
    const logMessage = `Switching to account ${accountIndex} on device ${deviceId} using coordinates X: ${coordinates.x}, Y: ${coordinates.y}`;
    console.log(logMessage);
    execSync(`adb -s ${deviceId} shell input tap ${PROFILE_BUTTON_X} ${PROFILE_BUTTON_Y}`);
    await delay(2000); // Delay to allow the profile menu to load

    // Tap the profile name button to open account switch popup
    execSync(`adb -s ${deviceId} shell input tap ${PROFILE_NAME_BUTTON_X} ${PROFILE_NAME_BUTTON_Y}`);
    await delay(2000); // Delay for account popup to open

    // Tap the account name (coordinates)
    execSync(`adb -s ${deviceId} shell input tap ${coordinates.x} ${coordinates.y}`);
    if (logWindow) logWindow.webContents.send('log-message', logMessage);
    await delay(3000); // Delay to ensure account switching is completed

    // Close TikTok app after switching accounts
    await closeTikTokApp(deviceId, packageName);

    // Reopen TikTok app with a delay
    await delay(3000); // Delay before reopening the app
    await launchTikTokApp(deviceId, packageName);
};

// Function to open TikTok post URL
const openTikTokPost = async (deviceId, url) => {
    const logMessage = `Opening TikTok post: ${url} on device: ${deviceId}`;
    console.log(logMessage);
    execSync(`adb -s ${deviceId} shell am start -a android.intent.action.VIEW -d "${url}"`);
    if (logWindow) logWindow.webContents.send('log-message', logMessage);
    await delay(5000); // Delay to allow video to load
};

// Function to tap the comment button after visiting the target post
const tapCommentButton = async (deviceId) => {
    const logMessage = `Tapping comment button on device: ${deviceId}`;
    console.log(logMessage);
    execSync(`adb -s ${deviceId} shell input tap ${COMMENT_BUTTON_X} ${COMMENT_BUTTON_Y}`);
    if (logWindow) logWindow.webContents.send('log-message', logMessage);
    await delay(2000); // Delay to ensure comment box is opened
};

// Helper function to escape special characters for ADB input
function escapeForAdbInput(text) {
    return text
        .replace(/\\/g, '\\\\')  // Escape backslashes
        .replace(/"/g, '\\"')    // Escape double quotes
        .replace(/'/g, "\\'")    // Escape single quotes
        .replace(/`/g, "\\`")    // Escape backticks
        .replace(/([^\x00-\x7F])/g, '')  // Remove non-ASCII characters
        .replace(/\s+/g, ' ');  // Replace multiple spaces with a single space
}

// Helper function to simulate typing each character with random delays between keystrokes
const simulateTyping = async (deviceId, text) => {
    for (let char of text) {
        await new Promise(resolve => setTimeout(resolve, Math.random() * (300 - 100) + 100));  // Random delay between 100ms and 300ms
        execSync(`adb -s ${deviceId} shell input text "${char}"`);
    }
};

// Function to post comments by simulating human-like typing (word by word)
const postComment = async (deviceId, comment) => {
    const logMessage = `Posting comment: ${comment} on device: ${deviceId}`;
    console.log(logMessage);

    // Tap the comment box first
    execSync(`adb -s ${deviceId} shell input tap ${COMMENT_BOX_X} ${COMMENT_BOX_Y}`);

    // Escape and clean the comment for ADB input
    const escapedComment = escapeForAdbInput(comment);

    // Split the comment into words and type each word separately
    const words = escapedComment.split(" ");
    for (const word of words) {
        await simulateTyping(deviceId, word);  // Simulate typing each word
        execSync(`adb -s ${deviceId} shell input keyevent 62`); // Simulate pressing space after each word
    }

    // Add a small delay after typing to ensure the system is ready
    await new Promise(resolve => setTimeout(resolve, 2000));  // 2-second delay before attempting to tap the submit button

    // Tap the submit button to post the comment
    console.log(`Tapping the submit button at X: ${SUBMIT_BUTTON_X}, Y: ${SUBMIT_BUTTON_Y} on device: ${deviceId}`);
    execSync(`adb -s ${deviceId} shell input tap ${SUBMIT_BUTTON_X} ${SUBMIT_BUTTON_Y}`);
    
    if (logWindow) logWindow.webContents.send('log-message', logMessage);

    // Add a delay after submitting the comment to allow it to process
    await new Promise(resolve => setTimeout(resolve, 3000));  // 3-second delay to ensure comment is posted before navigating away
};

// Helper function to shuffle an array
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// Function to check if a package is installed on a device
const isPackageInstalled = (deviceId, packageName) => {
    try {
        // List installed packages and check if the packageName is listed
        const result = execSync(`adb -s ${deviceId} shell pm list packages`).toString();
        return result.includes(packageName);
    } catch (error) {
        console.error(`Error checking package installation for ${packageName} on device ${deviceId}:`, error.message);
        return false;
    }
};

// Function to shuffle proxies every 30 minutes
const shuffleProxies = (proxies, interval) => {
    setInterval(() => {
        console.log('Shuffling proxies...');
        proxies = shuffleArray(proxies);
    }, interval);
};

ipcMain.on('start-automation', async (event, { targetLinks, comments, accountIndex, captchaEnabled, appVersion, proxies }) => {
    try {
        shouldStop = false;  // Reset the stop flag at the beginning of automation
        console.log("Received targetLinks: ", targetLinks);
        console.log("Received comments: ", comments);
        console.log("Received accountIndex: ", accountIndex);  // Verify correct account index
        console.log("Received proxies: ", proxies);  // Verify proxies
        
        if (!Array.isArray(targetLinks) || targetLinks.length === 0) {
            throw new Error("Target links are not defined or empty.");
        }
        if (!Array.isArray(comments) || comments.length === 0) {
            throw new Error("Comments are not defined or empty.");
        }
        if (!Array.isArray(proxies) || proxies.length === 0) {
            throw new Error("Proxy list is empty.");
        }

        const devices = getDevices();

        if (devices.length === 0) {
            const errorMessage = 'No devices connected.';
            console.log(errorMessage);
            if (logWindow) logWindow.webContents.send('log-message', errorMessage);
            return;
        }

        // Shuffle proxies every 30 minutes
        shuffleProxies(proxies, 30 * 60 * 1000); // 30 minutes

        const packageName = appVersion === 'Global' ? 'com.zhiliaoapp.musically' : 'com.ss.android.ugc.trill';

        // Iterate through each device
        for (let deviceIndex = 0; deviceIndex < devices.length; deviceIndex++) {
            const device = devices[deviceIndex];
            console.log(`Processing device: ${device}`);

            if (shouldStop) {
                console.log("Stopping automation...");
                break;  // Stop processing if stop is requested
            }

            // Check if the package is installed
            if (!isPackageInstalled(device, packageName)) {
                const errorMessage = `Package ${packageName} is not installed on device ${device}. Automation stopped for this device.`;
                console.log(errorMessage);
                if (logWindow) logWindow.webContents.send('log-message', errorMessage);
                continue;  // Skip this device and move to the next
            }

            // Shuffle comments for each device to avoid duplicates per device/account
            let shuffledComments = shuffleArray([...comments]);  // Copy and shuffle the comments array

            // Assign a random proxy from the list
            const proxy = proxies[Math.floor(Math.random() * proxies.length)];
            console.log(`Setting proxy for device: ${device} with proxy: ${proxy}`);
            execSync(`adb -s ${device} shell settings put global http_proxy ${proxy}`);

            // Switch to the account based on the accountIndex received from the frontend
            console.log(`Switching to account ${accountIndex} on device ${device}`);
            await switchAccount(device, accountIndex, packageName);

            // Shuffle comments for the account to ensure randomness within the account
            shuffledComments = shuffleArray([...comments]);

            // Now process all links for the selected account
            for (let linkIndex = 0; linkIndex < targetLinks.length; linkIndex++) {
                if (shouldStop) {
                    console.log("Stopping automation...");
                    break;  // Stop processing if flag is set
                }

                const targetLink = targetLinks[linkIndex];
                const comment = shuffledComments[linkIndex % shuffledComments.length];  // Ensure no duplicates within the device/account

                try {
                    // Open the TikTok post
                    await openTikTokPost(device, targetLink);

                    // Tap the comment button after visiting the post
                    await tapCommentButton(device);

                    // Post the comment (one comment per post)
                    await postComment(device, comment);
                    logResults(device, accountIndex, comment);
                } catch (error) {
                    const errorMessage = `Error on device ${device} while processing link ${targetLink}: ${error.message}`;
                    console.error(errorMessage);
                    if (logWindow) logWindow.webContents.send('log-message', errorMessage);
                }
            }

            console.log(`Finished all links for account ${accountIndex} on device ${device}`);
        }

        console.log('Automation complete for all links and accounts.');
    } catch (error) {
        console.error("Error during automation:", error.message);
        if (logWindow) logWindow.webContents.send('log-message', `Error: ${error.message}`);
    }
});

// Listen for stop signal
ipcMain.on('stop-automation', () => {
    console.log("Received stop signal");
    shouldStop = true;  // Set the stop flag
});

// Function to create the main window
function createWindow() {
    const win = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),  // Ensure preload.js is loaded
            nodeIntegration: false,  // Disable node integration for security
            contextIsolation: true  // Use context isolation
        }
    });
    win.loadFile('index.html');
}

// Function to create the log window
function createLogWindow() {
    logWindow = new BrowserWindow({
        width: 600,
        height: 400,
        webPreferences: {
            nodeIntegration: true
        }
    });
    logWindow.loadFile('log.html');  // Load the log.html file for logs
}

app.whenReady().then(() => {
    createWindow();
    createLogWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
            createLogWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
