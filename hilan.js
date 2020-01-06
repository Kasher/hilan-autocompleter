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

async function checkForSuccess(driver, pattern) {
    const alertIframeBy = By.id("alertFrame");
    try {
        const alertIframe = await driver.wait(until.elementLocated(alertIframeBy), 1500);
        await driver.switchTo().frame(alertIframe);
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
        await actions.move({x: (1 -(rect.width / 2)), y: 1, origin: element})
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
            driver = driver.setChromeOptions(new chrome.Options().headless());
        }

        driver = await driver.build();

        const url = program.url || "https://broadcom.net.hilan.co.il/login";
        await driver.get(url);
        await driver.findElement(By.id('user_nm')).sendKeys(program.username);
        await driver.findElement(By.id('password_nm')).sendKeys(program.password, Key.RETURN);

        await Promise.delay(1000);

        await driver.switchTo().frame(driver.findElement(By.id('mainIFrame')));

        await waitForElementAndClick(driver, "ctl00_mp_lnkPresenceReproting");

        await waitForElementAndClick(driver, "ctl00_mp_RefreshErrorsDays");

        await checkForSuccess(driver, NO_MISSING_DAYS);

        await fillHours(driver, ENTRY_FIELD_NAME, "1000");
        await fillHours(driver, EXIT_FIELD_NAME, "1900");

        await fillAttendance(driver);

        await waitForElementAndClick(driver, "btnSave");

        await checkForSuccess(driver, SAVED_MISSING_DAYS_SUCCESSFULLY);
    } finally {
        await driver.quit();
    }
};

program
    .usage('Fill missing days in Hilan')
    .option('-u, --username <type>', 'Username to use for login')
    .option('-p, --password <type>', 'Password to use for login')
    .option('--url <type>', 'Hilan\'s login url')
    .option('--showUI', 'Don\'t use headless Chrome, instead show the UI')
    .parse(process.argv);

if (program.username && program.password) {
    fillMissingDays();
} else {
    console.log(program.help());
}

