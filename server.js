const express = require('express');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

const SECRET_KEY = "AstryxSecretKey123";

// 🔑 JSONBin Details
const JSONBIN_BIN_ID = "6acd97ceac6210605a2c4537";
const JSONBIN_API_KEY = "\$2a\$10\$ljfaxrBad4o5XTd62B3hOO/4GlCfSG4HyRfUbIl9DjRAuLuBqoYci";

// Helper to fetch data from JSONBin
async function getDataFromBin() {
    try {
        const response = await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}/latest`, {
            headers: { 
                'X-Master-Key': JSONBIN_API_KEY,
                'X-Bin-Meta': 'false' 
            }
        });
        const json = await response.json();
        
        // Handle different possible JSONBin response structures safely
        if (Array.isArray(json)) return json;
        if (json.record && Array.isArray(json.record)) return json.record;
        if (json.record && Array.isArray(json.record.players)) return json.record.players;
        return [];
    } catch (e) {
        console.error("Error reading from JSONBin:", e);
        return [];
    }
}

// Helper to save data to JSONBin
async function saveDataToBin(data) {
    try {
        const response = await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-Master-Key': JSONBIN_API_KEY
            },
            body: JSON.stringify(data)
        });
        const resJson = await response.json();
        if (!response.ok) {
            console.error("JSONBin Write Error Details:", resJson);
            return false;
        }
        return true;
    } catch (e) {
        console.error("Error writing to JSONBin:", e);
        return false;
    }
}

// POST endpoint for your Discord bot
app.post('/update', async (req, res) => {
    console.log("📥 Received payload from Discord bot:", JSON.stringify(req.body, null, 2));

    const key = req.query.key;
    if (key !== SECRET_KEY) {
        console.warn("⚠️ Unauthorized update attempt with key:", key);
        return res.status(401).json({ status: "error", message: "Unauthorized key" });
    }

    const payload = req.body;
    if (!payload || !payload.username) {
        return res.status(400).json({ status: "error", message: "Invalid payload: missing username" });
    }

    let currentData = await getDataFromBin();

    const player = String(payload.username).trim();
    const mode = String(payload.mode).toLowerCase().trim();
    const tier = String(payload.tier).trim();
    const region = payload.region ? String(payload.region).trim() : 'AS';
    const skin = payload.skin ? String(payload.skin).trim() : null;

    console.log(`Processing -> Player: ${player} | Mode: ${mode} | Tier: ${tier} | Region: ${region} | Skin: ${skin}`);

    let found = false;
    for (let p of currentData) {
        if (p.username.toLowerCase() === player.toLowerCase()) {
            p.username = player;
            p.region = region;
            
            // Explicitly attach or update the skin property if provided
            if (skin) {
                p.skin = skin;
                console.log(`✨ Saved custom skin '${skin}' for player ${player}`);
            }

            if (!p.tiers) p.tiers = {};
            p.tiers[mode] = tier;
            found = true;
            break;
        }
    }

    if (!found) {
        const newPlayer = {
            username: player,
            region: region,
            tiers: { [mode]: tier }
        };
        if (skin) {
            newPlayer.skin = skin;
            console.log(`✨ Created new player entry for ${player} with skin '${skin}'`);
        }
        currentData.push(newPlayer);
    }

    const success = await saveDataToBin(currentData);
    if (success) {
        console.log(`✅ Successfully synced changes to JSONBin cloud!`);
        return res.json({ status: "success", message: "Updated successfully", data: currentData });
    } else {
        console.error(`❌ Failed to write data to JSONBin cloud.`);
        return res.status(500).json({ status: "error", message: "Write to JSONBin cloud failed" });
    }
});

// GET endpoint for your website to read rankings
app.get('/data.json', async (req, res) => {
    const data = await getDataFromBin();
    res.json(data);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
