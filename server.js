const express = require('express');
const cors = require('cors');
const app = express();

// In‑memory database (replace with real DB later if needed)
let users = [];
let referrals = []; // track who referred whom

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.json({ message: 'Kinross Gold API Running!' });
});

// SIGNUP
app.post('/signup', (req, res) => {
    const { name, phone, password, referralCode } = req.body;

    if (users.find(u => u.phone === phone)) {
        return res.status(400).json({ error: 'Phone exists' });
    }

    // Find referrer if code provided
    let referredBy = null;
    if (referralCode) {
        let referrer = users.find(u => u.inviteCode === referralCode);
        if (referrer) {
            referredBy = referrer.phone;
            // Track the referral
            referrals.push({
                referrer: referrer.phone,
                referral: phone,
                level: 1
            });
        }
    }

    const inviteCode = 'KG' + Math.floor(Math.random() * 1000000);

    const newUser = {
        name,
        phone,
        password,
        balance: 10.30,
        inviteCode,
        referredBy,
        joined: new Date().toISOString(),
        lastSpin: 0,
        commission: 0,
        investments: [],
        level1: [],
        level2: [],
        level3: []
    };

    users.push(newUser);
    res.json({ success: true, user: newUser });
});

// LOGIN
app.post('/login', (req, res) => {
    const { phone, password } = req.body;
    const user = users.find(u => u.phone === phone && u.password === password);
    if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }
    res.json({ success: true, user });
});

// GET ALL USERS (with referral data)
app.get('/users', (req, res) => {
    // Build referral levels for each user
    users.forEach(user => {
        user.level1 = referrals.filter(r => r.referrer === user.phone && r.level === 1).map(r => r.referral);
        user.level2 = referrals.filter(r => r.referrer === user.phone && r.level === 2).map(r => r.referral);
        user.level3 = referrals.filter(r => r.referrer === user.phone && r.level === 3).map(r => r.referral);
    });

    res.json({ users });
});

// UPDATE BALANCE (admin only – no auth for now)
app.post('/update-balance', (req, res) => {
    const { phone, amount } = req.body;
    const user = users.find(u => u.phone === phone);
    if (!user) return res.status(404).json({ error: 'User not found' });

    user.balance = (user.balance || 10.30) + amount;
    res.json({ success: true, newBalance: user.balance });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));