import setInputField from "@nice-digital/wdio-cucumber-steps/lib/support/action/setInputField";
import waitForVisible from "@nice-digital/wdio-cucumber-steps/lib/support/action/waitForVisible";
import click from "@nice-digital/wdio-cucumber-steps/lib/support/action/clickElement";
import waitFor from "@nice-digital/wdio-cucumber-steps/lib/support/action/waitFor";
import checkEqualsText from "@nice-digital/wdio-cucumber-steps/lib/support/check/checkEqualsText";
import selectors from "../selectors";

export const createaccount = (username, password) => {
  waitForVisible(selectors.registrationPage.emailInput);
  waitForVisible(selectors.registrationPage.passwordInput);
  browser.setValue(selectors.registrationPage.emailInput, process.env[username]);
  browser.setValue(selectors.registrationPage.confirmEmailInput, process.env[username]);
  browser.setValue(selectors.registrationPage.passwordInput, process.env[password]);
  browser.setValue(selectors.registrationPage.confirmPasswordInput, process.env[password]);
  browser.setValue(selectors.registrationPage.firstNameInput, 'Martin');
  browser.setValue(selectors.registrationPage.surnameInput, 'Gallagher');
  click('doubleClick', 'element', selectors.registrationPage.tcCheckBox);
  click('click', 'element', selectors.registrationPage.registerButton);
  checkEqualsText('element', 'h3', 'should', 'Thank you!');
}

export default createaccount;