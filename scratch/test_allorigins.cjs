const steamUrl = "https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=EB3D55C7CF9D061681597181ED1A426A&steamids=76561198003465984";

async function run() {
  try {
    const url = "https://api.allorigins.win/raw?url=" + encodeURIComponent(steamUrl);
    const res = await fetch(url);
    console.log("Status:", res.status);
    const data = await res.json();
    console.log("Success! Player Name:", data.response.players[0].personaname);
  } catch (e) {
    console.error("Error:", e);
  }
}

run();
