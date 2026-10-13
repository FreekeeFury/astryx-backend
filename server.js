const express = require('express');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

const SECRET_KEY = "AstryxSecretKey123";

// 🔑 JSONBin Details
const JSONBIN_BIN_ID = "6acd97ceac6210605a2c4537";
const JSONBIN_API_KEY = "\$2a\$10\$ljfaxrBad4o5XTd62B3hOO/4GlCfSG4HyRfUbIl9DjRAuLuBqoYci";

// Helper to fetch data safely from JSONBin
async function getDataFromBin() {
    try {
        const response = await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}/latest`, {
            headers: { 
                'X-Master-Key': JSONBIN_API_KEY,
                'X-Bin-Meta': 'false' 
            }
        });
        if (!response.ok) return null;
        const json = await response.json();

        if (Array.isArray(json)) return json;
        if (json.record && Array.isArray(json.record)) return json.record;
        return [];
    } catch (e) {
        console.error("Error reading from JSONBin:", e);
        return null; // Return null on error to prevent wiping database!
    }
}

// Helper to save data to JSONBin safely
async function saveDataToBin(data) {
    if (!data || !Array.isArray(data)) return false;
    try {
        const response = await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-Master-Key': JSONBIN_API_KEY
            },
            body: JSON.stringify(data)
        });
        return response.ok;
    } catch (e) {
        console.error("Error writing to JSONBin:", e);
        return false;
    }
}

// POST endpoint for your Discord bot
app.post('/update', async (req, res) => {
    const key = req.query.key;
    if (key !== SECRET_KEY) {
        return res.status(401).json({ status: "error", message: "Unauthorized key" });
    }

    const payload = req.body;
    if (!payload || !payload.username) {
        return res.status(400).json({ status: "error", message: "Invalid payload" });
    }

    let currentData = await getDataFromBin();

    // SAFETY GUARD: If fetching fails, cancel the update to prevent wiping JSONBin!
    if (currentData === null) {
        return res.status(500).json({ status: "error", message: "Failed to read database before saving. Aborted write." });
    }

    const player = String(payload.username).trim();
    const mode = String(payload.mode).toLowerCase().trim();
    const tier = String(payload.tier).trim();
    const region = payload.region ? String(payload.region).trim() : 'AS';
    const skin = payload.skin ? String(payload.skin).trim() : null;

    let found = false;
    for (let p of currentData) {
        if (p.username.toLowerCase() === player.toLowerCase()) {
            p.username = player;
            p.region = region;
            
            if (skin) {
                p.skin = skin;
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
        }
        currentData.push(newPlayer);
    }

    const success = await saveDataToBin(currentData);
    if (success) {
        return res.json({ status: "success", message: "Updated", data: currentData });
    } else {
        return res.status(500).json({ status: "error", message: "Write to cloud failed" });
    }
});

// GET endpoint for your website to read rankings
app.get('/data.json', async (req, res) => {
    let data = await getDataFromBin();
    if (data === null) data = [];
    res.json(data);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
