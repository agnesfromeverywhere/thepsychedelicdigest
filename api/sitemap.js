// /api/sitemap.js — Auto-generates sitemap.xml from all posts in /posts/*.md
// Google crawls this automatically. New blog posts appear within 24-48 hours.
const fs   = require('fs');
const path = require('path');

const DOMAIN = 'https://thepsychedelicdigest.com';

// Static pages — ordered by SEO priority
const STATIC_PAGES = [
  { url: '/',             priority: '1.0', changefreq: 'daily'   },
  { url: '/blog',         priority: '0.9', changefreq: 'daily'   },
  { url: '/psilocybin',   priority: '0.9', changefreq: 'daily'   },
  { url: '/mdma',         priority: '0.9', changefreq: 'daily'   },
  { url: '/ketamine',     priority: '0.8', changefreq: 'daily'   },
  { url: '/ayahuasca',    priority: '0.8', changefreq: 'daily'   },
  { url: '/research',     priority: '0.8', changefreq: 'daily'   },
  { url: '/lsd',          priority: '0.7', changefreq: 'daily'   },
  { url: '/cannabis',     priority: '0.7', changefreq: 'daily'   },
  { url: '/policy',       priority: '0.7', changefreq: 'daily'   },
  { url: '/culture',      priority: '0.6', changefreq: 'daily'   },
  { url: '/jobs',         priority: '0.7', changefreq: 'weekly'  },
  { url: '/retreats',     priority: '0.7', changefreq: 'weekly'  },
  { url: '/collaborate',  priority: '0.6', changefreq: 'weekly'  },
  { url: '/glossary',     priority: '0.7', changefreq: 'monthly' },
  { url: '/legal-map',    priority: '0.7', changefreq: 'monthly' },
  { url: '/psyfinance',   priority: '0.6', changefreq: 'weekly'  },
];

// Normalise ANY date string to YYYY-MM-DD for Google
// Handles: 2026-04-29, 29/04/2026, April 29 2026, 29 Apr 2026, etc.
function toW3CDate(raw) {
  if (!raw) return null;
  const s = String(raw).trim();

  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // DD/MM/YYYY or MM/DD/YYYY — assume DD/MM/YYYY (Australian)
  const slashMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const [, dd, mm, yyyy] = slashMatch;
    const d = new Date(`${yyyy}-${mm.padStart(2,'0')}-${dd.padStart(2,'0')}`);
    if (!isNaN(d)) return d.toISOString().split('T')[0];
  }

  // Try native Date parse (handles "April 29 2026", "29 Apr 2026", ISO strings)
  const parsed = new Date(s);
  if (!isNaN(parsed)) return parsed.toISOString().split('T')[0];

  return null; // unparseable — caller will use today
}

function parseDateFromFrontmatter(raw) {
  const normalised = raw.replace(/\r\n/g, '\n');
  const match = normalised.match(/^---[\s\S]*?date:\s*([^\n]+)/);
  if (!match) return null;
  return toW3CDate(match[1].trim());
}

// Escape XML special characters in URLs
function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

module.exports = (req, res) => {
  const today   = new Date().toISOString().split('T')[0];
  const postsDir = path.join(process.cwd(), 'posts');
  let blogUrls  = [];

  // Read all blog posts
  if (fs.existsSync(postsDir)) {
    try {
      const files = fs.readdirSync(postsDir).filter(f => f.endsWith('.md'));
      blogUrls = files.map(file => {
        const slug    = file.replace('.md', '');
        const raw     = fs.readFileSync(path.join(postsDir, file), 'utf8');
        const lastmod = parseDateFromFrontmatter(raw) || today;
        return {
          url:        `/blog/${slug}`,
          priority:   '0.8',
          changefreq: 'monthly',
          lastmod,
        };
      }).sort((a, b) => b.lastmod.localeCompare(a.lastmod));
    } catch(e) {
      blogUrls = [];
    }
  }

  // Build URL entries
  const staticEntries = STATIC_PAGES.map(p => `  <url>
    <loc>${escapeXml(DOMAIN + p.url)}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`).join('\n');

  const blogEntries = blogUrls.map(p => `  <url>
    <loc>${escapeXml(DOMAIN + p.url)}</loc>
    <lastmod>${p.lastmod}</lastmod>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`).join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9
        http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">
${staticEntries}
${blogEntries}
</urlset>`;

  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=300');
  res.status(200).send(xml);
};
