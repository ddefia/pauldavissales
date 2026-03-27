import { NextResponse } from "next/server";
import { auth } from "@/lib/auth-bypass";

interface NewsItem {
  title: string;
  source: string;
  url: string;
  publishedAt: string;
  snippet: string;
  category: string;
}

function extractTag(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
  return match ? (match[1] || match[2] || "").trim() : "";
}

function parseRssItems(xml: string, category: string, limit = 4): NewsItem[] {
  const items: NewsItem[] = [];
  const itemMatches = xml.matchAll(/<item>([\s\S]*?)<\/item>/g);

  for (const match of itemMatches) {
    if (items.length >= limit) break;
    const block = match[1];

    const title = extractTag(block, "title").replace(/\s*-\s*[^-]+$/, "").trim();
    const link = extractTag(block, "link") || block.match(/<link\/>([^<]+)/)?.[1] || "";
    const pubDate = extractTag(block, "pubDate");
    const source = extractTag(block, "source") || "News";

    // Extract snippet from description
    let snippet = extractTag(block, "description");
    // Strip HTML tags from snippet
    snippet = snippet.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim();
    if (snippet.length > 120) snippet = snippet.slice(0, 120) + "…";

    if (title && link) {
      items.push({
        title,
        source,
        url: link,
        publishedAt: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
        snippet,
        category,
      });
    }
  }
  return items;
}

async function fetchFeed(query: string, category: string, limit = 4): Promise<NewsItem[]> {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; NewsBot/1.0)" },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    const xml = await res.text();
    return parseRssItems(xml, category, limit);
  } catch {
    return [];
  }
}

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [stormItems, insuranceItems, propertyItems] = await Promise.all([
    fetchFeed("South Florida storm flooding water damage 2025", "Storm & Flooding", 3),
    fetchFeed("Florida property insurance claims restoration mold damage", "Insurance & Restoration", 3),
    fetchFeed("Palm Beach Treasure Coast hurricane wind damage property", "Property Damage", 3),
  ]);

  // Merge, dedupe by title, sort by date
  const all = [...stormItems, ...insuranceItems, ...propertyItems];
  const seen = new Set<string>();
  const deduped = all.filter((item) => {
    const key = item.title.slice(0, 40).toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  deduped.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

  const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recent = deduped.filter((item) => new Date(item.publishedAt).getTime() >= oneWeekAgo);

  return NextResponse.json({
    data: recent.slice(0, 8),
    fetchedAt: new Date().toISOString(),
  });
}
