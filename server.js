const express = require('express');
const cors = require('cors');
const app = express();

let users = [];
let referrals = [];

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.json({ message: 'Kinross Gold API Running!' });
});

// ========== SIGNUP ==========
app.post('/signup', (req, res) => {
    const { name, phone, password, referralCode } = req.body;

    if (users.find(u => u.phone === phone)) {
        return res.status(400).json({ error: 'Phone exists' });
    }

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
        referredBy,  // ← THIS WAS MISSING
        joined: new Date().toISOString(),
        lastSpin: 0,
        commission: 0,
        investments: [],
        deposits: [],
        withdrawals: [],
        spinRecords: [],
        dailyReturns: []
    };

    users.push(newUser);
    res.json({ success: true, user: newUser });
});

// ========== LOGIN ==========
app.post('/login', (req, res) => {
    const { phone, password } = req.body;
    const user = users.find(u => u.phone === phone && u.password === password);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    res.json({ success: true, user });
});

// ========== GET ALL USERS ==========
app.get('/users', (req, res) => {
    const usersWithLevels = users.map(user => {
        const level1 = referrals.filter(r => r.referrer === user.phone && r.level === 1).map(r => r.referral);
        const level2 = referrals.filter(r => r.referrer === user.phone && r.level === 2).map(r => r.referral);
        const level3 = referrals.filter(r => r.referrer === user.phone && r.level === 3).map(r => r.referral);

        return {
            ...user,
            level1,
            level2,
            level3
        };
    });

    res.json({ users: usersWithLevels });
});

// ========== UPDATE BALANCE (FIXED) ==========
app.post('/update-balance', (req, res) => {
    const { phone, amount } = req.body;
    const user = users.find(u => u.phone === phone);
    
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }

    // Add to balance
    user.balance = (user.balance || 10.30) + parseFloat(amount);
    
    // Record the deposit
    if (!user.deposits) user.deposits = [];
    user.deposits.push({
        amount: parseFloat(amount),
        date: new Date().toISOString(),
        type: 'admin_add'
    });

    res.json({ 
        success: true, 
        newBalance: user.balance,
        message: `Added GHS ${amount} to ${phone}`
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Server running'));