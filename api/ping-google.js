// /api/ping-google.js
// Submits URLs to Google Indexing API for instant indexing.
// Called automatically by the cron job in vercel.json after every deploy.
// Uses GOOGLE_CLIENT_EMAIL and GOOGLE_PRIVATE_KEY from Vercel environment variables.
// Zero external dependencies — uses only Node.js built-ins.

const https  = require('https');
const crypto = require('crypto');

const DOMAIN = 'https://thepsychedelicdigest.com';

// All URLs to submit to Google on every run
// Blog post URLs are discovered dynamically from the posts/ folder
const STATIC_URLS = [
  '/',
  '/blog',
  '/glossary',
  '/legal-map',
  '/psyfinance',
  '/psilocybin',
  '/mdma',
  '/ketamine',
  '/research',
  '/policy',
];

// ── Google Auth ─────────────────────────────────────────────
// Builds a signed JWT and exchanges it for an access token.
// No external libraries needed — pure crypto.

function base64url(buf) {
  return buf.toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function getAccessToken() {
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  const privateKey  = process.env.GOOGLE_PRIVATE_KEY
    // Vercel stores \n as literal \\n in env vars — fix it
    ?.replace(/\\n/g, '\n');

  if (!clientEmail || !privateKey) {
    throw new Error('Missing GOOGLE_CLIENT_EMAIL or GOOGLE_PRIVATE_KEY env vars');
  }

  const now = Math.floor(Date.now() / 1000);
  const header  = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss:   clientEmail,
    scope: 'https://www.googleapis.com/auth/indexing',
    aud:   'https://oauth2.googleapis.com/token',
    iat:   now,
    exp:   now + 3600,
  };

  const signingInput =
    base64url(Buffer.from(JSON.stringify(header)))  + '.' +
    base64url(Buffer.from(JSON.stringify(payload)));

  const signature = crypto.createSign('RSA-SHA256')
    .update(signingInput)
    .sign(privateKey);

  const jwt = signingInput + '.' + base64url(signature);

  // Exchange JWT for access token
  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion:  jwt,
  }).toString();

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'oauth2.googleapis.com',
      path:     '/token',
      method:   'POST',
      headers:  { 'Content-Type': 'application/x-www-form-urlencoded' },
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.access_token) resolve(json.access_token);
          else reject(new Error('No access token: ' + data));
        } catch(e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ── Submit a single URL ──────────────────────────────────────
function submitUrl(url, token) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ url, type: 'URL_UPDATED' });
    const req  = https.request({
      hostname: 'indexing.googleapis.com',
      path:     '/v3/urlNotifications:publish',
      method:   'POST',
      headers:  {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${token}`,
      },
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ url, status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ── Discover blog post URLs from posts/ folder ───────────────
function getBlogUrls() {
  const fs   = require('fs');
  const path = require('path');
  const dir  = path.join(process.cwd(), 'posts');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.md'))
    .map(f => '/blog/' + f.replace('.md', ''));
}

// ── Main handler ─────────────────────────────────────────────
module.exports = async (req, res) => {
  // Security: only allow Vercel cron calls or your own manual calls
  const authHeader = req.headers['authorization'];
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const token    = await getAccessToken();
    const blogUrls = getBlogUrls();
    const allPaths = [...STATIC_URLS, ...blogUrls];
    const allUrls  = allPaths.map(p => DOMAIN + p);

    const results  = [];
    for (const url of allUrls) {
      // Small delay between requests to avoid rate limits
      await new Promise(r => setTimeout(r, 200));
      const result = await submitUrl(url, token);
      results.push(result);
      console.log(`Indexed: ${url} → ${result.status}`);
    }

    const ok      = results.filter(r => r.status === 200).length;
    const failed  = results.filter(r => r.status !== 200).length;

    return res.status(200).json({
      success: true,
      submitted: allUrls.length,
      ok,
      failed,
      results,
    });

  } catch(e) {
    console.error('Google Indexing error:', e.message);
    return res.status(500).json({ error: e.message });
  }
};
