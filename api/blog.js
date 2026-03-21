// /api/blog.js — Serverless function to serve blog posts from /posts/*.md
// Zero database. Zero auth. Read-only. Nothing to hack.

const fs   = require('fs');
const path = require('path');

// Tiny Markdown → HTML converter (no dependencies)
function mdToHtml(md) {
  return md
    // Headings
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm,  '<h2>$1</h2>')
    .replace(/^# (.+)$/gm,   '<h1>$1</h1>')
    // Bold / italic
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g,     '<em>$1</em>')
    // Links
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    // Blockquotes
    .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
    // Horizontal rule
    .replace(/^---$/gm, '<hr>')
    // Unordered lists (simple)
    .replace(/^\- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
    // Line breaks → paragraphs (double newline)
    .split(/\n\n+/)
    .map(block => {
      block = block.trim();
      if (!block) return '';
      if (/^<(h[1-6]|ul|blockquote|hr)/.test(block)) return block;
      return `<p>${block.replace(/\n/g, ' ')}</p>`;
    })
    .join('\n');
}

// Parse frontmatter from a .md file
// Handles: CRLF line endings, trailing spaces on ---, missing final newline
function parseFrontmatter(raw) {
  // Normalise line endings first
  const normalised = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  // Match --- block at start, tolerating trailing whitespace on the closing ---
  const match = normalised.match(/^---[ \t]*\n([\s\S]*?)\n---[ \t]*(?:\n|$)([\s\S]*)$/);
  if (!match) return { meta: {}, body: normalised };

  const meta = {};
  match[1].split('\n').forEach(line => {
    const [key, ...rest] = line.split(':');
    if (key && rest.length) {
      meta[key.trim()] = rest.join(':').trim().replace(/^["']|["']$/g, '');
    }
  });

  return { meta, body: match[2].trim() };
}

function estimateReadTime(text) {
  const words = text.split(/\s+/).length;
  return Math.max(1, Math.round(words / 200)) + ' min read';
}

// GET /api/blog         → list of all posts (no body, just metadata)
// GET /api/blog?slug=x  → single post with full HTML body
module.exports = (req, res) => {
  // Security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=60');
  res.setHeader('Access-Control-Allow-Origin', '*');

  const postsDir = path.join(process.cwd(), 'posts');

  // Guard: posts directory must exist
  if (!fs.existsSync(postsDir)) {
    return res.status(200).json({ posts: [] });
  }

  const slug = req.query && req.query.slug;

  // ── Single post ──────────────────────────────────────────
  if (slug) {
    // Sanitize slug — only allow alphanumeric, hyphens, underscores
    const safe = slug.replace(/[^a-zA-Z0-9\-_]/g, '');
    if (!safe) return res.status(400).json({ error: 'Invalid slug' });

    const filePath = path.join(postsDir, safe + '.md');

    // Ensure the resolved path stays within postsDir (path traversal guard)
    if (!filePath.startsWith(postsDir + path.sep)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const raw = fs.readFileSync(filePath, 'utf8');
    const { meta, body } = parseFrontmatter(raw);

    return res.status(200).json({
      slug: safe,
      title:       meta.title       || safe,
      date:        meta.date        || '',
      author:      meta.author      || 'The Psychedelic Digest',
      excerpt:     meta.excerpt     || body.slice(0, 160).replace(/\n/g, ' ') + '...',
      category:    meta.category    || 'Research',
      tags:        meta.tags        ? meta.tags.split(',').map(t => t.trim()) : [],
      readTime:    estimateReadTime(body),
      html:        mdToHtml(body),
    });
  }

  // ── Post list ────────────────────────────────────────────
  let files;
  try {
    files = fs.readdirSync(postsDir).filter(f => f.endsWith('.md'));
  } catch (e) {
    return res.status(200).json({ posts: [] });
  }

  const posts = files
    .map(file => {
      const slug    = file.replace('.md', '');
      const raw     = fs.readFileSync(path.join(postsDir, file), 'utf8');
      const { meta, body } = parseFrontmatter(raw);
      return {
        slug,
        title:    meta.title    || slug,
        date:     meta.date     || '',
        author:   meta.author   || 'The Psychedelic Digest',
        excerpt:  meta.excerpt  || body.slice(0, 160).replace(/\n/g, ' ') + '...',
        category: meta.category || 'Research',
        tags:     meta.tags     ? meta.tags.split(',').map(t => t.trim()) : [],
        readTime: estimateReadTime(body),
      };
    })
    // Sort newest first
    .sort((a, b) => (b.date > a.date ? 1 : -1));

  return res.status(200).json({ posts });
};
