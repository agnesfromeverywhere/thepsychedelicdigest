// /api/blog.js — Serverless function to serve blog posts from /posts/*.md
// Zero database. Zero auth. Read-only. Nothing to hack.

const fs   = require('fs');
const path = require('path');

// ─── Markdown → HTML ─────────────────────────────────────────
function mdToHtml(md) {
  return md
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm,  '<h2>$1</h2>')
    .replace(/^# (.+)$/gm,   '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g,     '<em>$1</em>')
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/^> (.+)$/gm,   '<blockquote>$1</blockquote>')
    .replace(/^---$/gm,      '<hr>')
    .replace(/^\- (.+)$/gm,  '<li>$1</li>')
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
// Handles CRLF, trailing spaces, missing final newline
// Returns null if content looks like a GitHub attachment link (not a real post)
function parseFrontmatter(raw) {
  const normalised = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();

  // Detect GitHub attachment uploads — content starts with a markdown link to github.com
  if (normalised.startsWith('[') && normalised.includes('github.com/user-attachments')) {
    return null; // signal: this file was uploaded wrong
  }

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

// ─── Hardcoded fallback posts ─────────────────────────────────
// Used when .md files are missing or were uploaded incorrectly.
// Delete a fallback entry once the real .md file is in /posts/ correctly.
const FALLBACK_POSTS = {
  'psychedelics-vs-antidepressants-study-2026': {
    title:    'The New Study Says Psychedelics Are No Better Than Antidepressants. Here Is What It Actually Means.',
    date:     '2026-03-22',
    author:   'Agnes Horry',
    excerpt:  'A study published this week in JAMA Psychiatry says psilocybin is no more effective than antidepressants. Before the internet implodes, here is what it actually found.',
    category: 'Research',
    image:    '',
    tags:     ['psilocybin','antidepressants','clinical trials','depression','JAMA'],
    body: `A study dropped this week in JAMA Psychiatry and the headline has been making the rounds: psychedelics are no better than antidepressants for depression.

I have seen this framed as a takedown of the entire field. It is not. But it is worth reading carefully, because the nuance matters.

## What the Study Actually Did

Researchers from UC San Francisco, UCLA, and Imperial College London tackled a fundamental problem in psychedelic research: the placebo problem.

When you take psilocybin, you know you took psilocybin. The altered state makes blinding essentially impossible. Nearly everyone in a psilocybin trial knows they received the real thing. This inflates the apparent effect, because expectation alone can drive significant improvements in depression scores.

So the researchers compared psychedelic trials against open-label antidepressant trials, where participants also knew they were taking the real drug. Equal conditions. Same unblinding on both sides.

The result: both groups improved by about 12 points on standard depression scales. No significant difference.

[Read the full study in JAMA Psychiatry](https://jamanetwork.com/journals/jamapsychiatry/article-abstract/2832557)

## What This Does Not Mean

It does not mean psychedelics do not work.

Both treatments produced substantial, real improvements in depression. People got better. That matters.

It does not mean the existing psychedelic trial results were wrong. The improvements were real. The question this study raises is whether the expectation effect was carrying more weight than previously understood.

## What It Does Mean

It means the field needs to take the expectation effect more seriously than it has.

The stronger argument for psychedelics has never been depression scale scores at 12 weeks. The stronger argument is durability. Antidepressants require daily dosing, often indefinitely. A course of psilocybin therapy involves one or two sessions. In multiple studies, remission has persisted for months to years.

That durability argument was not tested by this study. It is the right question to be asking.

## The Honest Position

The honest position is that we do not yet have a clean answer.

Psychedelic therapy shows real promise. The durability data is compelling. But the methodology of many early trials was not as rigorous as it needed to be, and a study like this is a legitimate corrective.

The right lesson is: do better trials. Build the evidence base properly. And do not let expectation do all the work.

---

*This article is for informational purposes only and does not constitute medical advice. Always consult a qualified healthcare provider.*`,
  },

  'microdosing-science-2026': {
    title:    'Microdosing in 2026: What the Science Actually Says',
    date:     '2026-03-10',
    author:   'Agnes Horry',
    excerpt:  'Microdosing has moved from Silicon Valley productivity hack to serious academic research. Here is what the evidence actually shows, and what it does not.',
    category: 'Research',
    image:    '',
    tags:     ['microdosing','psilocybin','research','science','mental health'],
    body: `Microdosing has moved from Silicon Valley productivity hack to a topic of serious academic inquiry.

But the evidence is messier than the headlines suggest.

## What Is Microdosing?

Microdosing means taking sub-perceptual doses of a psychedelic substance, typically one-tenth of a full dose, on a regular schedule. The goal is no hallucinations, no significant perceptual changes. Just a subtle shift in cognition or mood that does not interrupt daily life.

A standard microdose of psilocybin mushrooms is typically **0.1 to 0.3 grams** of dried material. Common protocols involve dosing every third day (the Fadiman protocol) or every other day, over several weeks.

For a deeper dive into the origins of this practice, I put together [a brief history of microdosing](https://tr.ee/ylz8JNGZiz) that traces how we got from indigenous plant medicine traditions to startup culture to clinical trials.

## What Does the Research Show?

The honest answer: promising, but not yet definitive.

Observational studies consistently show that people who microdose report improvements in mood, focus, creativity, and emotional regulation. A 2021 Imperial College London study tracking nearly 200 microdosers found self-reported improvements across these domains over six weeks.

But observational data has a fundamental problem: people who choose to microdose believe it will work. That belief alone can produce real improvements. Expectation is a powerful neurological mechanism.

The few blinded randomised controlled trials conducted so far have produced mixed results. Some show modest benefits over placebo. Others show no statistically significant difference.

## Why Is It So Difficult to Study?

Several structural problems make microdosing research genuinely hard:

- It remains illegal in most jurisdictions, limiting who can run formal trials
- Blinding participants is nearly impossible because people often know whether they took a real dose
- Effects are subtle and self-reported, resisting objective measurement
- Most trials have been small, with under 100 participants

## My Take

I have been in this space for over four years. I wrote [The Microdosing Guidebook](https://www.amazon.com.au/dp/0645763209) specifically because I saw how many people were approaching microdosing without structure, without honest information, and without realistic expectations.

The approach I took in the book is practical rather than evangelical. Microdosing is not a cure. The evidence base is still being built. But for many people, approached carefully with the right framework, it has produced genuine and lasting improvements in quality of life.

The science will catch up. The lived experience is already there.

## What to Watch in 2026

Several well-designed trials are currently underway that should produce cleaner data over the next 12 to 18 months. As legal frameworks evolve in Australia, Canada, and parts of the United States, properly blinded studies are becoming more feasible for the first time.

---

*This article is for informational purposes only. Psilocybin remains a controlled substance in most jurisdictions. This is not medical advice.*`,
  },

  'australia-psilocybin-approval-2026': {
    title:    "Australia's Psilocybin Approval: What It Means for Patients in 2026",
    date:     '2026-03-15',
    author:   'Agnes Horry',
    excerpt:  "In July 2023, Australia became the first country to officially approve psilocybin as a medicine. Here is what that means in practice for patients today.",
    category: 'Policy',
    image:    '',
    tags:     ['psilocybin','australia','tga','policy','access'],
    body: `In July 2023, Australia's Therapeutic Goods Administration (TGA) made history by becoming the first national regulator to approve psychedelic substances for therapeutic use. Psilocybin received approval for treatment-resistant depression. MDMA received approval for PTSD.

Three years later, access remains limited. But the framework is real, and it is expanding.

## Who Can Prescribe?

Only Authorised Prescribers, psychiatrists who have applied for and received specific TGA authorisation, can prescribe psilocybin. As of early 2026, there are fewer than 100 in the country.

This bottleneck is deliberate. The TGA wants clinical oversight at every step. But it is also the primary reason most Australians cannot yet access treatment.

## What Does the Treatment Look Like?

A typical course of psilocybin-assisted therapy in Australia involves:

- Two to three preparation sessions with a trained therapist
- One or two dosing sessions (25mg psilocybin) in a clinical setting, with two therapists present
- Integration sessions afterward to process the experience

The entire course takes four to eight weeks.

## What Does It Cost?

This is the hard reality. A full course of treatment currently costs between **$15,000 and $25,000 AUD** out of pocket. Medicare does not yet cover it. Private health insurance rarely does.

The TGA approval was a regulatory milestone, not a healthcare access milestone. Those are different things.

## What Does the Research Show?

The evidence base is robust. A 2025 Imperial College study found psilocybin produced greater remission rates than escitalopram at six months. Compass Pathways Phase 3 trial reported meaningful response rates in treatment-resistant depression.

The science is not the obstacle. Access, cost, and trained practitioners are.

## What to Watch in 2026

Several things are moving. A coalition of psychiatrists is lobbying for Medicare item numbers. Community organisations like Mind Medicine Australia continue to fund training programs for practitioners.

Australia showed the world it could be done. The next question is whether it can be done equitably.

---

*This article is for informational purposes only and does not constitute medical advice. Always consult a qualified healthcare provider.*`,
  },
};

// ─── Main handler ─────────────────────────────────────────────
module.exports = (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=60');
  res.setHeader('Access-Control-Allow-Origin', '*');

  const postsDir = path.join(process.cwd(), 'posts');
  const slug     = req.query && req.query.slug;

  // ── Single post ──────────────────────────────────────────
  if (slug) {
    const safe = slug.replace(/[^a-zA-Z0-9\-_]/g, '');
    if (!safe) return res.status(400).json({ error: 'Invalid slug' });

    // Try reading from file first
    if (fs.existsSync(postsDir)) {
      const filePath = path.join(postsDir, safe + '.md');
      if (filePath.startsWith(postsDir + path.sep) && fs.existsSync(filePath)) {
        const raw    = fs.readFileSync(filePath, 'utf8');
        const parsed = parseFrontmatter(raw);
        if (parsed) {
          const { meta, body } = parsed;
          return res.status(200).json({
            slug, title: meta.title || safe, date: meta.date || '',
            author: meta.author || 'The Psychedelic Digest',
            excerpt: meta.excerpt || body.slice(0, 160).replace(/\n/g, ' ') + '...',
            category: meta.category || 'Research', image: meta.image || '',
            tags: meta.tags ? meta.tags.split(',').map(t => t.trim()) : [],
            readTime: estimateReadTime(body), html: mdToHtml(body),
          });
        }
      }
    }

    // Fall back to hardcoded posts
    const fb = FALLBACK_POSTS[safe];
    if (fb) {
      return res.status(200).json({
        slug: safe, title: fb.title, date: fb.date, author: fb.author,
        excerpt: fb.excerpt, category: fb.category, image: fb.image,
        tags: fb.tags, readTime: estimateReadTime(fb.body), html: mdToHtml(fb.body),
      });
    }

    return res.status(404).json({ error: 'Post not found' });
  }

  // ── Post list ─────────────────────────────────────────────
  const postsFromFiles = [];

  if (fs.existsSync(postsDir)) {
    try {
      fs.readdirSync(postsDir).filter(f => f.endsWith('.md')).forEach(file => {
        const s      = file.replace('.md', '');
        const raw    = fs.readFileSync(path.join(postsDir, file), 'utf8');
        const parsed = parseFrontmatter(raw);
        if (parsed) {
          const { meta, body } = parsed;
          postsFromFiles.push({
            slug: s, title: meta.title || s, date: meta.date || '',
            author: meta.author || 'The Psychedelic Digest',
            excerpt: meta.excerpt || body.slice(0, 160).replace(/\n/g, ' ') + '...',
            category: meta.category || 'Research', image: meta.image || '',
            tags: meta.tags ? meta.tags.split(',').map(t => t.trim()) : [],
            readTime: estimateReadTime(body),
          });
        }
      });
    } catch(e) {}
  }

  // Merge: file posts take priority over fallbacks; fill gaps with fallbacks
  const fileSlugs = new Set(postsFromFiles.map(p => p.slug));
  const fallbacks = Object.entries(FALLBACK_POSTS)
    .filter(([s]) => !fileSlugs.has(s))
    .map(([s, fb]) => ({
      slug: s, title: fb.title, date: fb.date, author: fb.author,
      excerpt: fb.excerpt, category: fb.category, image: fb.image,
      tags: fb.tags, readTime: estimateReadTime(fb.body),
    }));

  const posts = [...postsFromFiles, ...fallbacks]
    .sort((a, b) => (b.date > a.date ? 1 : -1));

  return res.status(200).json({ posts });
};
