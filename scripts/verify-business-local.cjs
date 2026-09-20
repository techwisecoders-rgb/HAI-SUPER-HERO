// Real Chrome interactions, explicitly MOCKED business API; no database writes.
const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');
module.exports = async function verifyBusiness(base) {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  assert.equal(new URL(base).hostname, '127.0.0.1', 'Mock fixture is localhost-only');
  const page = await browser.newPage();
  // Synthetic fixture identity: every business API request is intercepted below.
  await page.context().addCookies([{ name: 'accompany_app_user', value: '00000000-0000-4000-8000-000000000001', url: base }]);
  page.setDefaultTimeout(10000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const data = { profile: null, listings: [], delivery_areas: [], social_links: [], reviews: [], staff_roles: [], entries: [], orders: [] };
  const requests = [];
  const map = { staff: 'staff_roles', entries: 'entries', listings: 'listings', 'delivery-areas': 'delivery_areas', 'social-links': 'social_links', reviews: 'reviews', orders: 'orders' };
  const snake = input => Object.fromEntries(Object.entries(input).map(([k,v]) => [k.replace(/[A-Z]/g, l => '_' + l.toLowerCase()), v]));
  let sequence = 0;
  await page.route('**/api/business**', async route => {
    const req = route.request();
    const resource = new URL(req.url()).pathname.split('/')[3];
    if (resource === 'upload') return route.fulfill({ status: 500, json: { error: 'Test storage unavailable' } });
    if (req.method() === 'GET') return route.fulfill({ json: data });
    const payload = req.postDataJSON();
    requests.push({ method: req.method(), resource, payload });
    if (!resource) data.profile = { id: 'fixture-business', name: '', working_hours: {}, ...data.profile, ...snake(payload) };
    else {
      const rows = data[map[resource]];
      const id = new URL(req.url()).pathname.split('/')[4];
      if (req.method() === 'POST') rows.push({ id: String(++sequence), created_at: new Date().toISOString(), ...snake(payload) });
      else if (req.method() === 'PATCH') Object.assign(rows.find(r => r.id === id), snake(payload));
      else data[map[resource]] = rows.filter(r => r.id !== id);
    }
    await route.fulfill({ json: { profile: data.profile, ok: true } });
  });
  try {
    await page.goto(base + '/business');
    const modal = () => page.locator('[class*="modalOverlay"]');
    async function save() {
      await modal().getByRole('button', { name: 'Save Changes', exact: true }).click();
      await modal().waitFor({ state: 'hidden' });
    }
    await page.getByRole('button', { name: 'Edit Business Header', exact: true }).click();
    await page.getByLabel('Business Name', { exact: true }).fill('Local Test Shop');
    await page.getByLabel('Tagline', { exact: true }).fill('Local fixture');
    await save();
    assert.equal(requests.at(-1).method, 'POST');
    await page.reload();
    await page.getByRole('heading', { name: 'Local Test Shop', exact: true }).waitFor();
    for (const [button, label, value, key] of [
      ['Edit About Business', 'Business Description', 'Updated description', 'description'],
      ['Edit About Business Owner', 'Owner Information', 'Updated owner bio', 'owner_bio'],
      ['Edit Working Hours', 'Sunday', 'Closed', 'working_hours']
    ]) {
      await page.getByRole('button', { name: button, exact: true }).click();
      await page.getByLabel(label, { exact: true }).fill(value);
      await save();
      assert.equal(requests.at(-1).method, 'PATCH');
      assert.equal(key === 'working_hours' ? data.profile[key].Sunday : data.profile[key], value);
    }
    console.log('PASS (mock API): first business creation, profile edits and reload');
    data.staff_roles.push({ id: 'staff-1', role_name: 'Original role', description: 'Original description', staff_count: 4, active: true });
    await page.reload();
    await page.getByRole('button', { name: 'Staff', exact: true }).click();
    await page.locator('[class*="staffActions"] button').first().click();
    assert.equal(await page.getByLabel('Role Name', { exact: true }).inputValue(), 'Original role');
    await page.getByLabel('Role Name', { exact: true }).fill('Edited role');
    await page.getByLabel('Number of Employees').fill('0');
    await save();
    assert.equal(data.staff_roles[0].staff_count, 0);
    await page.getByRole('button', { name: 'Edit Existing Jobs' }).click();
    assert.equal(await page.getByLabel('Role Name', { exact: true }).inputValue(), '');
    await page.keyboard.press('Escape');
    console.log('PASS (mock API): correct staff draft, zero employees, clean add draft, Escape');
    await page.locator('footer button').filter({ hasText: /^Home$/ }).click();
    await page.getByRole('button', { name: 'Edit Business Banner' }).click();
    await page.getByLabel('Upload Image').setInputFiles({ name: 'test.png', mimeType: 'image/png', buffer: Buffer.from([1,2,3]) });
    await page.getByRole('alert').filter({ hasText: 'Test storage unavailable' }).waitFor();
    await page.keyboard.press('Escape');
    data.orders.push({ id: 'order-1', customer_name: 'Fixture', status: 'pending', items: [], total_amount: 10, address: 'Test', delivery_status: 'unassigned' });
    await page.reload();
    await page.getByRole('button', { name: '✓ Accept', exact: true }).click();
    await page.getByText('Delivery Boy Available?', { exact: true }).waitFor();
    assert.equal(data.orders[0].status, 'accepted');
    assert.deepEqual(errors, []);
    console.log('PASS (mock API): visible upload failure, accepted order retained, no browser exceptions');
  } catch (error) {
    console.log('Browser URL:', page.url());
    console.log('Browser exceptions:', JSON.stringify(errors));
    console.log('Visible page:', (await page.locator('body').innerText()).slice(0, 1600));
    throw error;
  } finally { await browser.close(); }
};
