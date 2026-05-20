// /api/blog.js

const fs = require('fs');
const path = require('path');

const POSTS_DIR = path.join(process.cwd(), 'posts');

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function slugify(value = '') {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, '');
}

function estimateReadTime(text = '') {
  const words = String(text).trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200)) + ' min read';
}

function parseFrontmatter(raw = '') {
  const text = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();

  const match = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);

  if (!match) {
    return { meta: {}, body: text };
  }

  const meta = {};

  match[1].split('\n').forEach(line => {
    const separator = line.indexOf(':');
    if (separator === -1) return;

    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();

    meta[key] = value.replace(/^["']|["']$/g, '');
  });

  return {
    meta,
    body: match[2].trim()
  };
}

function inlineMarkdown(text = '') {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(
      /\[(.+?)\]\((https?:\/\/[^\s)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
    );
}

function mdToHtml(markdown = '') {
  const blocks = markdown
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split(/\n{2,}/);

  return blocks
    .map(block => {
      const lines = block.trim().split('\n');
      if (!block.trim()) return '';

      if (/^---+$/.test(block.trim())) {
        return '<hr>';
      }

      if (block.startsWith('### ')) {
        return `<h3>${inlineMarkdown(block.replace(/^### /, ''))}</h3>`;
      }

      if (block.startsWith('## ')) {
        return `<h2>${inlineMarkdown(block.replace(/^## /, ''))}</h2>`;
      }

      if (block.startsWith('# ')) {
        return `<h1>${inlineMarkdown(block.replace(/^# /, ''))}</h1>`;
      }

      if (lines.every(line => line.trim().startsWith('- '))) {
        const items = lines
          .map(line => `<li>${inlineMarkdown(line.trim().replace(/^- /, ''))}</li>`)
          .join('');

        return `<ul>${items}</ul>`;
      }

      if (block.startsWith('> ')) {
        return `<blockquote>${inlineMarkdown(block.replace(/^> /gm, ''))}</blockquote>`;
      }

      return `<p>${inlineMarkdown(block.replace(/\n/g, ' '))}</p>`;
    })
    .join('\n');
}

function buildPostFromMarkdown(slug, raw) {
  const parsed = parseFrontmatter(raw);
  const { meta, body } = parsed;

  return {
    slug,
    title: meta.title || slug,
    date: meta.date || '',
    author: meta.author || 'The Psychedelic Digest',
    excerpt: meta.excerpt || body.slice(0, 160).replace(/\n/g, ' ') + '...',
    category: meta.category || 'Research',
    image: meta.image || '',
    tags: meta.tags ? meta.tags.split(',').map(tag => tag.trim()).filter(Boolean) : [],
    readTime: estimateReadTime(body),
    html: mdToHtml(body)
  };
}

const FALLBACK_POSTS = {
  'psychedelics-vs-antidepressants-study-2026': {
    title: 'The New Study Says Psychedelics Are No Better Than Antidepressants. Here Is What It Actually Means.',
    date: '2026-03-22',
    author: 'Agnes Horry',
    excerpt: 'A study published this week in JAMA Psychiatry says psilocybin is no more effective than antidepressants. Before the internet implodes, here is what it actually found.',
    category: 'Research',
    image: '',
    tags: ['psilocybin', 'antidepressants', 'clinical trials', 'depression', 'JAMA'],
    body: `A study dropped this week in JAMA Psychiatry and the headline has been making the rounds: psychedelics are no better than antidepressants for depression.

I have seen this framed as a takedown of the entire field. It is not. But it is worth reading carefully, because the nuance matters.

## What the Study Actually Did

Researchers tackled a fundamental problem in psychedelic research: the placebo problem.

When you take psilocybin, you know you took psilocybin. The altered state makes blinding essentially impossible.

## What This Does Not Mean

It does not mean psychedelics do not work.

Both treatments produced substantial, real improvements in depression.

## What It Does Mean

It means the field needs to take the expectation effect more seriously.

The stronger argument for psychedelics has never been depression scale scores alone. The stronger argument is durability.

---

*This article is for informational purposes only and does not constitute medical advice.*`
  }
};

function buildFallbackPost(slug, fallback, includeHtml = false) {
  const post = {
    slug,
    title: fallback.title,
    date: fallback.date,
    author: fallback.author,
    excerpt: fallback.excerpt,
    category: fallback.category,
    image: fallback.image || '',
    tags: fallback.tags || [],
    readTime: estimateReadTime(fallback.body || '')
  };

  if (includeHtml) {
    post.html = mdToHtml(fallback.body || '');
  }

  return post;
}

function getMarkdownPost(slug) {
  if (!fs.existsSync(POSTS_DIR)) return null;

  const safeSlug = slugify(slug);
  const filePath = path.join(POSTS_DIR, safeSlug + '.md');

  if (!filePath.startsWith(POSTS_DIR + path.sep)) return null;
  if (!fs.existsSync(filePath)) return null;

  const raw = fs.readFileSync(filePath, 'utf8');
  return buildPostFromMarkdown(safeSlug, raw);
}

function getAllMarkdownPosts() {
  if (!fs.existsSync(POSTS_DIR)) return [];

  return fs
    .readdirSync(POSTS_DIR)
    .filter(file => file.endsWith('.md'))
    .map(file => {
      const slug = file.replace(/\.md$/, '');
      const raw = fs.readFileSync(path.join(POSTS_DIR, file), 'utf8');
      const post = buildPostFromMarkdown(slug, raw);
      delete post.html;
      return post;
    });
}

module.exports = (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=60');
  res.setHeader('Access-Control-Allow-Origin', '*');

  const slug = req.query?.slug ? slugify(req.query.slug) : '';

  if (slug) {
    const postFromFile = getMarkdownPost(slug);

    if (postFromFile) {
      return res.status(200).json(postFromFile);
    }

    const fallback = FALLBACK_POSTS[slug];

    if (fallback) {
      return res.status(200).json(buildFallbackPost(slug, fallback, true));
    }

    return res.status(404).json({ error: 'Post not found' });
  }

  const markdownPosts = getAllMarkdownPosts();
  const existingSlugs = new Set(markdownPosts.map(post => post.slug));

  const fallbackPosts = Object.entries(FALLBACK_POSTS)
    .filter(([slug]) => !existingSlugs.has(slug))
    .map(([slug, post]) => buildFallbackPost(slug, post, false));

  const posts = [...markdownPosts, ...fallbackPosts].sort((a, b) => {
    return new Date(b.date || 0) - new Date(a.date || 0);
  });

  return res.status(200).json({ posts });
};
