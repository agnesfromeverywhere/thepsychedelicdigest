export default async function handler(req, res) {
  const feeds = [
    {
      name: "Google News",
      url: "https://news.google.com/rss/search?q=psychedelic%20therapy%20OR%20psilocybin%20OR%20MDMA%20therapy%20OR%20ketamine%20therapy&hl=en-AU&gl=AU&ceid=AU:en"
    }
  ];

  try {
    const results = await Promise.allSettled(
      feeds.map(async (feed) => {
        const response = await fetch(feed.url, {
          headers: {
            "User-Agent": "The Psychedelic Digest/1.0"
          }
        });

        if (!response.ok) {
          throw new Error(`${feed.name} failed with ${response.status}`);
        }

        const xml = await response.text();
        return { source: feed.name, xml };
      })
    );

    const successfulFeeds = results
      .filter((result) => result.status === "fulfilled")
      .map((result) => result.value);

    if (!successfulFeeds.length) {
      return res.status(502).json({
        ok: false,
        error: "No news feeds could be loaded."
      });
    }

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "s-maxage=900, stale-while-revalidate=3600");
    res.setHeader("Content-Type", "application/xml; charset=utf-8");

    return res.status(200).send(successfulFeeds[0].xml);

  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: "News fetch failed.",
      message: error.message
    });
  }
}
