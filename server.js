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
                level: 1,
                date: new Date().toISOString()
            });
            
            // Check for level 2
            const parentReferral = referrals.find(r => r.referral === referrer.phone);
            if (parentReferral) {
                referrals.push({
                    referrer: parentReferral.referrer,
                    referral: phone,
                    level: 2,
                    date: new Date().toISOString()
                });
                
                // Check for level 3
                const grandParentReferral = referrals.find(r => r.referral === parentReferral.referrer);
                if (grandParentReferral) {
                    referrals.push({
                        referrer: grandParentReferral.referrer,
                        referral: phone,
                        level: 3,
                        date: new Date().toISOString()
                    });
                }
            }
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
        const level1 = referrals.filter(r => r.referrer === user.phone && r.level === 1).map(r => ({
            phone: r.referral,
            date: r.date
        }));
        
        const level2 = referrals.filter(r => r.referrer === user.phone && r.level === 2).map(r => ({
            phone: r.referral,
            date: r.date
        }));
        
        const level3 = referrals.filter(r => r.referrer === user.phone && r.level === 3).map(r => ({
            phone: r.referral,
            date: r.date
        }));

        return {
            ...user,
            level1,
            level2,
            level3
        };
    });

    res.json({ users: usersWithLevels });
});

// ========== UPDATE BALANCE ==========
app.post('/update-balance', (req, res) => {
    const { phone, amount } = req.body;
    const user = users.find(u => u.phone === phone);
    
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }

    user.balance = (user.balance || 10.30) + parseFloat(amount);
    
    res.json({ 
        success: true, 
        newBalance: user.balance,
        message: `Added GHS ${amount} to ${phone}`
    });
});

// ========== APPROVE DEPOSIT ==========
app.post('/approve-deposit', (req, res) => {
    const { phone, date } = req.body;
    const user = users.find(u => u.phone === phone);
    
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }
    
    const deposit = user.deposits?.find(d => d.date === date);
    if (!deposit) {
        return res.status(404).json({ error: 'Deposit not found' });
    }
    
    // Add balance
    user.balance = (user.balance || 10.30) + parseFloat(deposit.amount);
    
    // Update status
    deposit.status = 'completed';
    
    res.json({ 
        success: true, 
        message: 'Deposit approved and user credited',
        newBalance: user.balance
    });
});

// ========== REJECT DEPOSIT ==========
app.post('/reject-deposit', (req, res) => {
    const { phone, date } = req.body;
    const user = users.find(u => u.phone === phone);
    
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }
    
    const deposit = user.deposits?.find(d => d.date === date);
    if (!deposit) {
        return res.status(404).json({ error: 'Deposit not found' });
    }
    
    deposit.status = 'rejected';
    
    res.json({ 
        success: true, 
        message: 'Deposit rejected'
    });
});

// ========== APPROVE WITHDRAWAL ==========
app.post('/approve-withdrawal', (req, res) => {
    const { phone, date } = req.body;
    const user = users.find(u => u.phone === phone);
    
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }
    
    const withdrawal = user.withdrawals?.find(w => w.time === date || w.date === date);
    if (!withdrawal) {
        return res.status(404).json({ error: 'Withdrawal not found' });
    }
    
    withdrawal.status = 'completed';
    
    res.json({ 
        success: true, 
        message: 'Withdrawal marked as paid'
    });
});

// ========== REJECT WITHDRAWAL ==========
app.post('/reject-withdrawal', (req, res) => {
    const { phone, date } = req.body;
    const user = users.find(u => u.phone === phone);
    
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }
    
    const withdrawal = user.withdrawals?.find(w => w.time === date || w.date === date);
    if (!withdrawal) {
        return res.status(404).json({ error: 'Withdrawal not found' });
    }
    
    // Refund the user
    user.balance = (user.balance || 10.30) + parseFloat(withdrawal.amount);
    
    withdrawal.status = 'rejected';
    
    res.json({ 
        success: true, 
        message: 'Withdrawal rejected and refunded',
        newBalance: user.balance
    });
});

// ========== BUY PRODUCT ==========
app.post('/buy-product', (req, res) => {
    const { phone, name, price, daily } = req.body;
    const user = users.find(u => u.phone === phone);
    
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }
    
    if ((user.balance || 10.30) < price) {
        return res.status(400).json({ error: 'Insufficient balance' });
    }
    
    // Deduct balance
    user.balance -= price;
    
    // Add investment
    if (!user.investments) user.investments = [];
    user.investments.push({
        name,
        amount: price,
        dailyReturn: daily,
        date: new Date().toISOString(),
        daysLeft: 90
    });
    
    // Calculate commissions for referrers
    const referrer1 = referrals.find(r => r.referral === phone && r.level === 1);
    if (referrer1) {
        const level1User = users.find(u => u.phone === referrer1.referrer);
        if (level1User) {
            const commission = price * 0.10;
            level1User.balance += commission;
            level1User.commission = (level1User.commission || 0) + commission;
        }
        
        const referrer2 = referrals.find(r => r.referral === referrer1.referrer && r.level === 1);
        if (referrer2) {
            const level2User = users.find(u => u.phone === referrer2.referrer);
            if (level2User) {
                const commission = price * 0.02;
                level2User.balance += commission;
                level2User.commission = (level2User.commission || 0) + commission;
            }
            
            const referrer3 = referrals.find(r => r.referral === referrer2.referrer && r.level === 1);
            if (referrer3) {
                const level3User = users.find(u => u.phone === referrer3.referrer);
                if (level3User) {
                    const commission = price * 0.01;
                    level3User.balance += commission;
                    level3User.commission = (level3User.commission || 0) + commission;
                }
            }
        }
    }
    
    res.json({ 
        success: true, 
        user: {
            ...user,
            balance: user.balance
        }
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Server running'));