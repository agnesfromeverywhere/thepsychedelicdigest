export default async function handler(req, res) {
  const feeds = [
    {
      name: "Google News AU Daily",
      url: "https://news.google.com/rss/search?q=psychedelic+therapy+OR+psilocybin+therapy+OR+MDMA+therapy+OR+ketamine+therapy&hl=en-AU&gl=AU&ceid=AU:en&tbs=qdr:d"
    },
    {
      name: "Google News Global Weekly",
      url: "https://news.google.com/rss/search?q=psychedelic+therapy+OR+psilocybin+OR+MDMA+PTSD+OR+ketamine+depression&hl=en-US&gl=US&ceid=US:en&tbs=qdr:w"
    },
    {
      name: "Google News Policy",
      url: "https://news.google.com/rss/search?q=psychedelic+decriminalization+OR+psychedelic+legislation+OR+psilocybin+legal+OR+MDMA+FDA&hl=en-US&gl=US&ceid=US:en&tbs=qdr:w"
    },
    {
      name: "Google News Research",
      url: "https://news.google.com/rss/search?q=psilocybin+clinical+trial+OR+MDMA+clinical+trial+OR+psychedelic+research+2026&hl=en-US&gl=US&ceid=US:en&tbs=qdr:w"
    }
  ];

  try {
    const results = await Promise.allSettled(
      feeds.map(async (feed) => {
        const response = await fetch(feed.url, {
          headers: {
            "User-Agent": "The Psychedelic Digest/1.0 (https://thepsychedelicdigest.com)"
          }
        });
        if (!response.ok) throw new Error(`${feed.name} failed with ${response.status}`);
        const xml = await response.text();
        return { source: feed.name, xml };
      })
    );

    const successful = results
      .filter(r => r.status === "fulfilled")
      .map(r => r.value);

    if (!successful.length) {
      return res.status(502).json({ ok: false, error: "All feeds failed." });
    }

    // Parse and merge all feeds
    const parser = new (await import('node-html-parser')).default || null;
    const allItems = [];
    const seen = new Set();

    for (const feed of successful) {
      const matches = feed.xml.match(/<item>([\s\S]*?)<\/item>/g) || [];
      for (const item of matches) {
        const title = (item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) || item.match(/<title>(.*?)<\/title>/))?.[1]?.trim() || '';
        const link = (item.match(/<link>(.*?)<\/link>/) || [])?.[1]?.trim() || '';
        const pubDate = (item.match(/<pubDate>(.*?)<\/pubDate>/) || [])?.[1]?.trim() || '';
        const source = (item.match(/<source[^>]*>(.*?)<\/source>/) || [])?.[1]?.trim() || '';
        const description = (item.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/) || item.match(/<description>(.*?)<\/description>/))?.[1]?.trim() || '';

        if (!title || seen.has(title)) continue;
        seen.add(title);

        allItems.push({ title, link, pubDate, source, description, feedName: feed.source });
      }
    }

    // Sort by pubDate descending
    allItems.sort((a, b) => {
      const da = a.pubDate ? new Date(a.pubDate).getTime() : 0;
      const db = b.pubDate ? new Date(b.pubDate).getTime() : 0;
      return db - da;
    });

    // Rebuild XML
    const itemsXml = allItems.slice(0, 30).map(item => `
    <item>
      <title><![CDATA[${item.title}]]></title>
      <link>${item.link}</link>
      <pubDate>${item.pubDate}</pubDate>
      <source>${item.source}</source>
      <description><![CDATA[${item.description}]]></description>
    </item>`).join('');

    const mergedXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>The Psychedelic Digest — Live Feed</title>
    <link>https://thepsychedelicdigest.com</link>
    <description>Merged psychedelic therapy news feed</description>
    ${itemsXml}
  </channel>
</rss>`;

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    return res.status(200).send(mergedXml);

  } catch (error) {
    return res.status(500).json({ ok: false, error: "News fetch failed.", message: error.message });
  }
}
