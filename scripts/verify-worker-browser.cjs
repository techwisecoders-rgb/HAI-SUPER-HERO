// Real Chrome + real worker API. Creates and cleans up only its own session.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright-core');
const { createClient } = require('@supabase/supabase-js');
const { loadEnvConfig } = require('@next/env');
module.exports = async function verifyBrowser(base, root) {
  loadEnvConfig(root);
  const executablePath = process.env.WORKER_TEST_BROWSER || ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'].find(file => fs.existsSync(file));
  assert.ok(executablePath, 'Set WORKER_TEST_BROWSER to an installed Chromium browser');
  const browser = await chromium.launch({ executablePath, headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  let sessionId;
  const objects = [];
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', async response => {
    if (response.url().endsWith('/api/worker/profile/upload') && response.ok()) {
      const { url } = await response.json();
      objects.push(decodeURIComponent(new URL(url).pathname.split('/worker-media/')[1]));
    }
  });
  try {
    const response = await context.request.post(base + '/api/session', { data: { action: 'bootstrap' } });
    assert.equal(response.status(), 200);
    sessionId = (await response.json()).sessionId;
    assert.match(sessionId, /^[0-9a-f-]{36}$/);
    await page.goto(base + '/worker');
    await page.getByRole('button', { name: 'Edit profile', exact: true }).waitFor();
    await page.waitForFunction(() => !document.querySelector('button[aria-label="Edit profile"]').disabled);
    assert.equal(await page.locator('iframe').count(), 0);
    async function save(action, expected) {
      const pending = page.waitForResponse(r => r.url().endsWith('/api/worker/profile') && r.request().method() === 'PATCH');
      await action();
      const response = await pending;
      const body = await response.json();
      assert.ok(response.ok(), `Save failed (${response.status()}): ${body.error}`);
      for (const [key, value] of Object.entries(expected)) assert.deepEqual(body.profile[key], value);
      await page.reload();
      await page.waitForFunction(() => !document.querySelector('button[aria-label="Edit profile"]').disabled);
      const persisted = await context.request.get(base + '/api/worker/profile');
      const data = await persisted.json();
      for (const [key, value] of Object.entries(expected)) assert.deepEqual(data.profile[key], value, `Reload ${key}`);
    }
    await page.getByRole('button', { name: 'Edit profile', exact: true }).click();
    const dialog = page.getByRole('dialog');
    for (const [label, value] of [['Name', 'Browser Test Worker'], ['Phone', '0000000000'], ['Email', 'browser@example.invalid'], ['Address', 'Test only'], ['Qualification', 'Test certificate'], ['Years of experience', '2']]) await dialog.getByLabel(label, { exact: true }).fill(value);
    await save(() => dialog.getByRole('button', { name: 'Save Changes' }).click(), { name: 'Browser Test Worker', phone: '0000000000', email: 'browser@example.invalid', location: 'Test only', qualification: 'Test certificate', experience: '2' });
    assert.equal(await page.getByRole('heading', { level: 1 }).innerText(), 'Browser Test Worker');
    console.log('PASS: browser profile edit, real backend save, and page reload');
    await save(() => page.getByLabel('Profession', { exact: true }).selectOption('plumber'), { profession: 'plumber' });
    for (const [button, value, key] of [[/Edit .*About Yourself/, 'Browser about', 'about_text'], [/Edit .*Describe the work/, 'Browser description', 'work_description'], [/Edit .*Featured At/, 'Browser badge', 'featured']]) {
      await page.getByRole('button', { name: button }).click();
      await dialog.locator('textarea').fill(value);
      await save(() => dialog.getByRole('button', { name: 'Save Changes' }).click(), { [key]: key === 'featured' ? [value] : value });
    }
    await page.getByRole('button', { name: '＋ Add', exact: true }).click();
    await dialog.locator('textarea').fill('Browser skill');
    await save(() => dialog.getByRole('button', { name: 'Save Changes' }).click(), { skills: ['Browser skill'] });
    await save(() => page.getByRole('button', { name: 'Remove Browser skill' }).click(), { skills: [] });
    await page.getByRole('button', { name: /Edit .*Social Media/ }).click();
    await dialog.getByRole('button', { name: 'Add link' }).click();
    await dialog.getByLabel('Label', { exact: true }).fill('Example');
    await dialog.getByLabel('URL', { exact: true }).fill('https://example.com/');
    await save(() => dialog.getByRole('button', { name: 'Save Changes' }).click(), { social_links: [{ label: 'Example', url: 'https://example.com/' }] });
    await page.getByLabel('Add Description / Paragraph').fill('Browser paragraph');
    await save(() => page.getByRole('button', { name: '+ Add Paragraph' }).click(), { works: [{ type: 'paragraph', content: 'Browser paragraph' }] });
    await save(() => page.getByRole('button', { name: 'Delete work 1' }).click(), { works: [] });
    await page.getByRole('button', { name: 'Open work status' }).click();
    await save(() => page.getByRole('checkbox', { name: 'Duty availability' }).uncheck(), { work_available: false });
    console.log('PASS: browser profession, about, description, featured, skills, social, work paragraphs, and availability persist');

    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jZ9kAAAAASUVORK5CYII=', 'base64');
    for (const label of ['🖼️ Profile', '🌄 Cover', 'Upload your resume (PDF or image)', 'Upload your work photos']) {
      const input = label.startsWith('Upload') ? page.getByRole('button', { name: label, exact: true }).locator('input') : page.getByLabel(label, { exact: true });
      await save(() => input.setInputFiles({ name: 'browser-test.png', mimeType: 'image/png', buffer: png }), {});
    }
    const stored = (await (await context.request.get(base + '/api/worker/profile')).json()).profile;
    for (const field of ['profile_image_url', 'background_image_url', 'resume_url']) assert.ok(stored[field]?.includes('/worker-media/'));
    assert.equal(stored.works[0].type, 'image');
    await save(() => page.getByRole('button', { name: 'Remove resume' }).click(), { resume_url: null });
    await save(() => page.getByRole('button', { name: 'Delete work 1' }).click(), { works: [] });
    console.log('PASS: browser portrait, cover, resume, gallery uploads and removals');
    await page.getByRole('button', { name: 'Edit profile', exact: true }).click();
    await page.keyboard.press('Escape');
    assert.equal(await dialog.count(), 0);
    await page.getByRole('button', { name: 'Open work status' }).click();
    await page.getByRole('button', { name: /Past Activities/ }).click();
    assert.ok(await page.getByText('No activity or review history is available from the worker API.').isVisible());
    await page.getByRole('button', { name: /Payment Status/ }).click();
    assert.ok(await page.getByText(/Payment history and balances are not available/).isVisible());
    await page.getByRole('button', { name: '← Back', exact: true }).click();
    await page.getByRole('button', { name: 'Notifications and job requests' }).click();
    for (const name of [/Most Urgent/, /Normal Requests/, /^All/]) await page.getByRole('button', { name }).click();
    assert.ok(await page.getByText(/Job-request data is not connected yet/).isVisible());
    await page.getByRole('button', { name: '← Back', exact: true }).click();
    await page.getByRole('button', { name: 'View ID', exact: true }).click();
    assert.ok(await page.getByRole('status').filter({ hasText: 'Worker ID Card is not available' }).isVisible());
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: path.join(root, 'worker-browser-mobile.png'), fullPage: true });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Mobile horizontal overflow');
    assert.deepEqual(errors, [], 'Browser runtime errors');
    console.log('PASS: modal Escape, status/history/job tabs, unavailable document notice, mobile overflow, no runtime errors');
  } catch (error) {
    console.error('Browser verification failed:', error.message);
    throw error;
  } finally {
    await browser.close();
    if (sessionId) {
      const cleanupErrors = [];
      if (objects.length) { const { error } = await supabase.storage.from('worker-media').remove(objects); if (error) cleanupErrors.push(error.message); }
      for (const [table, key] of [['worker_profiles', 'session_id'], ['sessions', 'id']]) {
        const { error } = await supabase.from(table).delete().eq(key, sessionId);
        if (error) cleanupErrors.push(`${table}: ${error.message}`);
      }
      if (cleanupErrors.length) throw new Error(`Cleanup failed for browser fixture ${sessionId}: ${cleanupErrors.join('; ')}`);
      console.log('PASS: browser fixture data cleaned up');
    }
  }
};
