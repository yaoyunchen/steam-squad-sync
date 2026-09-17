export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  const url = new URL(req.url);
  const targetUrl = url.searchParams.get('url');

  if (!targetUrl) {
    return new Response(JSON.stringify({ error: 'Missing url parameter' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  // Handle CORS OPTIONS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,OPTIONS,PATCH,DELETE,POST,PUT',
        'Access-Control-Allow-Headers': '*',
      },
    });
  }

  try {
    const steamRes = await fetch(targetUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'application/json, text/plain, */*',
      },
    });

    // Intelligent Edge CDN Caching
    let cacheControl = 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400';
    if (targetUrl.includes('store.steampowered.com')) {
      cacheControl = 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=604800';
    } else if (targetUrl.includes('GetOwnedGames')) {
      cacheControl = 'public, max-age=1800, s-maxage=3600, stale-while-revalidate=86400';
    }

    const contentType = steamRes.headers.get('content-type') || 'application/json';

    return new Response(steamRes.body, {
      status: steamRes.status,
      headers: {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,OPTIONS',
        'Cache-Control': cacheControl,
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Proxy request failed: ' + error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
}
