const steamUrl = "https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=EB3D55C7CF9D061681597181ED1A426A&steamids=76561198003465984";
const storeUrl = "https://store.steampowered.com/api/appdetails?appids=730";

const proxyList = [
  { name: 'corsproxy.org', fn: u => `https://corsproxy.org/?${encodeURIComponent(u)}` },
  { name: 'cors.bridged.cc', fn: u => `https://cors.bridged.cc/${u}` },
  { name: 'api.codetabs.com', fn: u => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}` },
  { name: 'thingproxy', fn: u => `https://thingproxy.freeboard.io/fetch/${u}` },
  { name: 'corsproxy.io', fn: u => `https://corsproxy.io/?${encodeURIComponent(u)}` },
  { name: 'allorigins raw', fn: u => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}` },
  { name: 'allorigins get', fn: u => `https://api.allorigins.win/get?url=${encodeURIComponent(u)}` },
  { name: 'jsonp.afeld.me', fn: u => `https://jsonp.afeld.me/?url=${encodeURIComponent(u)}` },
  { name: 'cors.sh', fn: u => `https://proxy.cors.sh/${u}` },
];

async function run() {
  console.log("--- TESTING STEAM API PROXIES ---");
  for (const p of proxyList) {
    const url = p.fn(steamUrl);
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      console.log(`[${p.name}] Status: ${res.status}`);
      if (res.ok) {
        const text = await res.text();
        if (text.includes("players")) {
          console.log(`  ✅ SUCCESS! (${text.length} bytes)`);
        } else {
          console.log(`  ⚠️ Non-json text preview: ${text.substring(0, 80)}...`);
        }
      }
    } catch (e) {
      console.log(`[${p.name}] Error: ${e.message}`);
    }
  }
}

run();
