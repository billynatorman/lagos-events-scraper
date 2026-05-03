import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { scrapeAllSources, CATEGORY_KEYWORDS } from './scraper.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

let cache = {
  data: null,
  timestamp: null,
  ttl: 10 * 60 * 1000
};

function isCacheValid() {
  return cache.data && cache.timestamp && (Date.now() - cache.timestamp < cache.ttl);
}

function applyFilters(events, { keyword, category, limit = 50 }) {
  let filtered = [...events];
  
  if (category && CATEGORY_KEYWORDS[category]) {
    const keywords = CATEGORY_KEYWORDS[category];
    filtered = filtered.filter(event => {
      const searchText = `${event.title} ${event.location}`.toLowerCase();
      return keywords.some(kw => searchText.includes(kw.toLowerCase()));
    });
  }
  
  if (keyword) {
    const kw = keyword.toLowerCase();
    filtered = filtered.filter(event => {
      const searchText = `${event.title} ${event.location} ${event.date}`.toLowerCase();
      return searchText.includes(kw);
    });
  }
  
  return filtered.slice(0, Math.min(limit, 200));
}

app.get('/api/events', async (req, res) => {
  try {
    const { source = 'all', limit = 50, keyword, category, refresh } = req.query;
    
    let events;
    let cached = false;
    
    if (!refresh && isCacheValid()) {
      events = cache.data;
      cached = true;
    } else {
      events = await scrapeAllSources();
      cache.data = events;
      cache.timestamp = Date.now();
    }
    
    const filtered = applyFilters(events, { keyword, category, limit: parseInt(limit) });
    
    res.json({
      count: filtered.length,
      scraped_at: new Date(cache.timestamp).toISOString(),
      cached,
      keyword: keyword || null,
      category: category || null,
      events: filtered
    });
  } catch (error) {
    res.status(500).json({ error: 'Scraping failed', message: error.message });
  }
});

app.get('/api/events/sources', (req, res) => {
  res.json({
    sources: ['all', 'eventbrite', 'meetup', 'nairaland', 'pulse', 'guardian']
  });
});

app.get('/api/events/categories', (req, res) => {
  res.json({
    categories: Object.keys(CATEGORY_KEYWORDS)
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    cache_valid: isCacheValid(),
    cached_events: cache.data?.length || 0
  });
});

app.get('/', (req, res) => {
  res.send(`
    <html>
      <head><title>Lagos Events API</title></head>
      <body style="font-family: Arial; max-width: 800px; margin: 50px auto; padding: 20px;">
        <h1>🎉 Lagos Events Scraper API</h1>
        <h2>Endpoints:</h2>
        <ul>
          <li><code>GET /api/events</code> - Get all events</li>
          <li><code>GET /api/events?category=tech</code> - Filter by category</li>
          <li><code>GET /api/events?keyword=music</code> - Search events</li>
          <li><code>GET /api/health</code> - Check API status</li>
        </ul>
        <p><a href="/api/events">Try it now →</a></p>
      </body>
    </html>
  `);
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
