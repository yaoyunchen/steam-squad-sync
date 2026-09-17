const steamUrl = "https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=EB3D55C7CF9D061681597181ED1A426A&steamids=76561198003465984";

async function testProxies() {
  const proxies = [
    { name: 'allorigins raw', url: "https://api.allorigins.win/raw?url=" + encodeURIComponent(steamUrl) },
    { name: 'allorigins json', url: "https://api.allorigins.win/get?url=" + encodeURIComponent(steamUrl) },
    { name: 'corsproxy.io', url: "https://corsproxy.io/?" + encodeURIComponent(steamUrl) },
    { name: 'cors-proxy.htmldriven', url: "https://cors-proxy.htmldriven.com/?url=" + encodeURIComponent(steamUrl) },
  ];

  for (const p of proxies) {
    try {
      const res = await fetch(p.url);
      console.log(`[${p.name}] Status: ${res.status}`);
      if (res.ok) {
        const text = await res.text();
        console.log(`  Length: ${text.length}, Preview: ${text.substring(0, 100)}`);
      }
    } catch (e) {
      console.log(`[${p.name}] Error: ${e.message}`);
    }
  }
}

testProxies();
