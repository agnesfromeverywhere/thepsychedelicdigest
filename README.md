[README.md](https://github.com/user-attachments/files/28620364/README.md)
# The Psychedelic Digest — Blog System

> A zero-database, zero-CMS blog built on Markdown files and a Vercel serverless function. Write in GitHub, publish in 30 seconds. No login. Nothing to hack.

## Live URL
https://thepsychedelicdigest.com/blog

## Overview

The Psychedelic Digest is a psychedelic therapy news site at thepsychedelicdigest.com. This blog system adds original editorial content alongside the curated news feed, building topical authority and SEO value directly on the domain.

Posts are plain `.md` files stored in the `posts/` folder of this repo. A Vercel serverless function at `/api/blog.js` reads them on request and returns parsed JSON. The frontend renders them client-side with full URL routing, SEO meta tags, and a clean reading experience that matches the site's dark editorial aesthetic.

## Tech Stack

- Vanilla HTML / CSS / JS (single `index.html` — no framework)
- Vercel serverless functions (Node.js)
- GitHub as the content store (the `posts/` folder)
- Markdown files as posts (no database, no CMS)
- `vercel.json` rewrites for clean URL routing

## Features

- Blog index at `/blog` — card grid showing all posts sorted newest first
- Individual post pages at `/blog/your-slug` — full article with formatted body
- URL routing with `history.pushState` — back button works, links are shareable
- Per-post SEO: `<title>` and `<meta description>` update dynamically on each post
- Estimated read time calculated automatically
- Category badges and tag support
- Back to Blog navigation
- Mobile responsive
- Zero attack surface — read-only file serving, no user input, no auth

## How to Publish a Post

1. Write a `.md` file with the correct frontmatter (see format below)
2. Name it using lowercase hyphens and include the year: `your-slug-2026.md`
3. Upload to the `posts/` folder in this GitHub repo
4. Commit directly to `main`
5. Vercel deploys in ~30 seconds
6. Post is live at `thepsychedelicdigest.com/blog/your-slug-2026`

## Post Frontmatter Format

Every `.md` file must start with this block:

```markdown
---
title: Your Article Title Here
date: 2026-03-21
author: Agnes Horry
excerpt: One or two sentence summary shown on the blog index and in meta descriptions. Keep under 160 characters.
category: Research
image: https://thepsychedelicdigest.com/images/your-image.jpg
tags: psilocybin, depression, clinical trial
---

Article body starts here...
```

### Notes on frontmatter fields
- `title` — wrap in quotes if it contains a colon
- `date` — no quotes, format YYYY-MM-DD
- `author` — always `Agnes Horry` (byline displays as Agnes only)
- `excerpt` — under 160 characters, no quotes needed
- `category` — must be one of the valid categories below
- `image` — full URL to image hosted in `/images` folder; use `https://thepsychedelicdigest.com/images/your-image.jpg`; leave blank if no image
- `tags` — comma-separated, no quotes
- **No H1 in the article body** — the title renders from frontmatter; an H1 in the body will bleed into card excerpts

### Valid categories
`Research` · `Policy` · `Culture` · `Personal` · `Guides` · `Finance`

## File Structure

```
thepsychedelicdigest/
├── index.html                              Main SPA — all UI, routing, and rendering
├── vercel.json                             URL rewrites + security headers
├── api/
│   ├── rss.js                              Fetches Google News RSS (curated news feed)
│   └── blog.js                             Serves blog posts from /posts/*.md
├── images/
│   └── your-image.jpg                      Blog card images
└── posts/
    ├── australia-psilocybin-approval-2026.md
    └── microdosing-science-2026.md
```

## URL Routes

| URL | Content |
|-----|---------|
| `/` | News feed (All topics) |
| `/psilocybin` | Psilocybin news filter |
| `/blog` | Blog index — all posts |
| `/blog/your-slug` | Individual blog post |
| `/jobs` | Jobs board |
| `/retreats` | Retreat directory |
| `/legal-map` | Global legal status table |
| `/glossary` | Psychedelic therapy glossary |
| `/psyfinance` | Industry funding and deals |

## API Endpoints

### `GET /api/blog`
Returns a list of all posts (metadata only, no body).

```json
{
  "posts": [
    {
      "slug": "australia-psilocybin-approval-2026",
      "title": "Australia's Psilocybin Approval...",
      "date": "2026-03-15",
      "author": "Agnes Horry",
      "excerpt": "...",
      "category": "Policy",
      "image": "https://thepsychedelicdigest.com/images/your-image.jpg",
      "readTime": "4 min read"
    }
  ]
}
```

### `GET /api/blog?slug=your-slug`
Returns full post including rendered HTML body.

## Deployment

GitHub `main` branch connects to Vercel. Every commit to `main` triggers an automatic deployment. No manual steps. Typically live within 30 seconds of committing.

## Security

- No user input accepted anywhere in the blog system
- No database, no authentication, no sessions
- Posts are read-only static files served from the repo
- Path traversal protection in `blog.js` — slug is sanitized before file access
- All responses include `X-Content-Type-Options: nosniff`
- Security headers set globally in `vercel.json`

## SEO Intent

Every blog post gets its own canonical URL, unique `<title>`, and `<meta description>` (sourced from the frontmatter `excerpt` field). The goal is topical authority for psychedelic therapy keywords on thepsychedelicdigest.com, improving domain ranking and AI answer engine citation frequency.

Target keyword clusters: psilocybin therapy, MDMA therapy, psychedelic research, microdosing, psychedelic policy, ketamine therapy Australia.

## Roadmap

- [ ] Sitemap auto-generation (`/sitemap.xml`) for Google Search Console
- [ ] RSS feed for blog posts (`/blog/rss.xml`)
- [ ] Related posts suggestions at end of each article
- [ ] Category filter on the blog index page
- [ ] Open Graph image per post

## Author

Agnes Horry — [thepsychedelicdigest.com](https://thepsychedelicdigest.com)
Published author: [The Microdosing Guidebook](https://www.amazon.com.au/dp/0645763209)

## License

All Rights Reserved. Content and code are proprietary.
