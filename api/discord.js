import nacl from 'tweetnacl';

const DISCORD_PUBLIC_KEY = process.env.DISCORD_PUBLIC_KEY || '5d1516ce4b6e5232d5fba2a8541a5ac5abbeb86617246043efa9ad2b0dc59d2e';
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://cjuffkahiadbrwycylpm.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNqdWZma2FoaWFkYnJ3eWN5bHBtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAwMjAzNjQsImV4cCI6MjEwNTU5NjM2NH0.i98ic43sNz4sSFjrDc_pZkh5KkJwAw6mFaSO33zazvA';

// Helper to verify Discord ed25519 signature
function verifySignature(req, rawBody) {
  const signature = req.headers['x-signature-ed25519'];
  const timestamp = req.headers['x-signature-timestamp'];

  if (!signature || !timestamp || !rawBody) {
    return false;
  }

  try {
    return nacl.sign.detached.verify(
      Buffer.from(timestamp + rawBody),
      Buffer.from(signature, 'hex'),
      Buffer.from(DISCORD_PUBLIC_KEY, 'hex')
    );
  } catch (err) {
    return false;
  }
}

// Read raw request body
function getRawBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
    });
    req.on('end', () => {
      resolve(data);
    });
  });
}

// Fetch Supabase squad payload
async function fetchCloudPayload(roomCode) {
  const cleanUrl = SUPABASE_URL.replace(/\/$/, '');
  const codeClean = roomCode.replace(/^SQUAD-/i, '').trim().toUpperCase();
  const endpoint = `${cleanUrl}/rest/v1/squad_data?squad_code=eq.${encodeURIComponent(codeClean)}&select=data`;

  try {
    const res = await fetch(endpoint, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
    });
    if (!res.ok) return null;
    const rows = await res.json();
    if (Array.isArray(rows) && rows.length > 0) {
      return rows[0].data;
    }
    return null;
  } catch {
    return null;
  }
}

// Push Supabase squad payload
async function pushCloudPayload(roomCode, payload) {
  const cleanUrl = SUPABASE_URL.replace(/\/$/, '');
  const codeClean = roomCode.replace(/^SQUAD-/i, '').trim().toUpperCase();
  const endpoint = `${cleanUrl}/rest/v1/squad_data`;

  try {
    await fetch(endpoint, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates',
      },
      body: JSON.stringify({
        squad_code: codeClean,
        data: payload,
        updated_at: new Date().toISOString(),
      }),
    });
  } catch (e) {
    console.error('Failed to push cloud payload from Discord bot:', e);
  }
}

// Fetch/Push Channel & User Mappings in Supabase
async function getMappings() {
  const data = await fetchCloudPayload('DISCORD_MAPPINGS');
  return data || { channels: {}, users: {} };
}

async function saveMappings(mappings) {
  await pushCloudPayload('DISCORD_MAPPINGS', mappings);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const rawBody = await getRawBody(req);
  const isValid = verifySignature(req, rawBody);

  if (!isValid) {
    return res.status(401).send('Invalid request signature');
  }

  const interaction = JSON.parse(rawBody);

  // Type 1: Discord PING / PONG handshake
  if (interaction.type === 1) {
    return res.status(200).json({ type: 1 });
  }

  // Type 2: Slash Commands or Type 3: Component Interactions
  const { channel_id, member, user, data } = interaction;
  const callerUser = member?.user || user;
  const discordUserId = callerUser?.id;
  const discordUsername = callerUser?.global_name || callerUser?.username || 'User';

  const mappings = await getMappings();

  // Handle Slash Command /squad-link
  if (interaction.type === 2 && data.name === 'squad-link') {
    const codeOption = data.options?.find((o) => o.name === 'code')?.value || '';
    const cleanCode = codeOption.trim().toUpperCase();

    mappings.channels[channel_id] = cleanCode;
    await saveMappings(mappings);

    return res.status(200).json({
      type: 4,
      data: {
        content: `🔗 **Linked Discord Channel to Squad Room \`${cleanCode}\`!**\nUsers in this channel can now view status with \`/squad-status\` and toggle availability with \`/squad-free\`.`,
      },
    });
  }

  // Handle Slash Command /squad-bind
  if (interaction.type === 2 && data.name === 'squad-bind') {
    const steamInput = (data.options?.find((o) => o.name === 'steam')?.value || '').trim();
    mappings.users[discordUserId] = steamInput;
    await saveMappings(mappings);

    return res.status(200).json({
      type: 4,
      data: {
        content: `👤 **Bound <@${discordUserId}> to Steam Account \`${steamInput}\`!**\nYour schedule toggles will now update your availability in the squad room.`,
      },
    });
  }

  // Resolve active room code for this channel
  const roomCode = mappings.channels[channel_id];
  if (!roomCode && (data.name === 'squad-free' || data.name === 'squad-status' || interaction.type === 3)) {
    return res.status(200).json({
      type: 4,
      data: {
        content: `⚠️ This channel is not linked to a Squad Room yet! Run \`/squad-link <code>\` (e.g., \`/squad-link 8F3A19B2\`) to connect.`,
        flags: 64, // Ephemeral
      },
    });
  }

  // Handle Slash Command /squad-status
  if (interaction.type === 2 && data.name === 'squad-status') {
    const payload = await fetchCloudPayload(roomCode);
    const schedules = payload?.schedules || {};

    const todayStr = new Date().toISOString().split('T')[0];
    const eveningKey = `${todayStr}-evening`;

    let statusLines = [];
    Object.entries(schedules).forEach(([id, player]) => {
      const name = player.personaName || `Player ${id}`;
      const isFreeTonight = player.grid && player.grid[eveningKey];
      statusLines.push(`${isFreeTonight ? '🟢' : '⚪'} **${name}**: ${isFreeTonight ? 'Free Tonight (4pm - 8pm)' : 'Not set / Busy'}`);
    });

    if (statusLines.length === 0) {
      statusLines.push('_No player schedules recorded yet for this squad._');
    }

    return res.status(200).json({
      type: 4,
      data: {
        embeds: [
          {
            title: `📅 Squad Availability Summary — Room #${roomCode}`,
            color: 0x66c0f4,
            description: statusLines.join('\n'),
            footer: { text: 'Steam Squad Sync • Real-Time Cloud Integration' },
          },
        ],
        components: [
          {
            type: 1, // ActionRow
            components: [
              {
                type: 2, // Button
                style: 3, // Success green
                label: '🟢 I am Free Tonight',
                custom_id: 'btn_free_evening',
              },
              {
                type: 2,
                style: 4, // Danger red
                label: '🔴 Busy Tonight',
                custom_id: 'btn_busy_evening',
              },
            ],
          },
        ],
      },
    });
  }

  // Handle Slash Command /squad-free OR Button clicks
  if ((interaction.type === 2 && data.name === 'squad-free') || interaction.type === 3) {
    let targetBlock = 'evening';
    let setAvailable = true;

    if (interaction.type === 2) {
      targetBlock = data.options?.find((o) => o.name === 'block')?.value || 'evening';
    } else if (interaction.type === 3) {
      if (data.custom_id === 'btn_free_evening') {
        targetBlock = 'evening';
        setAvailable = true;
      } else if (data.custom_id === 'btn_busy_evening') {
        targetBlock = 'evening';
        setAvailable = false;
      }
    }

    const boundSteam = mappings.users[discordUserId] || discordUsername;
    const payload = (await fetchCloudPayload(roomCode)) || { schedules: {} };
    if (!payload.schedules) payload.schedules = {};

    const todayStr = new Date().toISOString().split('T')[0];
    const key = `${todayStr}-${targetBlock}`;

    // Find or create player schedule entry
    let playerSlotKey = Object.keys(payload.schedules).find(
      (k) =>
        k === boundSteam ||
        payload.schedules[k]?.personaName?.toLowerCase() === discordUsername.toLowerCase()
    ) || boundSteam;

    if (!payload.schedules[playerSlotKey]) {
      payload.schedules[playerSlotKey] = {
        slotId: playerSlotKey,
        personaName: discordUsername,
        timezone: 'America/Los_Angeles',
        grid: {},
      };
    }

    if (!payload.schedules[playerSlotKey].grid) {
      payload.schedules[playerSlotKey].grid = {};
    }

    payload.schedules[playerSlotKey].grid[key] = setAvailable;
    await pushCloudPayload(roomCode, payload);

    return res.status(200).json({
      type: 4,
      data: {
        content: `${setAvailable ? '🟢' : '🔴'} **<@${discordUserId}> updated availability for \`${targetBlock.toUpperCase()}\`!**\nSchedule synced to Squad Room **#${roomCode}**.`,
      },
    });
  }

  return res.status(200).json({ type: 4, data: { content: 'Command received.' } });
}
