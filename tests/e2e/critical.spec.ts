import { test, expect, type Page } from '@playwright/test';
async function demo(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Explore the live demo', exact: true }).first().click();
  await expect(page.getByRole('heading', { name: 'Your bigger picture.' })).toBeVisible();
}
async function navigate(page: Page, view: string) {
  await page.goto(`/app/${view}`);
  await expect(page.locator('main h1')).toBeVisible();
}
async function account(page: Page, name: string) {
  await navigate(page, 'accounts');
  await page.getByRole('button', { name: 'Add account', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Account name', { exact: true }).fill(name);
  await dialog.getByLabel('Institution', { exact: true }).fill('Synthetic Bank');
  await dialog.getByLabel('Opening balance', { exact: true }).fill('100');
  await dialog.getByRole('button', { name: 'Save changes' }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
}
test('demo navigation, command palette, theme and responsive layout', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await demo(page);
  for (const view of [
    'transactions',
    'accounts',
    'imports',
    'budgets',
    'goals',
    'insights',
    'forecast',
    'settings',
  ])
    await navigate(page, view);
  await page.keyboard.press('ControlOrMeta+k');
  await page.getByRole('textbox', { name: 'Search pages' }).fill('Overview');
  await page.getByRole('dialog').getByRole('link', { name: 'Overview' }).click();
  await expect(page.locator('main h1')).toContainText('Your bigger picture');
  await page.getByRole('button', { name: 'Use dark theme' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: 'Use light theme' }).click();
  if (testInfo.project.name === 'mobile') {
    await page.getByRole('button', { name: 'Open navigation' }).click();
    await page
      .getByRole('navigation', { name: 'Workspace navigation' })
      .getByRole('link', { name: 'Accounts', exact: true })
      .click();
    await expect(page.locator('main h1')).toContainText('Your money');
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
    true,
  );
  expect(errors).toEqual([]);
  await navigate(page, 'overview');
  await page.screenshot({
    path: `public/screenshots/${testInfo.project.name}-overview.png`,
    fullPage: true,
    animations: 'disabled',
  });
});
test('create, edit, filter, export and delete a persistent transaction', async ({ page }) => {
  await demo(page);
  await account(page, 'E2E checking');
  await navigate(page, 'transactions');
  await page.getByRole('button', { name: 'Add transaction' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Account', { exact: true }).selectOption({ label: 'E2E checking · USD' });
  await dialog.getByLabel('Original description').fill('Synthetic E2E lunch');
  await dialog.getByLabel('Signed amount').fill('-24.50');
  await dialog.getByLabel('Merchant', { exact: true }).fill('E2E cafe');
  await dialog.getByLabel('Category', { exact: true }).selectOption('Food & dining');
  await dialog.getByRole('button', { name: 'Save changes' }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByRole('textbox', { name: 'Search transactions' }).fill('E2E cafe');
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await expect(page.locator('tbody')).toContainText('$24.50');
  await page.reload();
  await page.getByRole('textbox', { name: 'Search transactions' }).fill('E2E cafe');
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await page.getByRole('textbox', { name: 'Search transactions' }).press('Enter');
  await page.getByRole('button', { name: 'E2E cafe', exact: false }).first().click();
  await dialog.getByLabel('Merchant', { exact: true }).fill('E2E reviewed cafe');
  await dialog.getByLabel('Notes').fill('Reviewed through the browser');
  await dialog.getByRole('button', { name: 'Save changes' }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByRole('textbox', { name: 'Search transactions' }).fill('E2E reviewed cafe');
  await expect(page.locator('tbody')).toContainText('E2E reviewed cafe');
  const download = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Export CSV' }).click();
  expect((await download).suggestedFilename()).toBe('finscope-transactions.csv');
  await page.getByRole('button', { name: 'Delete E2E reviewed cafe transaction' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm change' }).click();
  await expect(page.getByRole('heading', { name: 'A little quiet here' })).toBeVisible();
});
test('reviewed CSV imports are idempotent and can be undone', async ({ page }) => {
  await demo(page);
  await account(page, 'Import checking');
  await navigate(page, 'imports');
  const csv =
    'Date,Description,Amount,Currency,Balance,Reference\n2026-10-01,Synthetic import income,100,USD,200,import-1\n2026-10-02,Synthetic import coffee,-5,USD,195,import-2\n';
  async function upload() {
    await page
      .getByLabel('Statement file')
      .setInputFiles({ name: 'synthetic.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
    await page.getByLabel('Destination account').selectOption({ label: 'Import checking · USD' });
    await expect(
      page.getByRole('button', { name: 'Review & import 2 transactions' }),
    ).toBeEnabled();
    await page.getByRole('button', { name: 'Review & import 2 transactions' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Confirm import' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
  }
  await upload();
  await expect(
    page.getByRole('status').filter({ hasText: 'Imported 2 transactions' }).first(),
  ).toBeVisible();
  await upload();
  await expect(
    page.getByText('This statement was already imported. No records added.').first(),
  ).toBeVisible();
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm change' }).click();
  await expect(page.getByRole('heading', { name: 'A new chapter awaits' })).toBeVisible();
  await navigate(page, 'transactions');
  await page.getByRole('textbox', { name: 'Search transactions' }).fill('Synthetic import');
  await expect(page.getByRole('heading', { name: 'A little quiet here' })).toBeVisible();
});
test('budgets, goal contributions and financial scenarios persist and calculate', async ({
  page,
}) => {
  await demo(page);
  await navigate(page, 'budgets');
  await page.getByRole('button', { name: 'Set a budget' }).click();
  let dialog = page.getByRole('dialog');
  await dialog.getByLabel('Category', { exact: true }).selectOption('Health');
  await dialog.getByLabel('Monthly limit').fill('200');
  await dialog.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('heading', { name: 'Health', exact: true })).toBeVisible();
  await navigate(page, 'goals');
  await page.getByRole('button', { name: 'Create a goal' }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel('Goal name').fill('E2E mountain trip');
  await dialog.getByLabel('Target amount').fill('1000');
  await dialog.getByLabel('Already set aside').fill('100');
  await dialog.getByRole('button', { name: 'Save changes' }).click();
  const card = page
    .locator('article')
    .filter({ has: page.getByRole('heading', { name: 'E2E mountain trip' }) });
  await card.getByRole('button', { name: 'Update progress' }).click();
  await page.getByRole('dialog').getByLabel('Additional amount to earmark').fill('50');
  await page.getByRole('dialog').getByRole('button', { name: 'Save changes' }).click();
  await expect(card).toContainText('$150.00');
  await page.reload();
  await expect(card).toContainText('$150.00');
  await navigate(page, 'forecast');
  await page.getByLabel('Starting net worth').fill('1000');
  await page.getByLabel('Monthly income', { exact: true }).fill('100');
  await page.getByLabel('Monthly spending', { exact: true }).fill('50');
  await page.getByLabel('Forecast horizon').selectOption('12');
  await expect(page.locator('.forecast-totals').filter({ hasText: 'Expected' })).toContainText(
    '$1,600.00',
  );
});
test('API session boundaries, validation, CSRF and private-demo reset protection', async ({
  browser,
  page,
}) => {
  await demo(page);
  const first = await page.request.get('/api/data');
  expect(first.ok()).toBe(true);
  const a = await first.json();
  const other = await browser.newContext();
  const second = await other.request.post('/api/auth/demo', { data: {} });
  expect(second.status()).toBe(201);
  const foreign = await other.request.post('/api/actions', {
    data: { action: 'account.archive', id: a.accounts[0].id },
  });
  expect(foreign.status()).toBe(404);
  expect((await other.request.get('/api/data')).ok()).toBe(true);
  const invalid = await page.request.post('/api/actions', {
    data: { action: 'transaction.create', date: '2026-02-31' },
  });
  expect(invalid.status()).toBe(400);
  const csrf = await page.request.post('/api/actions', {
    headers: { origin: 'https://untrusted.example' },
    data: { action: 'demo.reset' },
  });
  expect(csrf.status()).toBe(403);
  const unauth = await browser.newContext();
  expect((await unauth.request.get('/api/data')).status()).toBe(401);
  await unauth.close();
  await navigate(page, 'settings');
  await page.getByRole('button', { name: 'Reset demo', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm change' }).click();
  await expect(page.getByRole('status')).toContainText('restored');
  const b = await (await other.request.get('/api/data')).json();
  expect(a.workspace.id).not.toBe(b.workspace.id);
  expect(b.accounts).toHaveLength(3);
  await other.close();
});
test('real registration, logout, login and session persistence', async ({ page }) => {
  const email = `finscope-${crypto.randomUUID()}@example.test`;
  await page.goto('/register');
  await page.getByLabel('Your name').fill('Synthetic E2E member');
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password', { exact: true }).fill('Correct synthetic password 123');
  await page.getByRole('button', { name: 'Create workspace', exact: true }).click();
  await expect(page.locator('main h1')).toContainText('Your bigger picture');
  await expect(page.locator('.demo-banner')).toHaveCount(0);
  const reset = await page.request.post('/api/actions', { data: { action: 'demo.reset' } });
  expect(reset.status()).toBe(403);
  await page.request.post('/api/auth/logout', { data: {} });
  await page.goto('/app/overview');
  await expect(page).toHaveURL(/sign-in/);
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password', { exact: true }).fill('Correct synthetic password 123');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.locator('main h1')).toContainText('Your bigger picture');
  await page.reload();
  await expect(page.locator('main h1')).toContainText('Your bigger picture');
});

test('text PDF extraction feeds the same reviewed atomic import workflow', async ({ page }) => {
  const { syntheticPdf } = await import('./pdf');
  await demo(page);
  await account(page, 'PDF checking');
  await navigate(page, 'imports');
  await page
    .getByLabel('Statement file')
    .setInputFiles({ name: 'synthetic.pdf', mimeType: 'application/pdf', buffer: syntheticPdf() });
  await page.getByLabel('Destination account').selectOption({ label: 'PDF checking · USD' });
  await expect(page.getByRole('button', { name: 'Review & import 2 transactions' })).toBeEnabled();
  await expect(page.locator('tbody')).toContainText('Synthetic PDF income');
  await expect(page.locator('tbody')).toContainText('Synthetic PDF coffee');
  await page.getByRole('button', { name: 'Review & import 2 transactions' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm import' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(
    page.getByRole('status').filter({ hasText: 'Imported 2 transactions' }).first(),
  ).toBeVisible();
  await navigate(page, 'transactions');
  await page.getByRole('textbox', { name: 'Search transactions' }).fill('Synthetic PDF');
  await expect(page.locator('tbody tr')).toHaveCount(2);
});
