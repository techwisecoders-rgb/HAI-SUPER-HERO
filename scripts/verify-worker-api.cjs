// Optional real-backend checks, called by verify-worker-ui.cjs --live-backend.
// Uses a server-issued visitor session, never an existing user's identity.
const assert = require('node:assert/strict');
const { createClient } = require('@supabase/supabase-js');
const { loadEnvConfig } = require('@next/env');
module.exports = async function verifyWorkerApi(base, root) {
  loadEnvConfig(root);
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  let sessionId;
  const media = [];
  try {
    const bootstrap = await fetch(base + '/api/session', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'bootstrap' }) });
    assert.equal(bootstrap.status, 200);
    sessionId = (await bootstrap.json()).sessionId;
    assert.match(sessionId, /^[0-9a-f-]{36}$/);
    const cookies = bootstrap.headers.getSetCookie().map(cookie => cookie.split(';')[0]).join('; ');
    assert.ok(cookies.includes(sessionId));
    async function request(url, options = {}) {
      const response = await fetch(base + url, { ...options, headers: { cookie: cookies, ...options.headers } });
      const data = await response.json();
      assert.ok(response.ok, `${url}: HTTP ${response.status}: ${data.error || 'Request failed'}`);
      return data;
    }
    async function patch(payload, expected) {
      const saved = await request('/api/worker/profile', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
      const reloaded = await request('/api/worker/profile');
      for (const [key, value] of Object.entries(expected)) {
        assert.deepEqual(saved.profile[key], value, `PATCH ${key}`);
        assert.deepEqual(reloaded.profile[key], value, `Reload ${key}`);
      }
    }
    assert.equal((await request('/api/worker/profile')).profile, null);
    const fields = { name: 'Worker UI verification fixture', phone: '0000000000', email: 'worker-ui@example.invalid', location: 'Test fixture only', qualification: 'Test qualification', experience: '3' };
    await patch(fields, fields);
    console.log('PASS: real backend profile creation, field editing, and reload');
    await patch({ profession: 'plumber' }, { profession: 'plumber' });
    await patch({ aboutText: 'Test about', workDescription: 'Test description' }, { about_text: 'Test about', work_description: 'Test description' });
    await patch({ skills: ['Test skill'] }, { skills: ['Test skill'] });
    await patch({ skills: [] }, { skills: [] });
    await patch({ featured: ['Test badge'], socialLinks: [{ label: 'Example', url: 'https://example.com/' }] }, { featured: ['Test badge'], social_links: [{ label: 'Example', url: 'https://example.com/' }] });
    await patch({ featured: [], socialLinks: [], aboutText: '', workDescription: '' }, { featured: [], social_links: [], about_text: '', work_description: '' });
    for (const available of [false, true]) await patch({ workAvailable: available }, { work_available: available });
    await patch({ works: [{ type: 'paragraph', content: 'Test paragraph' }] }, { works: [{ type: 'paragraph', content: 'Test paragraph' }] });
    await patch({ works: [] }, { works: [] });
    console.log('PASS: profession, descriptions, skills add/remove, featured/social add/remove, availability, paragraphs; persisted after every change');
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jZ9kAAAAASUVORK5CYII=', 'base64');
    async function upload(bytes, type, name) {
      const body = new FormData(); body.append('file', new Blob([bytes], { type }), name);
      const { url } = await request('/api/worker/profile/upload', { method: 'POST', body });
      const prefix = '/storage/v1/object/public/worker-media/';
      const pathname = new URL(url).pathname;
      assert.ok(pathname.startsWith(prefix + sessionId + '/'));
      media.push(decodeURIComponent(pathname.slice(prefix.length)));
      const downloaded = await fetch(url);
      assert.equal(downloaded.status, 200, 'Uploaded file must be publicly readable');
      assert.deepEqual(Buffer.from(await downloaded.arrayBuffer()), bytes);
      return url;
    }
    const image = await upload(png, 'image/png', 'worker-test.png');
    await patch({ profileImageUrl: image, backgroundImageUrl: image, resumeUrl: image, works: [{ type: 'image', content: image }] }, { profile_image_url: image, background_image_url: image, resume_url: image, works: [{ type: 'image', content: image }] });
    const pdf = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n');
    const resume = await upload(pdf, 'application/pdf', 'worker-test.pdf');
    await patch({ resumeUrl: resume }, { resume_url: resume });
    await patch({ resumeUrl: null, works: [] }, { resume_url: null, works: [] });
    console.log('PASS: real image/PDF storage upload and download; portrait, cover, resume, gallery persistence and removal');
  } finally {
    if (sessionId) {
      const errors = [];
      if (media.length) { const { error } = await supabase.storage.from('worker-media').remove(media); if (error) errors.push(error.message); }
      for (const [table, key] of [['worker_profiles', 'session_id'], ['sessions', 'id']]) {
        const { error } = await supabase.from(table).delete().eq(key, sessionId);
        if (error) errors.push(`${table}: ${error.message}`);
      }
      if (errors.length) throw new Error(`Fixture cleanup failed for session ${sessionId}: ${errors.join('; ')}`);
      console.log('PASS: isolated test profile, session, and uploaded objects cleaned up');
    }
  }
};
