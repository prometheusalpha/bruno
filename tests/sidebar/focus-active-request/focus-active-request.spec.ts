import { test, expect, closeElectronApp, Page, Locator, ElectronApplication } from '../../../playwright';
import path from 'path';
import { buildCommonLocators, waitForReadyPage } from '../../utils/page';
import { initBruCollection, writeBruFolder, writeBruRequest } from '../../utils/fixtures/bru-collection';

// Enough root requests that the target's row would sit far below the sidebar viewport.
const COLLECTION_NAME = 'FocusCol';
const REQUEST_COUNT = 60;
const FOLDER_NAME = 'deep-folder';
const TARGET_REQUEST = 'target-req';
const reqName = (i: number) => `req-${String(i).padStart(3, '0')}`;

const WINDOW_SIZE = { width: 1200, height: 500 };

type LaunchElectronApp = (options: {
  initUserDataPath?: string;
  userDataPath?: string;
  dotEnv?: Record<string, string>;
  templateVars?: Record<string, string>;
}) => Promise<ElectronApplication>;

const buildCollectionOnDisk = (dir: string) => {
  initBruCollection(dir, COLLECTION_NAME);
  for (let i = 1; i <= REQUEST_COUNT; i++) writeBruRequest(dir, reqName(i), { seq: i });
  const folderDir = writeBruFolder(dir, FOLDER_NAME, REQUEST_COUNT + 1);
  writeBruRequest(folderDir, TARGET_REQUEST, { seq: REQUEST_COUNT + 2 });
};

const launchApp = async (launchElectronApp: LaunchElectronApp, collectionDir: string) => {
  const app = await launchElectronApp({
    initUserDataPath: path.join(__dirname, 'init-user-data'),
    templateVars: { collectionPath: collectionDir.split(path.sep).join('/') }
  });
  const page = await waitForReadyPage(app);
  await page.setViewportSize(WINDOW_SIZE);
  return { app, page, locators: buildCommonLocators(page) };
};

/** Collapses a row via its chevron if it is currently expanded. */
const collapseIfExpanded = async (chevron: Locator) => {
  const isExpanded = await chevron.evaluate((el: HTMLElement) => el.classList.contains('rotate-90'));
  if (isExpanded) await chevron.click();
};

const openTargetAsPersistentTab = async (page: Page) => {
  const { sidebar, tabs } = buildCommonLocators(page);
  await sidebar.collection(COLLECTION_NAME).click();
  await expect(sidebar.request(reqName(1))).toBeVisible({ timeout: 15000 });

  await sidebar.folder(FOLDER_NAME).click();
  const targetRow = sidebar.request(TARGET_REQUEST);
  await expect(targetRow).toBeVisible();
  // Double click persists the tab, so the request can be re-activated after collapsing.
  await targetRow.dblclick();
  await expect(tabs.activeRequestTab()).toContainText(TARGET_REQUEST);
};

test.describe('Sidebar focus active request', () => {
  test('expands collapsed ancestors and scrolls the active request into view', async ({ launchElectronApp, createTmpDir }) => {
    const collectionDir = path.join(await createTmpDir('focus-active'), COLLECTION_NAME);
    buildCollectionOnDisk(collectionDir);

    const { app, page, locators } = await launchApp(launchElectronApp, collectionDir);
    const targetRow = locators.sidebar.request(TARGET_REQUEST);

    try {
      await test.step('Open the nested request as a persistent tab', async () => {
        await openTargetAsPersistentTab(page);
      });

      await test.step('Collapse the whole collection so the target row leaves the DOM', async () => {
        await collapseIfExpanded(locators.sidebar.collectionChevron(COLLECTION_NAME));
        await expect(targetRow).toHaveCount(0);
      });

      await test.step('Focusing the nested request expands the collection and scrolls to it', async () => {
        // Re-activate the nested request's tab. The collection is collapsed, so its row is gone
        // and the automatic scroll-to-active-tab has nothing to scroll to.
        await locators.tabs.requestTab(TARGET_REQUEST).click();
        await expect(locators.tabs.activeRequestTab()).toContainText(TARGET_REQUEST);
        await expect(targetRow).toHaveCount(0);

        await locators.sidebar.focusActiveRequestButton().click();

        await expect(targetRow).toBeVisible();
        await expect(targetRow).toBeInViewport();
      });
    } finally {
      await closeElectronApp(app);
    }
  });

  test('expands a collapsed folder inside an expanded collection', async ({ launchElectronApp, createTmpDir }) => {
    const collectionDir = path.join(await createTmpDir('focus-active'), COLLECTION_NAME);
    buildCollectionOnDisk(collectionDir);

    const { app, page, locators } = await launchApp(launchElectronApp, collectionDir);
    const targetRow = locators.sidebar.request(TARGET_REQUEST);

    try {
      await test.step('Open the nested request as a persistent tab', async () => {
        await openTargetAsPersistentTab(page);
      });
      await test.step('Collapse only the folder, then focus the request', async () => {
        await collapseIfExpanded(locators.sidebar.folder(FOLDER_NAME).getByTestId('folder-chevron'));
        await expect(targetRow).toHaveCount(0);

        await locators.sidebar.focusActiveRequestButton().click();

        await expect(targetRow).toBeVisible();
        await expect(targetRow).toBeInViewport();
      });
    } finally {
      await closeElectronApp(app);
    }
  });

  test('focusing a workspace-level tab is a silent no-op', async ({ launchElectronApp, createTmpDir }) => {
    const collectionDir = path.join(await createTmpDir('focus-active'), COLLECTION_NAME);
    buildCollectionOnDisk(collectionDir);

    const { app, locators } = await launchApp(launchElectronApp, collectionDir);

    try {
      // The app always opens the non-closable Overview and Environments workspace tabs, so
      // there is always an active tab and the button is never disabled. Those tabs have no
      // sidebar row, so focusing must no-op quietly instead of scrolling somewhere unrelated.
      await expect(locators.tabs.allRequestTabs()).toHaveCount(2);
      await locators.tabs.allRequestTabs().first().click();

      const collectionRow = locators.sidebar.collectionRow(COLLECTION_NAME);
      await expect(collectionRow).toBeInViewport();

      await locators.sidebar.focusActiveRequestButton().click();

      await expect(collectionRow).toBeInViewport();
      // The collection stayed collapsed: focusing a row-less tab expanded nothing.
      await expect(locators.sidebar.request(reqName(1))).toHaveCount(0);
    } finally {
      await closeElectronApp(app);
    }
  });
});
