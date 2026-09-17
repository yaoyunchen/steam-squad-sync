const testKey = "EB3D55C7CF9D061681597181ED1A426A";
const steamid = "76561198003465984";
const url = `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${testKey}&steamids=${steamid}`;

async function checkKey() {
  const res = await fetch(url);
  console.log("Direct status:", res.status);
  const text = await res.text();
  console.log("Direct response body:", text);
}

checkKey();
