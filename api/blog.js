// /api/blog.js — Serve blog posts from /posts/*.md with fallback posts

const fs = require('fs');
const path = require('path');

// ─── Markdown → HTML ─────────────────────────────────────────
function mdToHtml(md = '') {
  return md
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
    .replace(/^---$/gm, '<hr>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
    .split(/\n\n+/)
    .map(block => {
      block = block.trim();
      if (!block) return '';
      if (/^<(h[1-6]|ul|blockquote|hr)/.test(block)) return block;
      return `<p>${block.replace(/\n/g, ' ')}</p>`;
    })
    .join('\n');
}

// ─── Frontmatter parser ───────────────────────────────────────
function parseFrontmatter(raw = '') {
  const normalised = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();

  const match = normalised.match(/^---[ \t]*\n([\s\S]*?)\n---[ \t]*(?:\n|$)([\s\S]*)$/);

  if (!match) {
    return { meta: {}, body: normalised };
  }

  const meta = {};
  const lines = match[1].split('\n');
  let currentKey = null;

  lines.forEach(line => {
    const trimmed = line.trim();
    if (!trimmed) return;

    if (trimmed.startsWith('- ') && currentKey) {
      if (!Array.isArray(meta[currentKey])) meta[currentKey] = [];
      meta[currentKey].push(
        trimmed.slice(2).trim().replace(/^["']|["']$/g, '')
      );
      return;
    }

    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) return;

    const key = line.slice(0, colonIndex).trim();
    const value = line
      .slice(colonIndex + 1)
      .trim()
      .replace(/^["']|["']$/g, '');

    currentKey = key;
    meta[key] = value === '' ? [] : value;
  });

  return {
    meta,
    body: match[2].trim()
  };
}

function estimateReadTime(text = '') {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return `${Math.max(1, Math.round(words / 200))} min read`;
}

function normaliseTags(tags) {
  if (Array.isArray(tags)) return tags;
  if (typeof tags === 'string') {
    return tags.split(',').map(t => t.trim()).filter(Boolean);
  }
  return [];
}

function buildPostObject({ slug, meta, body, includeHtml = false }) {
  const post = {
    slug,
    title: meta.title || slug,
    date: meta.date || '',
    author: meta.author || 'The Psychedelic Digest',
    excerpt: meta.excerpt || `${body.slice(0, 160).replace(/\n/g, ' ')}...`,
    category: meta.category || 'Research',
    image: meta.image || '',
    tags: normaliseTags(meta.tags),
    readTime: meta.readTime || estimateReadTime(body)
  };

  if (includeHtml) {
    post.html = mdToHtml(body);
  }

  return post;
}

// ─── Hardcoded fallback posts ─────────────────────────────────
// Keep your existing FALLBACK_POSTS object here exactly as it already is.
const FALLBACK_POSTS = {
  // Paste your existing fallback posts here.
};

// ─── Main handler ─────────────────────────────────────────────
module.exports = (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=60');
  res.setHeader('Access-Control-Allow-Origin', '*');

  const postsDir = path.join(process.cwd(), 'posts');
  const slug = req.query && req.query.slug;

  // ── Single post ─────────────────────────────────────────────
  if (slug) {
    const safe = slug.replace(/[^a-zA-Z0-9-_]/g, '');

    if (!safe) {
      return res.status(400).json({ error: 'Invalid slug' });
    }

    if (fs.existsSync(postsDir)) {
      const filePath = path.join(postsDir, `${safe}.md`);

      if (filePath.startsWith(postsDir + path.sep) && fs.existsSync(filePath)) {
        try {
          const raw = fs.readFileSync(filePath, 'utf8');
          const parsed = parseFrontmatter(raw);

          const post = buildPostObject({
            slug: safe,
            meta: parsed.meta,
            body: parsed.body,
            includeHtml: true
          });

          return res.status(200).json(post);
        } catch (e) {
          console.error('Error reading post:', e);
        }
      }
    }

    const fb = FALLBACK_POSTS[safe];

    if (fb) {
      return res.status(200).json({
        slug: safe,
        title: fb.title,
        date: fb.date,
        author: fb.author,
        excerpt: fb.excerpt,
        category: fb.category,
        image: fb.image || '',
        tags: fb.tags || [],
        readTime: estimateReadTime(fb.body || ''),
        html: mdToHtml(fb.body || '')
      });
    }

    return res.status(404).json({ error: 'Post not found' });
  }

  // ── Post list ───────────────────────────────────────────────
  const postsFromFiles = [];

  if (fs.existsSync(postsDir)) {
    try {
      fs.readdirSync(postsDir)
        .filter(file => file.endsWith('.md'))
        .forEach(file => {
          const safeFile = file.replace(/[^a-zA-Z0-9-_.]/g, '');
          const slug = safeFile.replace(/\.md$/, '');
          const raw = fs.readFileSync(path.join(postsDir, safeFile), 'utf8');
          const parsed = parseFrontmatter(raw);

          postsFromFiles.push(
            buildPostObject({
              slug,
              meta: parsed.meta,
              body: parsed.body,
              includeHtml: false
            })
          );
        });
    } catch (e) {
      console.error('Error loading posts:', e);
    }
  }

  const fileSlugs = new Set(postsFromFiles.map(p => p.slug));

  const fallbackPosts = Object.entries(FALLBACK_POSTS)
    .filter(([slug]) => !fileSlugs.has(slug))
    .map(([slug, fb]) => ({
      slug,
      title: fb.title,
      date: fb.date,
      author: fb.author,
      excerpt: fb.excerpt,
      category: fb.category,
      image: fb.image || '',
      tags: fb.tags || [],
      readTime: estimateReadTime(fb.body || '')
    }));

  const posts = [...postsFromFiles, ...fallbackPosts]
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  return res.status(200).json({ posts });
};
