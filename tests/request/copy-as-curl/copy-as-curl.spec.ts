import { expect, test } from '../../../playwright';
import {
  buildCommonLocators,
  closeAllCollections,
  createCollection,
  createRequest,
  openItemActionsMenu,
  openRequest,
  readClipboard
} from '../../utils/page';

const COLLECTION = 'copy-as-curl';
const REQUEST = 'copy-me';
const URL = 'https://api.example.com/users/1';

// Clipboard reads pass if a stale value already holds the expected substring,
// so blank it before every copy.
const clearClipboard = async (page: Parameters<typeof readClipboard>[0]) => {
  await page.evaluate(() => navigator.clipboard.writeText(''));
};

const expectCurlOnClipboard = async (page: Parameters<typeof readClipboard>[0]) => {
  const text = await readClipboard(page);
  expect(text.startsWith('curl')).toBe(true);
  expect(text).toContain(URL);
  // httpsnippet's shell-curl target emits long flags (--request), not -X.
  expect(text).toContain('--request POST');
};

test.describe('Copy as cURL from request context menus', () => {
  test.afterEach(async ({ page }) => {
    await closeAllCollections(page);
  });

  test('sidebar request row menu copies the curl command', async ({ page, createTmpDir }) => {
    const locators = buildCommonLocators(page);
    await createCollection(page, COLLECTION, await createTmpDir(COLLECTION));
    await createRequest(page, REQUEST, COLLECTION, { url: URL, method: 'POST' });

    await openItemActionsMenu(page, REQUEST);
    await clearClipboard(page);
    await locators.sidebar.rowMenu(REQUEST).item('copy-as-curl').click();

    await expect(locators.toast.byMessage('cURL copied to clipboard')).toBeVisible({ timeout: 5000 });
    await expectCurlOnClipboard(page);
  });

  test('request tab right-click menu copies the curl command', async ({ page, createTmpDir }) => {
    const locators = buildCommonLocators(page);
    await createCollection(page, COLLECTION, await createTmpDir(COLLECTION));
    await createRequest(page, REQUEST, COLLECTION, { url: URL, method: 'POST' });
    await openRequest(page, COLLECTION, REQUEST);

    const tabLabel = locators.tabs.requestTab(REQUEST);
    await tabLabel.click({ button: 'right', position: { x: 5, y: 5 } });

    const menuItem = page.getByTestId('menu-dropdown-copy-as-curl');
    await expect(menuItem).toBeVisible();
    await clearClipboard(page);
    await menuItem.click();

    await expect(locators.toast.byMessage('cURL copied to clipboard')).toBeVisible({ timeout: 5000 });
    await expectCurlOnClipboard(page);
  });
});
