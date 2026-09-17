const steamUrl = "https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=EB3D55C7CF9D061681597181ED1A426A&steamids=76561198003465984";
const origin = "https://yaoyunchen.github.io";

const proxyList = [
  { name: 'allorigins raw', getUrl: u => "https://api.allorigins.win/raw?url=" + encodeURIComponent(u) },
  { name: 'corsproxy.org', getUrl: u => "https://corsproxy.org/?" + encodeURIComponent(u) },
  { name: 'thingproxy', getUrl: u => "https://thingproxy.freeboard.io/fetch/" + u },
  { name: 'api.codetabs.com', getUrl: u => "https://api.codetabs.com/v1/proxy?quest=" + encodeURIComponent(u) }
];

async function testAll() {
  for (const p of proxyList) {
    const proxyUrl = p.getUrl(steamUrl);
    try {
      const res = await fetch(proxyUrl, { headers: { Origin: origin } });
      console.log(`[${p.name}] Status: ${res.status}`);
      if (res.ok) {
        const data = await res.json();
        console.log(`  Success! Found ${data.response?.players?.length} players`);
      }
    } catch (e) {
      console.log(`[${p.name}] Error: ${e.message}`);
    }
  }
}

testAll();
