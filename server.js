const express = require('express');
const cors = require('cors');
const app = express();

let users = [];
let referrals = [];

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.json({ 
        message: 'Kinross Gold API Running!',
        version: '3.0 - Final',
        endpoints: [
            'POST /signup', 'POST /login', 'GET /users',
            'POST /update-balance', 'POST /buy-product',
            'POST /spin-wheel', 'POST /process-returns',
            'POST /request-deposit', 'POST /request-withdrawal',
            'POST /approve-deposit', 'POST /reject-deposit',
            'POST /approve-withdrawal', 'POST /reject-withdrawal',
            'POST /change-password', 'GET /admin-stats'
        ]
    });
});

// ========== SIGNUP ==========
app.post('/signup', (req, res) => {
    const { name, phone, password, referralCode } = req.body;

    if (users.find(u => u.phone === phone)) {
        return res.status(400).json({ error: 'Phone exists' });
    }

    let referredBy = null;
    
    // ONLY track direct referral - NO commissions!
    if (referralCode) {
        let referrer = users.find(u => u.inviteCode === referralCode);
        if (referrer) {
            referredBy = referrer.phone;
            // JUST store who referred them - that's it!
            referrals.push({ referrer: referrer.phone, referral: phone, level: 1, date: new Date().toISOString() });
        }
    }

    const inviteCode = 'KG' + Math.floor(Math.random() * 1000000);

    const newUser = {
        name, 
        phone, 
        password, 
        balance: 10.30, 
        inviteCode, 
        referredBy,  // This stores who referred them
        joined: new Date().toISOString(), 
        lastSpin: 0, 
        lastReturnCheck: Date.now(),
        commission: 0, 
        totalCommission: 0, 
        commissionHistory: [], 
        investments: [], 
        deposits: [], 
        withdrawals: [], 
        spinRecords: [], 
        dailyReturns: [],
        wallet: null
    };

    users.push(newUser);
    res.json({ success: true, user: newUser });
});

// ========== LOGIN ==========
app.post('/login', (req, res) => {
    const { phone, password } = req.body;
    const user = users.find(u => u.phone === phone && u.password === password);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    user.lastLogin = new Date().toISOString();
    res.json({ success: true, user });
});

// ========== CHANGE PASSWORD ==========
app.post('/change-password', (req, res) => {
    const { phone, currentPassword, newPassword } = req.body;
    const user = users.find(u => u.phone === phone);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.password !== currentPassword) return res.status(401).json({ error: 'Current password incorrect' });
    user.password = newPassword;
    res.json({ success: true, message: 'Password changed' });
});

// ========== GET ALL USERS ==========
app.get('/users', (req, res) => {
    const usersWithLevels = users.map(user => {
        const level1 = referrals.filter(r => r.referrer === user.phone && r.level === 1).map(r => ({ phone: r.referral, date: r.date }));
        const level2 = referrals.filter(r => r.referrer === user.phone && r.level === 2).map(r => ({ phone: r.referral, date: r.date }));
        const level3 = referrals.filter(r => r.referrer === user.phone && r.level === 3).map(r => ({ phone: r.referral, date: r.date }));
        return { 
            ...user, 
            level1, 
            level2, 
            level3, 
            password: undefined 
        };
    });
    res.json({ users: usersWithLevels });
});

// ========== UPDATE BALANCE ==========
app.post('/update-balance', (req, res) => {
    const { phone, amount } = req.body;
    const user = users.find(u => u.phone === phone);
    if (!user) return res.status(404).json({ error: 'User not found' });
    user.balance = (user.balance || 10.30) + parseFloat(amount);
    res.json({ success: true, newBalance: user.balance });
});

// ========== BUY PRODUCT WITH COMMISSIONS ==========
app.post('/buy-product', (req, res) => {
    const { phone, name, price, daily } = req.body;
    const user = users.find(u => u.phone === phone);
    if (!user) return res.status(404).json({ error: 'User not found' });
    
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
    
    // ========== REFERRAL COMMISSIONS ==========
if (user.referredBy) {
    // Level 1 (10%)
    const level1User = users.find(u => u.phone === user.referredBy);
    if (level1User) {
        const commission1 = price * 0.10;
        
        // ADD DIRECTLY TO WALLET
        level1User.balance = (level1User.balance || 10.30) + commission1;
        
        // TRACK FOR DISPLAY - BOTH commission AND totalCommission
        level1User.commission = (level1User.commission || 0) + commission1;
        level1User.totalCommission = (level1User.totalCommission || 0) + commission1; // ← ADD THIS LINE!
        
        // Level 2 (2%)
        if (level1User.referredBy) {
            const level2User = users.find(u => u.phone === level1User.referredBy);
            if (level2User) {
                const commission2 = price * 0.02;
                
                // ADD DIRECTLY TO WALLET
                level2User.balance = (level2User.balance || 10.30) + commission2;
                
                // TRACK FOR DISPLAY
                level2User.commission = (level2User.commission || 0) + commission2;
                level2User.totalCommission = (level2User.totalCommission || 0) + commission2; // ← ADD THIS LINE!
                
                // Level 3 (1%)
                if (level2User.referredBy) {
                    const level3User = users.find(u => u.phone === level2User.referredBy);
                    if (level3User) {
                        const commission3 = price * 0.01;
                        
                        // ADD DIRECTLY TO WALLET
                        level3User.balance = (level3User.balance || 10.30) + commission3;
                        
                        // TRACK FOR DISPLAY
                        level3User.commission = (level3User.commission || 0) + commission3;
                        level3User.totalCommission = (level3User.totalCommission || 0) + commission3; // ← ADD THIS LINE!
                    }
                }
            }
        }
    }
}
    
    // Return user with ALL fields including commission data
    res.json({ 
        success: true, 
        user: {
            ...user,
            balance: user.balance,
            commission: user.commission || 0,
            totalCommission: user.totalCommission || 0
        }
    });
});

// ========== SPIN WHEEL ==========
app.post('/spin-wheel', (req, res) => {
    const { phone } = req.body;
    const user = users.find(u => u.phone === phone);
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    const now = Date.now();
    if (now - (user.lastSpin || 0) < 24 * 3600000) {
        const hoursLeft = Math.ceil((24 * 3600000 - (now - (user.lastSpin || 0))) / 3600000);
        return res.status(400).json({ error: `Spin not available yet. ${hoursLeft}h remaining` });
    }
    
    const prize = 0.50;
    user.balance += prize;
    user.lastSpin = now;
    
    if (!user.spinRecords) user.spinRecords = [];
    user.spinRecords.push({ amount: prize, date: new Date().toISOString() });
    
    res.json({ success: true, prize, newBalance: user.balance });
});

// ========== REQUEST DEPOSIT ==========
app.post('/request-deposit', (req, res) => {
    const { phone, amount, transactionId } = req.body;
    const user = users.find(u => u.phone === phone);
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    if (!user.deposits) user.deposits = [];
    user.deposits.push({ 
        amount, 
        transactionId, 
        date: new Date().toISOString(), 
        status: 'pending' 
    });
    
    res.json({ success: true, message: 'Deposit request recorded' });
});

// ========== REQUEST WITHDRAWAL ==========

app.post('/request-withdrawal', (req, res) => {
    const { phone, amount, network, withdrawPhone, accountName } = req.body; // ← ADD accountName
    const user = users.find(u => u.phone === phone);
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    if ((user.balance || 10.30) < amount) {
        return res.status(400).json({ error: 'Insufficient balance' });
    }
    
    user.balance -= amount;
    
    if (!user.withdrawals) user.withdrawals = [];
    user.withdrawals.push({ 
        amount, 
        network, 
        withdrawPhone, 
        accountName: accountName || user.wallet?.name || 'Not provided', // ← ADD THIS
        time: new Date().toISOString(), 
        status: 'pending' 
    });
    
    res.json({ 
        success: true, 
        message: 'Withdrawal request recorded', 
        newBalance: user.balance 
    });
});

// ========== APPROVE DEPOSIT ==========
app.post('/approve-deposit', (req, res) => {
    const { phone, date } = req.body;
    const user = users.find(u => u.phone === phone);
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    const deposit = user.deposits?.find(d => d.date === date);
    if (!deposit) return res.status(404).json({ error: 'Deposit not found' });
    
    user.balance = (user.balance || 10.30) + parseFloat(deposit.amount);
    deposit.status = 'completed';
    
    res.json({ success: true, message: 'Deposit approved', newBalance: user.balance });
});

// ========== REJECT DEPOSIT ==========
app.post('/reject-deposit', (req, res) => {
    const { phone, date } = req.body;
    const user = users.find(u => u.phone === phone);
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    const deposit = user.deposits?.find(d => d.date === date);
    if (!deposit) return res.status(404).json({ error: 'Deposit not found' });
    
    deposit.status = 'rejected';
    
    res.json({ success: true, message: 'Deposit rejected' });
});

// ========== APPROVE WITHDRAWAL ==========
app.post('/approve-withdrawal', (req, res) => {
    const { phone, date } = req.body;
    const user = users.find(u => u.phone === phone);
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    const withdrawal = user.withdrawals?.find(w => w.time === date || w.date === date);
    if (!withdrawal) return res.status(404).json({ error: 'Withdrawal not found' });
    
    withdrawal.status = 'completed';
    
    res.json({ success: true, message: 'Withdrawal approved' });
});

// ========== REJECT WITHDRAWAL ==========
app.post('/reject-withdrawal', (req, res) => {
    const { phone, date } = req.body;
    const user = users.find(u => u.phone === phone);
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    const withdrawal = user.withdrawals?.find(w => w.time === date || w.date === date);
    if (!withdrawal) return res.status(404).json({ error: 'Withdrawal not found' });
    
    user.balance = (user.balance || 10.30) + parseFloat(withdrawal.amount);
    withdrawal.status = 'rejected';
    
    res.json({ success: true, message: 'Withdrawal rejected and refunded', newBalance: user.balance });
});

// ========== ADMIN STATS ==========
app.get('/admin-stats', (req, res) => {
    const totalBalance = users.reduce((sum, u) => sum + (u.balance || 10.30), 0);
    const totalInvestments = users.reduce((sum, u) => sum + (u.investments?.length || 0), 0);
    const pendingDeposits = users.reduce((sum, u) => sum + (u.deposits?.filter(d => d.status === 'pending').length || 0), 0);
    const pendingWithdrawals = users.reduce((sum, u) => sum + (u.withdrawals?.filter(w => w.status === 'pending').length || 0), 0);
    const totalCommissions = users.reduce((sum, u) => sum + (u.totalCommission || 0), 0);
    
    res.json({
        totalUsers: users.length,
        totalBalance,
        totalInvestments,
        pendingDeposits,
        pendingWithdrawals,
        totalCommissions
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Kinross Gold Backend v3.0 running on port ${PORT}`);
    console.log(`✅ Commissions now add directly to wallet and return to frontend!`);
});