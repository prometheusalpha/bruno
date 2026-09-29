import { test, expect } from '../../../playwright';
import { closeAllCollections, createCollection, selectRequestPaneTab } from '../../utils/page';
import { buildCommonLocators } from '../../utils/page/locators';
import { createRequestFromCurl } from '../../utils/request';

const COLLECTION_NAME = 'curl-query-params';

// A realistic reporting API call: percent-encoded ISO timestamps, a repeated key,
// an encoded redirect URL whose `&` and `=` must survive, and an empty value.
const IMPORT_CURL
  = 'curl "https://httpbin.org/get?start_time=2026-08-31T17%3A00%3A00.000Z&warehouse_ids=aaa&warehouse_ids=bbb'
    + '&redirect=https%3A%2F%2Fx.com%3Fa%3D1%26b%3D2&name="';

test.describe('cURL import — query params', () => {
  test.afterEach(async ({ page }) => {
    await closeAllCollections(page);
  });

  test('percent-encoded query values are decoded into readable params', async ({ page, createTmpDir }) => {
    const { table } = buildCommonLocators(page);
    await createCollection(page, COLLECTION_NAME, await createTmpDir(COLLECTION_NAME));

    await createRequestFromCurl(page, 'query-params', IMPORT_CURL, COLLECTION_NAME);

    await selectRequestPaneTab(page, 'Params');
    const paramsTable = table('query-params-table');

    await test.step('timestamp value is decoded, not left as %3A', async () => {
      const row = paramsTable.rowByName('start_time');
      await expect(row).toBeVisible();
      await expect(paramsTable.rowValueEditor(row)).toContainText('2026-08-31T17:00:00.000Z');
      await expect(paramsTable.rowValueEditor(row)).not.toContainText('%3A');
    });

    await test.step('repeated key stays two separate rows', async () => {
      await expect(paramsTable.rowByName('warehouse_ids')).toHaveCount(2);
    });

    await test.step('encoded redirect stays a single pair with decoded & and =', async () => {
      const row = paramsTable.rowByName('redirect');
      await expect(row).toHaveCount(1);
      await expect(paramsTable.rowValueEditor(row)).toContainText('https://x.com?a=1&b=2');
    });

    await test.step('param with an empty value is kept', async () => {
      const nameRow = paramsTable.rowByName('name');
      await expect(nameRow).toBeVisible();
      // An empty CodeMirror renders the "Value" placeholder and carries the
      // CodeMirror-empty class, so assert emptiness by class, not by text.
      await expect(paramsTable.rowValueEditor(nameRow)).toHaveClass(/CodeMirror-empty/);
    });
  });
});
