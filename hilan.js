#!/usr/bin/env node
"use strict";

require('chromedriver');
const chrome = require('selenium-webdriver/chrome');
const { Builder, By, Key, until } = require('selenium-webdriver');
const Promise = require('bluebird');
const program = require('commander');

const NO_MISSING_DAYS = "לא נמצאו ימים שגויים";
const SAVED_MISSING_DAYS_SUCCESSFULLY = "הנתונים נשמרו בהצלחה";
const ENTRY_FIELD_NAME = "ManualEntry";
const EXIT_FIELD_NAME = "ManualExit";

async function exitWithSuccessCode(driver, pattern) {
    console.log(`Found the string ${pattern}! Exiting successfully.`);
    await driver.quit();
    process.exit(0);
}

async function waitForFrameAndSwitchToIt(driver, frameId) {
    const iframeBy = By.id(frameId);
    const iframe = await driver.wait(until.elementLocated(iframeBy), 1500);
    await driver.switchTo().frame(iframe);
}

async function checkForSuccess(driver, pattern) {
    try {
        await waitForFrameAndSwitchToIt(driver, 'alertFrame');
        const message = await driver.findElement(By.id('messagePlace')).getText();
        if (message === pattern) {
            await exitWithSuccessCode(driver, pattern);
        }
    } catch(e) {
        // Getting here probably means we couldn't find the alertIframe, which means we didn't find what we were looking
        // for. This means we should continue the flow and shouldn't exit.
    }
}

async function fillHours(driver, fieldName, hour) {
    let elements = await driver.findElements(By.css(`input[name*=${fieldName}]`));
    const actions = driver.actions();
    for (let element of elements) {
        const rect = await element.getRect();
        // move the mouse to the left of the element (this calculation is ugly but that's Selenium's API :( ).
        await actions.move({x: (1 - (rect.width / 2)), y: 1, origin: element})
                .pause(100)
                .press()
                .release()
                .pause(100)
                .sendKeys(hour)
                .perform();
    };
}

async function fillAttendance(driver) {
    let elements = await driver.findElements(By.css(`select[name*=EmployeeReports]`));
    const actions = driver.actions();
    for (let element of elements) {
        await actions.move({ origin: element })
                .pause(100)
                .press()
                .release()
                .pause(100)
                .sendKeys("נוכחות")
                .pause(100)
                .sendKeys(Key.RETURN)
                .perform();
    };
}

async function waitForElementAndClick(driver, id) {
    const idSelector = `[id*=${id}]`;
    const by = By.css(`a${idSelector},input${idSelector}`);
    const element = await driver.wait(until.elementLocated(by), 3000);
    await element.click();
}

async function fillMissingDays() {
    let driver = new Builder().forBrowser('chrome');
    try {
        if (!program.showUI) {
            driver = driver.setChromeOptions(new chrome.Options().headless().windowSize({ width: program.width, height: program.height }));
        }

        driver = await driver.build();

        const url = program.url;
        await driver.get(url);
        await driver.findElement(By.id('user_nm')).sendKeys(program.username);
        await driver.findElement(By.id('password_nm')).sendKeys(program.password, Key.RETURN);

        await waitForFrameAndSwitchToIt(driver, 'mainIFrame');

        await waitForElementAndClick(driver, "ctl00_mp_lnkPresenceReproting");

        await waitForElementAndClick(driver, "ctl00_mp_RefreshErrorsDays");

        await checkForSuccess(driver, NO_MISSING_DAYS);

        console.log(`Couldn't find an alert with ${NO_MISSING_DAYS}. Filling missing days.`);
        await fillHours(driver, ENTRY_FIELD_NAME, "1000");
        await fillHours(driver, EXIT_FIELD_NAME, "1900");

        await fillAttendance(driver);

        await waitForElementAndClick(driver, "btnSave");

        await checkForSuccess(driver, SAVED_MISSING_DAYS_SUCCESSFULLY);
    } catch (e) {
        console.log("Failed to update, got the error: ", e);

        await driver.quit();
        process.exit(1);
    }
};

program
    .usage('Fill missing days in Hilan')
    .option('-u, --username <type>', 'Username to use for login')
    .option('-p, --password <type>', 'Password to use for login')
    .option('--url <type>', 'Hilan\'s login url')
    .option('--showUI', 'Don\'t use headless Chrome, instead show the UI')
    .option('--width <width>', 'Set the window\'s width', 1920)
    .option('--height <height>', 'Set the window\'s height', 1080)
    .parse(process.argv);

if (program.username && program.password && program.url) {
    fillMissingDays();
} else {
    console.log(program.help());
}

