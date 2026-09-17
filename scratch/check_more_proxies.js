const steamUrl = "https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=EB3D55C7CF9D061681597181ED1A426A&steamids=76561198003465984";

const testList = [
  "https://jsonp.afeld.me/?url=" + encodeURIComponent(steamUrl),
  "https://cors-anywhere.herokuapp.com/" + steamUrl,
  "https://api.allorigins.win/get?url=" + encodeURIComponent(steamUrl),
  "https://cors.eu.org/" + steamUrl,
  "https://proxy.cors.sh/" + steamUrl
];

async function check() {
  for (const url of testList) {
    try {
      console.log("Testing:", url.substring(0, 35));
      const res = await fetch(url, { headers: { 'x-cors-gratis-api-key': 'temp' } });
      console.log("  Status:", res.status);
      const text = await res.text();
      console.log("  Response length:", text.length, "Preview:", text.substring(0, 60));
    } catch (e) {
      console.log("  Error:", e.message);
    }
  }
}

check();
