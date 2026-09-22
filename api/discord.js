import nacl from 'tweetnacl';

const DISCORD_PUBLIC_KEY = process.env.DISCORD_PUBLIC_KEY || '5d1516ce4b6e5232d5fba2a8541a5ac5abbeb86617246043efa9ad2b0dc59d2e';
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://cjuffkahiadbrwycylpm.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNqdWZma2FoaWFkYnJ3eWN5bHBtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAwMjAzNjQsImV4cCI6MjEwNTU5NjM2NH0.i98ic43sNz4sSFjrDc_pZkh5KkJwAw6mFaSO33zazvA';

const BLOCKS_CONFIG = [
  { id: 'evening', label: '🌇 Evening (4pm - 8pm)', short: '🌇 Evening' },
  { id: 'night', label: '🌙 Night (8pm - 12am)', short: '🌙 Night' },
  { id: 'afternoon', label: '☀️ Afternoon (12pm - 4pm)', short: '☀️ Afternoon' },
  { id: 'morning', label: '☕ Morning (8am - 12pm)', short: '☕ Morning' },
  { id: 'daybreak', label: '🌅 Daybreak (4am - 8am)', short: '🌅 Daybreak' },
  { id: 'graveyard', label: '🕯️ Graveyard (12am - 4am)', short: '🕯️ Graveyard' },
];

const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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

// Parse date inputs like 'today', 'tomorrow', 'friday', '2026-09-25'
function parseTargetDate(inputStr) {
  const today = new Date();
  if (!inputStr || inputStr.trim().toLowerCase() === 'today') {
    return today.toISOString().split('T')[0];
  }

  const clean = inputStr.trim().toLowerCase();
  if (clean === 'tomorrow') {
    const tom = new Date(today);
    tom.setDate(today.getDate() + 1);
    return tom.toISOString().split('T')[0];
  }

  const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const shortDays = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

  let targetDayIdx = daysOfWeek.findIndex((d) => d.startsWith(clean));
  if (targetDayIdx === -1) {
    targetDayIdx = shortDays.findIndex((d) => d === clean);
  }

  if (targetDayIdx !== -1) {
    const result = new Date(today);
    let diff = targetDayIdx - today.getDay();
    if (diff <= 0) diff += 7; // Upcoming weekday
    result.setDate(today.getDate() + diff);
    return result.toISOString().split('T')[0];
  }

  try {
    const parsed = new Date(clean);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().split('T')[0];
    }
  } catch {}

  return today.toISOString().split('T')[0];
}

// Format date for display (e.g. "Fri 9/25")
function formatDateLabel(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const dayName = DAYS_SHORT[d.getDay()];
  const month = d.getMonth() + 1;
  const dayNum = d.getDate();
  return `${dayName} ${month}/${dayNum}`;
}

function getDayNameFromDateStr(dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return days[d.getDay()];
}

function isSlotAvailableOnDate(pSched, dateStr, blockId) {
  if (!pSched || !pSched.grid) return false;
  const dateKey = `${dateStr}-${blockId}`;
  if (pSched.grid[dateKey] !== undefined) {
    return !!pSched.grid[dateKey];
  }
  const dayName = getDayNameFromDateStr(dateStr);
  const dayKey = `${dayName}-${blockId}`;
  return !!pSched.grid[dayKey];
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

// Fetch/Push Channel & User Mappings in dedicated 'discord_mappings' table in Supabase
async function getMappings() {
  const cleanUrl = SUPABASE_URL.replace(/\/$/, '');

  try {
    const res = await fetch(`${cleanUrl}/rest/v1/discord_mappings?id=eq.global&select=data`, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
    });
    if (res.ok) {
      const rows = await res.json();
      if (Array.isArray(rows) && rows.length > 0 && rows[0].data) {
        return rows[0].data;
      }
    }
  } catch (e) {
    console.warn('Dedicated discord_mappings fetch fallback notice:', e);
  }

  // Fallback to squad_data table key 'DISCORD_MAPPINGS'
  const data = await fetchCloudPayload('DISCORD_MAPPINGS');
  return data || { channels: {}, users: {} };
}

async function saveMappings(mappings) {
  const cleanUrl = SUPABASE_URL.replace(/\/$/, '');

  try {
    const res = await fetch(`${cleanUrl}/rest/v1/discord_mappings`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates',
      },
      body: JSON.stringify({
        id: 'global',
        data: mappings,
        updated_at: new Date().toISOString(),
      }),
    });
    if (res.ok) return;
  } catch (e) {
    console.warn('Dedicated discord_mappings push fallback notice:', e);
  }

  // Fallback to squad_data table
  await pushCloudPayload('DISCORD_MAPPINGS', mappings);
}

// Build Status Response Embed & Components for Target Date
async function buildStatusResponse(roomCode, noteMessage = '', targetDateStr = null) {
  const payload = await fetchCloudPayload(roomCode);
  const schedules = payload?.schedules || {};
  const activeDateStr = targetDateStr || new Date().toISOString().split('T')[0];
  const formattedDate = formatDateLabel(activeDateStr);

  const slots = payload?.slots || [];
  let playersToDisplay = [];
  const seenNames = new Set();

  if (slots.length > 0) {
    // 1. Rely strictly on defined squad slots from payload.slots
    slots.forEach((s, idx) => {
      const name = s.personaName || s.input || `Player #${s.id || idx + 1}`;
      const lower = name.toLowerCase();
      if (!seenNames.has(lower)) {
        seenNames.add(lower);
        playersToDisplay.push({
          key: s.steamId || s.id || `${idx + 1}`,
          name,
          steamId: s.steamId,
          slotId: s.id || `${idx + 1}`,
        });
      }
    });
  } else {
    // 2. Fallback to schedules, strictly filtering for valid squad slot keys (1-4, slot-X, 64-bit SteamIDs)
    Object.entries(schedules).forEach(([key, player]) => {
      const isSlotKey =
        /^(slot-)?[1-4]$/.test(key) ||
        key.startsWith('7656') ||
        (player.slotId && /^(slot-)?[1-4]$/.test(player.slotId));

      if (isSlotKey) {
        const name = player.personaName || key;
        const lower = name.toLowerCase();
        if (!seenNames.has(lower)) {
          seenNames.add(lower);
          playersToDisplay.push({
            key,
            name,
            steamId: key.startsWith('7656') ? key : '',
            slotId: player.slotId || key,
          });
        }
      }
    });
  }

  // 3. Guarantee at least 4 squad slots are listed
  const minSquadSlots = Math.max(4, slots.length);
  for (let i = playersToDisplay.length + 1; i <= minSquadSlots; i++) {
    playersToDisplay.push({
      key: `slot-${i}`,
      name: `Player #${i}`,
      steamId: '',
      slotId: `${i}`,
    });
  }

  let statusLines = [];
  playersToDisplay.forEach((p) => {
    const pSched =
      schedules[p.key] ||
      (p.steamId && schedules[p.steamId]) ||
      (p.slotId && schedules[p.slotId]) ||
      (p.slotId && schedules[`slot-${p.slotId}`]) ||
      Object.values(schedules).find(
        (sched) => sched.personaName && p.name && sched.personaName.toLowerCase() === p.name.toLowerCase()
      );

    const activeBlocks = [];
    BLOCKS_CONFIG.forEach((block) => {
      if (isSlotAvailableOnDate(pSched, activeDateStr, block.id)) {
        activeBlocks.push(block.short);
      }
    });

    if (activeBlocks.length > 0) {
      statusLines.push(`🟢 **${p.name}**: ${activeBlocks.join(', ')}`);
    } else {
      statusLines.push(`⚪ **${p.name}**: Not set / Busy`);
    }
  });

  // Generate 7-Day Weekly Heatmap Overview Summary
  let weeklySummaryLines = [];
  const baseDate = new Date();
  for (let i = 0; i < 7; i++) {
    const d = new Date(baseDate);
    d.setDate(baseDate.getDate() + i);
    const dStr = d.toISOString().split('T')[0];
    const dLabel = formatDateLabel(dStr);

    let dayPlayerParts = [];
    playersToDisplay.forEach((p) => {
      const pSched =
        schedules[p.key] ||
        (p.steamId && schedules[p.steamId]) ||
        (p.slotId && schedules[p.slotId]) ||
        (p.slotId && schedules[`slot-${p.slotId}`]) ||
        Object.values(schedules).find(
          (sched) => sched.personaName && p.name && sched.personaName.toLowerCase() === p.name.toLowerCase()
        );

      const activeBlocks = [];
      BLOCKS_CONFIG.forEach((block) => {
        if (isSlotAvailableOnDate(pSched, dStr, block.id)) {
          activeBlocks.push(block.short.split(' ')[0]);
        }
      });

      if (activeBlocks.length > 0) {
        dayPlayerParts.push(`**${p.name}** (${activeBlocks.join('')})`);
      }
    });

    if (dayPlayerParts.length > 0) {
      weeklySummaryLines.push(`• **${dLabel}**: 🟢 ${dayPlayerParts.join(', ')}`);
    } else {
      weeklySummaryLines.push(`• **${dLabel}**: ⚪ _No availability set_`);
    }
  }

  // Generate 7 upcoming dates for Date Selector Dropdown
  const upcomingDates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(baseDate);
    d.setDate(baseDate.getDate() + i);
    const dStr = d.toISOString().split('T')[0];
    const label = i === 0 ? `Today (${formatDateLabel(dStr)})` : i === 1 ? `Tomorrow (${formatDateLabel(dStr)})` : formatDateLabel(dStr);
    upcomingDates.push({ label, value: dStr });
  }

  let finalEmbedText = '';
  if (noteMessage) {
    finalEmbedText += `${noteMessage}\n\n`;
  }
  finalEmbedText += `📊 **7-Day Squad Heatmap Overview:**\n${weeklySummaryLines.join('\n')}\n\n`;
  finalEmbedText += `🔍 **Detailed Breakdown for ${formattedDate}:**\n${statusLines.join('\n')}`;

  return {
    type: 4,
    data: {
      embeds: [
        {
          title: `📅 Squad Availability Heatmap — Room #${roomCode}`,
          color: 0x66c0f4,
          description: finalEmbedText,
          footer: { text: `Active Date: ${activeDateStr} • Steam Squad Sync Real-Time Cloud` },
        },
      ],
      components: [
        {
          type: 1, // ActionRow 1: Date Switcher Dropdown
          components: [
            {
              type: 3,
              custom_id: 'select_date_switch',
              placeholder: `📅 Viewing Date: ${formattedDate} (Click to Switch Date)...`,
              options: upcomingDates.map((d) => ({
                label: d.label,
                value: d.value,
                default: d.value === activeDateStr,
              })),
            },
          ],
        },
        {
          type: 1, // ActionRow 2: Block Toggle Dropdown
          components: [
            {
              type: 3,
              custom_id: `select_block_toggle:${activeDateStr}`,
              placeholder: `⚡ Toggle Time Block for ${formattedDate}...`,
              options: BLOCKS_CONFIG.map((b) => ({
                label: b.label,
                value: b.id,
                description: `Toggle ${b.label} for ${formattedDate}`,
              })),
            },
          ],
        },
        {
          type: 1, // ActionRow 3: All Day Quick Buttons
          components: [
            {
              type: 2,
              style: 3, // Green
              label: `🟢 Set All Day Free (${formattedDate})`,
              custom_id: `btn_free_allday:${activeDateStr}`,
            },
            {
              type: 2,
              style: 4, // Red
              label: `🔴 Clear All Day (${formattedDate})`,
              custom_id: `btn_busy_allday:${activeDateStr}`,
            },
          ],
        },
      ],
    },
  };
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

  // Slash Command /squad-link
  if (interaction.type === 2 && data.name === 'squad-link') {
    const codeOption = data.options?.find((o) => o.name === 'code')?.value || '';
    const cleanCode = codeOption.trim().toUpperCase();

    mappings.channels[channel_id] = cleanCode;
    await saveMappings(mappings);

    return res.status(200).json({
      type: 4,
      data: {
        content: `🔗 **Linked Discord Channel to Squad Room \`${cleanCode}\`!**\nUse \`/squad-status\` to view heatmap and switch dates, or \`/squad-free\` to toggle availability.`,
      },
    });
  }

  // Slash Command /squad-bind
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

  // Slash Command /squad-status
  if (interaction.type === 2 && data.name === 'squad-status') {
    const dateArg = data.options?.find((o) => o.name === 'date')?.value;
    const targetDate = parseTargetDate(dateArg);
    const statusObj = await buildStatusResponse(roomCode, '', targetDate);
    return res.status(200).json(statusObj);
  }

  // Slash Command /squad-members
  if (interaction.type === 2 && data.name === 'squad-members') {
    const payload = await fetchCloudPayload(roomCode);
    const slots = payload?.slots || [];
    const schedules = payload?.schedules || {};

    let members = [];
    const seenNames = new Set();

    if (slots.length > 0) {
      // 1. Process active slots strictly from payload.slots
      slots.forEach((s, idx) => {
        const name = s.personaName || s.input || `Player #${s.id || idx + 1}`;
        const lower = name.toLowerCase();
        if (!seenNames.has(lower)) {
          seenNames.add(lower);
          members.push({
            slotNumber: idx + 1,
            name,
            steamId: s.steamId || '',
            input: s.input || '',
            slotId: s.id || `${idx + 1}`,
          });
        }
      });
    } else {
      // 2. Fallback if no slots array exists
      Object.entries(schedules).forEach(([key, player]) => {
        const name = player.personaName || key;
        const lower = name.toLowerCase();
        if (!seenNames.has(lower)) {
          seenNames.add(lower);
          members.push({
            slotNumber: members.length + 1,
            name,
            steamId: key.startsWith('7656') ? key : player.steamId || '',
            input: name,
            slotId: player.slotId || key,
          });
        }
      });
    }

    // 3. Guarantee at least 4 squad slots are shown
    const totalSquadCapacity = Math.max(4, slots.length);
    for (let i = members.length + 1; i <= totalSquadCapacity; i++) {
      members.push({
        slotNumber: i,
        name: `Player #${i}`,
        isEmpty: true,
      });
    }

    // Check Discord User Bindings from mappings.users
    const userBindings = mappings.users || {};

    // Format member lines for Discord Embed
    const memberLines = members.map((m) => {
      if (m.isEmpty) {
        return `👤 **Slot #${m.slotNumber}**: _Empty Slot (Unassigned)_`;
      }

      // Check if any Discord user is bound to this member slot
      let boundDiscordTag = '';
      Object.entries(userBindings).forEach(([dUserId, boundVal]) => {
        if (
          boundVal &&
          (boundVal === m.steamId ||
            boundVal.toLowerCase() === m.name.toLowerCase() ||
            boundVal === m.slotId)
        ) {
          boundDiscordTag = ` • *(Linked to <@${dUserId}>)*`;
        }
      });

      // Check if steamId is a valid 64-bit Steam ID (starts with 7656 and is 17 digits long)
      const is64BitSteamId = m.steamId && /^7656\d{13}$/.test(m.steamId);

      if (is64BitSteamId) {
        return `👤 **Slot #${m.slotNumber}**: **${m.name}** • 🆔 \`${m.steamId}\` • [Steam Profile](https://steamcommunity.com/profiles/${m.steamId})${boundDiscordTag}`;
      } else {
        return `👤 **Slot #${m.slotNumber}**: **${m.name}** • _Custom Account / Display Name_${boundDiscordTag}`;
      }
    });

    const activeCount = members.filter((m) => !m.isEmpty).length;

    return res.status(200).json({
      type: 4,
      data: {
        embeds: [
          {
            title: `🎮 Squad Members & Player Accounts — Room #${roomCode}`,
            color: 0x66c0f4,
            description: memberLines.join('\n\n'),
            footer: { text: `Active Members: ${activeCount} / ${totalSquadCapacity} • Steam Squad Sync` },
          },
        ],
      },
    });
  }

  // Component Interaction: Date Switcher Dropdown
  if (interaction.type === 3 && data.custom_id === 'select_date_switch') {
    const selectedDate = data.values?.[0] || new Date().toISOString().split('T')[0];
    const statusObj = await buildStatusResponse(roomCode, '', selectedDate);
    return res.status(200).json(statusObj);
  }

  // Component Interactions or /squad-free
  if ((interaction.type === 2 && data.name === 'squad-free') || interaction.type === 3) {
    const boundSteam = mappings.users[discordUserId] || discordUsername;
    const payload = (await fetchCloudPayload(roomCode)) || { schedules: {} };
    if (!payload.schedules) payload.schedules = {};
    const slots = payload.slots || [];

    let targetDateStr = new Date().toISOString().split('T')[0];
    let targetBlock = 'evening';
    let actionType = 'toggle';

    // Handle Slash Command /squad-free block: <block> date: [date]
    if (interaction.type === 2 && data.name === 'squad-free') {
      targetBlock = data.options?.find((o) => o.name === 'block')?.value || 'evening';
      const dateArg = data.options?.find((o) => o.name === 'date')?.value;
      targetDateStr = parseTargetDate(dateArg);
    }
    // Handle Dropdown Select Menu toggle
    else if (interaction.type === 3 && data.custom_id.startsWith('select_block_toggle')) {
      const parts = data.custom_id.split(':');
      if (parts[1]) targetDateStr = parts[1];
      targetBlock = data.values?.[0] || 'evening';
    }
    // Handle Button Set All Day Free
    else if (interaction.type === 3 && data.custom_id.startsWith('btn_free_allday')) {
      const parts = data.custom_id.split(':');
      if (parts[1]) targetDateStr = parts[1];
      actionType = 'allday_free';
    }
    // Handle Button Clear All Day
    else if (interaction.type === 3 && data.custom_id.startsWith('btn_busy_allday')) {
      const parts = data.custom_id.split(':');
      if (parts[1]) targetDateStr = parts[1];
      actionType = 'allday_clear';
    }

    // Resolve player slot entry from slots or schedules
    let playerSlotKey = null;

    if (slots.length > 0) {
      const matchingSlot = slots.find((s) => {
        if (boundSteam && s.steamId === boundSteam) return true;
        if (boundSteam && (s.personaName?.toLowerCase() === boundSteam.toLowerCase() || s.input?.toLowerCase() === boundSteam.toLowerCase())) return true;
        if (discordUsername && (s.personaName?.toLowerCase() === discordUsername.toLowerCase() || s.input?.toLowerCase() === discordUsername.toLowerCase())) return true;
        return false;
      });

      if (matchingSlot) {
        playerSlotKey = matchingSlot.steamId || matchingSlot.id;
      }
    }

    if (!playerSlotKey) {
      playerSlotKey = Object.keys(payload.schedules).find((k) => {
        const p = payload.schedules[k];
        const isSlotKey = /^(slot-)?[1-4]$/.test(k) || k.startsWith('7656') || (p?.slotId && /^(slot-)?[1-4]$/.test(p.slotId));
        if (!isSlotKey) return false;
        return (
          k === boundSteam ||
          p?.personaName?.toLowerCase() === discordUsername.toLowerCase() ||
          p?.personaName?.toLowerCase() === boundSteam.toLowerCase()
        );
      });
    }

    // If caller is NOT bound in mappings.users and not matched to a squad slot, return ephemeral warning
    if (!playerSlotKey && !mappings.users[discordUserId]) {
      return res.status(200).json({
        type: 4,
        data: {
          content: `⚠️ <@${discordUserId}>, your Discord account is not linked to any squad slot in room \`#${roomCode}\`!\nRun \`/squad-bind steam: <your Steam ID or display name>\` (e.g. \`/squad-bind steam: Reysol\`) to bind your account to your slot.`,
          flags: 64, // Ephemeral message (only visible to caller)
        },
      });
    }

    if (!playerSlotKey) {
      playerSlotKey = boundSteam;
    }

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

    let note = '';
    const dateFormatted = formatDateLabel(targetDateStr);

    if (actionType === 'allday_free') {
      BLOCKS_CONFIG.forEach((b) => {
        payload.schedules[playerSlotKey].grid[`${targetDateStr}-${b.id}`] = true;
      });
      note = `🟢 <@${discordUserId}> set **ALL DAY FREE** for ${dateFormatted}!`;
    } else if (actionType === 'allday_clear') {
      BLOCKS_CONFIG.forEach((b) => {
        payload.schedules[playerSlotKey].grid[`${targetDateStr}-${b.id}`] = false;
      });
      note = `🔴 <@${discordUserId}> cleared availability for ${dateFormatted}.`;
    } else {
      const key = `${targetDateStr}-${targetBlock}`;
      const curVal = !!payload.schedules[playerSlotKey].grid[key];
      payload.schedules[playerSlotKey].grid[key] = !curVal;
      note = `${!curVal ? '🟢' : '🔴'} <@${discordUserId}> toggled **${targetBlock.toUpperCase()}** to ${!curVal ? 'Free' : 'Busy'} for ${dateFormatted}`;
    }

    await pushCloudPayload(roomCode, payload);

    const updatedStatusObj = await buildStatusResponse(roomCode, note, targetDateStr);
    return res.status(200).json(updatedStatusObj);
  }

  return res.status(200).json({ type: 4, data: { content: 'Command received.' } });
}
