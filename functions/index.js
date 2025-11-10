/**
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */
const {onObjectFinalized} = require("firebase-functions/v2/storage");
const {onCall} = require("firebase-functions/v2/https");
const {setGlobalOptions} = require("firebase-functions/v2");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
const pdf = require("pdf-parse");
const puppeteer = require("puppeteer");

// Initialize Firebase Admin SDK
// This will use the service account from the environment variable if it exists.
let serviceAccount;
try {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
    serviceAccount = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
  }
} catch (e) {
    logger.error('Could not parse GOOGLE_APPLICATION_CREDENTIALS_JSON.', e);
}

if (serviceAccount) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
} else {
    admin.initializeApp();
}

const db = admin.firestore();

// Set global options for the function
setGlobalOptions({timeoutSeconds: 300, memory: "2GiB"});

/**
 * Sleeps for a given amount of time.
 * @param {number} ms The number of milliseconds to sleep.
 * @returns {Promise<void>}
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));


/**
 * The core automation logic for filling a form with given records.
 * @param {Array<Object>} records An array of record objects to process.
 * @param {string} automationId A unique ID for this automation run.
 */
async function processRecordsWithPuppeteer(records, automationId) {
    logger.log(`[${automationId}] Starting puppeteer processing for ${records.length} records.`);
    
    // Get site mapping configuration from Firestore
    const configDoc = await db.collection("config").doc("siteMapping").get();
    if (!configDoc.exists) {
        throw new Error("siteMapping configuration not found in Firestore.");
    }
    const config = configDoc.data();
    const { targetUrl, selectors, delayMs = 2500 } = config;

    if (!targetUrl || !selectors) {
         throw new Error("targetUrl or selectors missing from siteMapping config.");
    }

    // Launch Puppeteer
    const browser = await puppeteer.launch({ args: ["--no-sandbox", "--disable-setuid-sandbox"] });
    const page = await browser.newPage();

    let submittedCount = 0;
    let failedCount = 0;
    let captchaBlockedCount = 0;
    
    // Process each record
    for (let i = 0; i < records.length; i++) {
        const record = records[i];
        const logData = {
            automationId,
            recordIndex: i + 1,
            name: record.name || "N/A",
            status: "pending",
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
        };
        
        const logDocRef = db.collection("submissionLogs").doc();

        try {
            logger.log(`[${automationId}] Processing record ${i + 1}/${records.length}: ${record.name}`);
            await page.goto(targetUrl, { waitUntil: "networkidle2" });
            
            // Check for CAPTCHA
            const captchaFound = await checkForCaptcha(page);
            if (captchaFound) {
                logger.warn(`[${automationId}] CAPTCHA detected on page for record ${i+1}. Skipping.`);
                logData.status = "captcha-blocked";
                logData.message = "CAPTCHA detected, submission skipped.";
                await logDocRef.set(logData);
                captchaBlockedCount++;
                continue; // Skip to the next record
            }

            // Fill form fields based on selectors from config
            await page.evaluate((record, selectors) => {
                 // Helper to fill input or select
                const fillField = (selector, value) => {
                    if (!selector || !value) return;
                    const element = document.querySelector(selector);
                    if (element) {
                        if (element.tagName === 'SELECT') {
                            const option = Array.from(element.options).find(opt => opt.value === value || opt.text === value);
                            if (option) option.selected = true;
                        } else {
                            element.value = value;
                        }
                    }
                };

                for (const key in selectors) {
                   if (record[key]) {
                        fillField(selectors[key], record[key]);
                   }
                }
            }, record, selectors);

            // Submit form
            await Promise.all([
                page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 5000 }).catch(() => logger.log('Navigation timeout after submit.')),
                page.click(selectors.submit)
            ]);
            
            logger.log(`[${automationId}] Successfully submitted record ${i + 1}`);
            logData.status = "success";
            logData.message = `Submitted successfully to ${page.url()}`;
            await logDocRef.set(logData);
            submittedCount++;

        } catch (e) {
            logger.error(`[${automationId}] Failed to process record ${i + 1}:`, e.message);
            logData.status = "error";
            logData.message = e.message;
            await logDocRef.set(logData);
            failedCount++;
        } finally {
            // Delay between submissions
            if (i < records.length - 1) {
                await sleep(delayMs);
            }
        }
    }
    
    await browser.close();

    return { submittedCount, failedCount, captchaBlockedCount };
}


/**
 * Cloud Function triggered by PDF upload to Cloud Storage.
 */
exports.autoFormFill = onObjectFinalized({bucket: process.env.GCLOUD_STORAGE_BUCKET}, async (event) => {
    const fileBucket = event.data.bucket; // Storage bucket containing the file.
    const filePath = event.data.name; // File path in the bucket.
    const contentType = event.data.contentType; // File content type.

    // Exit if this is triggered on a file that is not a PDF.
    if (!contentType.startsWith("application/pdf")) {
        return logger.log("This is not a PDF.");
    }
    // Exit if the file is not in the 'uploads' folder.
    if (!filePath.startsWith("uploads/")) {
        return logger.log("File is not in the uploads folder.");
    }

    const fileId = filePath.split("/").pop();
    logger.log(`Processing file: ${fileId}`);
    
    const metaDocRef = db.collection("uploadsMeta").doc(fileId);
    await metaDocRef.set({
        status: "processing",
        submitted: 0,
        failed: 0,
        captchaBlocked: 0,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    try {
        // Download PDF from Cloud Storage
        const bucket = admin.storage().bucket(fileBucket);
        const fileBuffer = (await bucket.file(filePath).download())[0];

        // Parse PDF text
        const data = await pdf(fileBuffer);
        const pdfText = data.text;
        
        const records = parseRecords(pdfText);
        logger.log(`Found ${records.length} records in the PDF.`);
        if (records.length === 0) {
            throw new Error("No records found in PDF text.");
        }

        const { submittedCount, failedCount, captchaBlockedCount } = await processRecordsWithPuppeteer(records, fileId);

        // Finalize metadata
        await metaDocRef.update({
            status: "done",
            submitted: submittedCount,
            failed: failedCount,
            captchaBlocked: captchaBlockedCount,
        });

        logger.log(`Processing complete for file ${fileId}.`);

    } catch (error) {
        logger.error(`Error processing file ${fileId}:`, error);
        await metaDocRef.update({
            status: "error",
            message: error.message,
        });
    }
});


/**
 * Callable Cloud Function to run form automation from the client.
 */
exports.runFormAutomation = onCall({ enforceAppCheck: false }, async (request) => {
    if (!request.auth) {
      throw new onCall.HttpsError(
        'unauthenticated',
        'The function must be called while authenticated.'
      );
    }
    
    const { records } = request.data;
    const automationId = `ui-${Date.now()}`;
    logger.log(`[${automationId}] Received automation request from user ${request.auth.uid}`);

    if (!records || !Array.isArray(records) || records.length === 0) {
         throw new onCall.HttpsError(
            'invalid-argument',
            'The function must be called with an array of "records".'
         );
    }

    const metaDocRef = db.collection("uploadsMeta").doc(automationId);
    await metaDocRef.set({
        status: "processing",
        source: "ui",
        user: request.auth.uid,
        submitted: 0,
        failed: 0,
        captchaBlocked: 0,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    try {
        const { submittedCount, failedCount, captchaBlockedCount } = await processRecordsWithPuppeteer(records, automationId);

        await metaDocRef.update({
            status: "done",
            submitted: submittedCount,
            failed: failedCount,
            captchaBlocked: captchaBlockedCount,
        });

        logger.log(`[${automationId}] UI automation complete.`);
        return { success: true, message: "Automation finished successfully.", automationId };

    } catch (error) {
        logger.error(`[${automationId}] Error during UI automation:`, error);
        await metaDocRef.update({
            status: "error",
            message: error.message,
        });
        throw new onCall.HttpsError('internal', error.message, error);
    }
});

/**
 * Callable Cloud Function to create a new user. Only for admins.
 * This function requires the caller to have admin privileges.
 */
exports.createUser = onCall({ enforceAppCheck: false }, async (request) => {
    // 1. Authentication and Authorization
    if (!request.auth) {
        throw new onCall.HttpsError('unauthenticated', 'The function must be called while authenticated.');
    }
    
    if (request.auth.token.email !== 'admin@akm.com') {
        throw new onCall.HttpsError('permission-denied', 'You must be an admin to create users.');
    }

    // 2. Data Validation
    const { email, password } = request.data;
    if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
        throw new onCall.HttpsError('invalid-argument', 'The function must be called with an "email" and "password".');
    }
    if (password.length < 6) {
        throw new onCall.HttpsError('invalid-argument', 'Password must be at least 6 characters long.');
    }

    // 3. User Creation Logic
    try {
        const userRecord = await admin.auth().createUser({
            email: email,
            password: password,
        });
        logger.log('Successfully created new user:', userRecord.uid);
        return { uid: userRecord.uid, email: userRecord.email };
    } catch (error) {
        logger.error('Error creating new user:', error);
        // Map Firebase Admin SDK errors to client-friendly errors
        if (error.code === 'auth/email-already-exists') {
            throw new onCall.HttpsError('already-exists', 'The email address is already in use by another account.');
        }
        if (error.code === 'auth/invalid-password') {
            throw new onCall.HttpsError('invalid-argument', error.message);
        }
        // For other errors, throw a generic internal error
        throw new onCall.HttpsError('internal', 'An unexpected error occurred while creating the user.');
    }
});


/**
 * Callable Cloud Function to delete a user. Only for admins.
 * This function requires the caller to have admin privileges.
 */
exports.deleteUser = onCall({ enforceAppCheck: false }, async (request) => {
    // 1. Authentication and Authorization
    if (!request.auth) {
        throw new onCall.HttpsError('unauthenticated', 'The function must be called while authenticated.');
    }
    
    if (request.auth.token.email !== 'admin@akm.com') {
        throw new onCall.HttpsError('permission-denied', 'You must be an admin to delete users.');
    }

    // 2. Data Validation
    const { uid } = request.data;
    if (!uid || typeof uid !== 'string') {
        throw new onCall.HttpsError('invalid-argument', 'The function must be called with a "uid".');
    }
    
    if (uid === request.auth.uid) {
        throw new onCall.HttpsError('invalid-argument', 'Admin users cannot delete their own account.');
    }

    // 3. User Deletion Logic
    try {
        await admin.auth().deleteUser(uid);
        logger.log('Successfully deleted user:', uid);
        return { success: true, message: `User ${uid} has been deleted.` };
    } catch (error) {
        logger.error('Error deleting user:', error);
        if (error.code === 'auth/user-not-found') {
            throw new onCall.HttpsError('not-found', 'The user to delete was not found.');
        }
        throw new onCall.HttpsError('internal', 'An unexpected error occurred while deleting the user.');
    }
});


/**
 * Parses structured records from the raw text extracted from a PDF.
 * @param {string} text The raw text from the PDF.
 * @returns {Array<Object>} An array of record objects.
 */
function parseRecords(text) {
    const records = [];
    const recordBlocks = text.split(/(?=Name:)/g);

    const fieldRegex = {
        name: /Name:\s*(.+)/,
        age: /Age:\s*(\d+)/,
        gender: /Gender:\s*(.+)/,
        maritalStatus: /Marital Status:\s*(.+)/,
        education: /Education:\s*(.+)/,
        occupation: /Occupation:\s*(.+)/,
        religion: /Religion:\s*(.+)/,
        caste: /Caste:\s*(.+)/,
        gothra: /Gothra:\s*(.+)/,
        motherTongue: /Mother Tongue:\s*(.+)/,
        horoscopeMatch: /Horoscope Match:\s*(.+)/,
        star: /Star:\s*(.+)/,
        raasiMoonSign: /Raasi \/ Moon Sign:\s*(.+)/,
        doshamManglik: /Dosham \/ Manglik:\s*(.+)/,
        heightFeet: /Height:\s*(\d+)'/,
        heightInches: /Height:\s*\d+'\s*(\d+)"/,
        heightCms: /Height \(cms\):\s*(\d+)/,
        weightKg: /Weight \(Kg\):\s*([\d.]+)/,
        weightLbs: /Weight \(Lbs\):\s*([\d.]+)/,
        citizenship: /Citizenship:\s*(.+)/,
        homeState: /Home State:\s*(.+)/,
        bodyType: /Body Type:\s*(.+)/,

        complexion: /Complexion:\s*(.+)/,
        physicalStatus: /Physical Status:\s*(.+)/,
        eatingHabit: /Eating Habit:\s*(.+)/,
        drinkingHabit: /Drinking Habit:\s*(.+)/,
        smokingHabit: /Smoking Habit:\s*(.+)/,
        familyValue: /Family Value:\s*(.+)/,
        familyType: /Family Type:\s*(.+)/,
        familyStatus: /Family Status:\s*(.+)/,
        annualIncome: /Annual Income:\s*(.+)/,
        aboutParentsSiblings: /About Parents\/Siblings:\s*([\s\S]+?)(?=More About Self:)/,
        moreAboutSelf: /More About Self:\s*([\s\S]+?)(?=Your Expectation:)/,
        yourExpectation: /Your Expectation:\s*([\s\S]+)/,
    };

    for (const block of recordBlocks) {
        if (!block.trim().startsWith("Name:")) continue;

        const record = {};
        for (const key in fieldRegex) {
            const match = block.match(fieldRegex[key]);
            if (match && match[1]) {
                record[key] = match[1].trim().replace(/\s+/g, ' ');
            }
        }
        
        if (!record.name) continue;
        
        if (record.name) {
            const emailName = record.name.replace(/\s+/g, '_');
            record.email = `form_${emailName}@nitresearchcenter.com`;
            record.retypeEmail = record.email;
        }

        if (record.name) {
            const firstName = record.name.split(' ')[0];
            record.password = `${firstName}@1234`;
            record.retypePassword = record.password;
        }

        record.educationDetails = record.education;
        record.subCaste = record.caste;
        record.homeCityDistrict = record.homeState;
        record.countryLivingIn = record.citizenship;
        record.stateCityLivingIn = record.homeState;
        
        record.howToKnowAboutUs = "My Friend";

        records.push(record);
    }

    return records;
}

/**
 * Checks if a CAPTCHA is present on the page.
 * @param {import('puppeteer').Page} page The Puppeteer page object.
 * @returns {Promise<boolean>} True if a CAPTCHA is detected, false otherwise.
 */
async function checkForCaptcha(page) {
    const captchaSelectors = [
        "iframe[src*='recaptcha']",
        ".g-recaptcha",
    ];

    for (const selector of captchaSelectors) {
        const element = await page.$(selector);
        if (element) {
            return true;
        }
    }
    return false;
}

    
