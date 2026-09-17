const steamUrl = "https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=EB3D55C7CF9D061681597181ED1A426A&steamids=76561198003465984";

async function test() {
  const proxies = [
    "https://corsproxy.org/?" + encodeURIComponent(steamUrl),
    "https://api.codetabs.com/v1/proxy?quest=" + encodeURIComponent(steamUrl)
  ];

  for (const url of proxies) {
    try {
      const res = await fetch(url);
      console.log(url.substring(0, 30), "Status:", res.status);
      if (res.ok) {
        const data = await res.json();
        console.log("Success! Player:", data?.response?.players?.[0]?.personaname);
      }
    } catch(e) {
      console.error("Error:", e.message);
    }
  }
}

test();
