const express = require('express');
const cors = require('cors');
const app = express();

let users = [];
let referrals = [];
let transactions = []; // Track all transactions for history

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.json({ 
        message: 'Kinross Gold API Running!',
        version: '2.0 - Complete',
        status: 'All systems operational'
    });
});

// ========== USER AUTH ==========
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
        lastReturnCheck: Date.now(),
        commission: 0,
        commissionHistory: [],
        investments: [],
        deposits: [],
        withdrawals: [],
        spinRecords: [],
        dailyReturns: [],
        passwordChanged: false
    };

    users.push(newUser);
    
    // Log transaction
    transactions.push({
        type: 'signup',
        user: phone,
        amount: 10.30,
        description: 'Welcome bonus',
        date: new Date().toISOString()
    });
    
    res.json({ success: true, user: newUser });
});

app.post('/login', (req, res) => {
    const { phone, password } = req.body;
    const user = users.find(u => u.phone === phone && u.password === password);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    
    // Update last login
    user.lastLogin = new Date().toISOString();
    
    res.json({ success: true, user });
});

// ========== PASSWORD MANAGEMENT ==========
app.post('/change-password', (req, res) => {
    const { phone, currentPassword, newPassword } = req.body;
    const user = users.find(u => u.phone === phone);
    
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }
    
    if (user.password !== currentPassword) {
        return res.status(401).json({ error: 'Current password incorrect' });
    }
    
    user.password = newPassword;
    user.passwordChanged = true;
    user.lastPasswordChange = new Date().toISOString();
    
    res.json({ 
        success: true, 
        message: 'Password changed successfully' 
    });
});

// ========== DAILY RETURNS PROCESSING ==========
app.post('/process-returns', (req, res) => {
    const { phone } = req.body;
    const user = users.find(u => u.phone === phone);
    
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }
    
    const now = Date.now();
    const lastCheck = user.lastReturnCheck || now;
    const hoursPassed = (now - lastCheck) / (1000 * 60 * 60);
    const daysPassed = Math.floor(hoursPassed / 24);
    
    if (daysPassed < 1) {
        return res.json({ 
            success: true, 
            message: 'No returns due yet',
            nextReturnIn: 24 - (hoursPassed % 24) + ' hours'
        });
    }
    
    let totalReturn = 0;
    const processedDays = Math.min(daysPassed, 60);
    
    for (let day = 0; day < processedDays; day++) {
        user.investments.forEach(inv => {
            if (inv.daysLeft > 0) {
                const dailyAmount = inv.dailyReturn || inv.amount * 0.05;
                user.balance += dailyAmount;
                inv.daysLeft--;
                totalReturn += dailyAmount;
            }
        });
    }
    
    user.lastReturnCheck = now;
    
    if (totalReturn > 0) {
        user.dailyReturns.push({
            amount: totalReturn,
            days: processedDays,
            date: new Date().toISOString()
        });
        
        transactions.push({
            type: 'daily_return',
            user: phone,
            amount: totalReturn,
            description: `Returns for ${processedDays} day(s)`,
            date: new Date().toISOString()
        });
    }
    
    res.json({
        success: true,
        returns: totalReturn,
        daysProcessed: processedDays,
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
    
    // Check purchase limit
    const productCount = (user.investments || []).filter(t => t.name === name).length;
    if (productCount >= 2) {
        return res.status(400).json({ error: 'Maximum 2 purchases per tool' });
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
    
    // Log transaction
    transactions.push({
        type: 'purchase',
        user: phone,
        amount: price,
        description: `Purchased ${name}`,
        date: new Date().toISOString()
    });
    
    // Calculate commissions for referrers
    const commissionChain = [];
    
    const referrer1 = referrals.find(r => r.referral === phone && r.level === 1);
    if (referrer1) {
        const level1User = users.find(u => u.phone === referrer1.referrer);
        if (level1User) {
            const commission = price * 0.10;
            level1User.balance += commission;
            level1User.commission = (level1User.commission || 0) + commission;
            
            if (!level1User.commissionHistory) level1User.commissionHistory = [];
            level1User.commissionHistory.push({
                amount: commission,
                from: phone,
                level: 1,
                date: new Date().toISOString()
            });
            
            commissionChain.push({ level: 1, user: level1User.phone, amount: commission });
            
            transactions.push({
                type: 'commission',
                user: level1User.phone,
                amount: commission,
                description: `Level 1 commission from ${phone}`,
                date: new Date().toISOString()
            });
        }
        
        const referrer2 = referrals.find(r => r.referral === referrer1.referrer && r.level === 1);
        if (referrer2) {
            const level2User = users.find(u => u.phone === referrer2.referrer);
            if (level2User) {
                const commission = price * 0.02;
                level2User.balance += commission;
                level2User.commission = (level2User.commission || 0) + commission;
                
                if (!level2User.commissionHistory) level2User.commissionHistory = [];
                level2User.commissionHistory.push({
                    amount: commission,
                    from: phone,
                    level: 2,
                    date: new Date().toISOString()
                });
                
                commissionChain.push({ level: 2, user: level2User.phone, amount: commission });
                
                transactions.push({
                    type: 'commission',
                    user: level2User.phone,
                    amount: commission,
                    description: `Level 2 commission from ${phone}`,
                    date: new Date().toISOString()
                });
            }
            
            const referrer3 = referrals.find(r => r.referral === referrer2.referrer && r.level === 1);
            if (referrer3) {
                const level3User = users.find(u => u.phone === referrer3.referrer);
                if (level3User) {
                    const commission = price * 0.01;
                    level3User.balance += commission;
                    level3User.commission = (level3User.commission || 0) + commission;
                    
                    if (!level3User.commissionHistory) level3User.commissionHistory = [];
                    level3User.commissionHistory.push({
                        amount: commission,
                        from: phone,
                        level: 3,
                        date: new Date().toISOString()
                    });
                    
                    commissionChain.push({ level: 3, user: level3User.phone, amount: commission });
                    
                    transactions.push({
                        type: 'commission',
                        user: level3User.phone,
                        amount: commission,
                        description: `Level 3 commission from ${phone}`,
                        date: new Date().toISOString()
                    });
                }
            }
        }
    }
    
    res.json({ 
        success: true, 
        user: {
            ...user,
            balance: user.balance
        },
        commissionChain
    });
});

// ========== SPIN WHEEL ==========
app.post('/spin-wheel', (req, res) => {
    const { phone } = req.body;
    const user = users.find(u => u.phone === phone);
    
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }
    
    const now = Date.now();
    const lastSpin = user.lastSpin || 0;
    
    if (now - lastSpin < 24 * 3600000) {
        const hoursLeft = Math.ceil((24 * 3600000 - (now - lastSpin)) / 3600000);
        return res.status(400).json({ 
            error: 'Spin not available yet',
            hoursLeft
        });
    }
    
    const prize = 0.50;
    user.balance += prize;
    user.lastSpin = now;
    
    if (!user.spinRecords) user.spinRecords = [];
    user.spinRecords.push({
        amount: prize,
        date: new Date().toISOString()
    });
    
    transactions.push({
        type: 'spin',
        user: phone,
        amount: prize,
        description: 'Lucky wheel win',
        date: new Date().toISOString()
    });
    
    res.json({
        success: true,
        prize,
        newBalance: user.balance,
        nextSpinIn: 24 * 3600000
    });
});

// ========== DEPOSIT REQUESTS ==========
app.post('/request-deposit', (req, res) => {
    const { phone, amount, reference } = req.body;
    const user = users.find(u => u.phone === phone);
    
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }
    
    if (amount < 90) {
        return res.status(400).json({ error: 'Minimum deposit is GHS 90' });
    }
    
    const deposit = {
        amount: parseFloat(amount),
        reference,
        date: new Date().toISOString(),
        status: 'pending'
    };
    
    if (!user.deposits) user.deposits = [];
    user.deposits.push(deposit);
    
    transactions.push({
        type: 'deposit_request',
        user: phone,
        amount: parseFloat(amount),
        description: `Deposit request - Ref: ${reference}`,
        date: new Date().toISOString()
    });
    
    res.json({ success: true, deposit });
});

// ========== WITHDRAWAL REQUESTS ==========
app.post('/request-withdrawal', (req, res) => {
    const { phone, amount, network, withdrawPhone } = req.body;
    const user = users.find(u => u.phone === phone);
    
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }
    
    if (amount < 30) {
        return res.status(400).json({ error: 'Minimum withdrawal is GHS 30' });
    }
    
    if ((user.balance || 10.30) < amount) {
        return res.status(400).json({ error: 'Insufficient balance' });
    }
    
    if (!user.investments || user.investments.length === 0) {
        return res.status(400).json({ error: 'Must invest before withdrawing' });
    }
    
    // Calculate fee
    const fee = amount * 0.15;
    const receive = amount - fee;
    
    // Deduct balance
    user.balance -= amount;
    
    const withdrawal = {
        amount: parseFloat(amount),
        fee,
        receive,
        network,
        withdrawPhone,
        time: new Date().toISOString(),
        status: 'pending'
    };
    
    if (!user.withdrawals) user.withdrawals = [];
    user.withdrawals.push(withdrawal);
    
    transactions.push({
        type: 'withdrawal_request',
        user: phone,
        amount: parseFloat(amount),
        description: `Withdrawal request to ${network} ${withdrawPhone}`,
        date: new Date().toISOString()
    });
    
    res.json({ success: true, withdrawal, newBalance: user.balance });
});

// ========== ADMIN ENDPOINTS ==========

// Approve Deposit
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
    
    transactions.push({
        type: 'deposit_approved',
        user: phone,
        amount: deposit.amount,
        description: 'Deposit approved by admin',
        date: new Date().toISOString(),
        admin: true
    });
    
    res.json({ 
        success: true, 
        message: 'Deposit approved and user credited',
        newBalance: user.balance
    });
});

// Reject Deposit
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
    
    transactions.push({
        type: 'deposit_rejected',
        user: phone,
        amount: deposit.amount,
        description: 'Deposit rejected by admin',
        date: new Date().toISOString(),
        admin: true
    });
    
    res.json({ 
        success: true, 
        message: 'Deposit rejected'
    });
});

// Approve Withdrawal
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
    
    transactions.push({
        type: 'withdrawal_approved',
        user: phone,
        amount: withdrawal.amount,
        description: 'Withdrawal approved by admin',
        date: new Date().toISOString(),
        admin: true
    });
    
    res.json({ 
        success: true, 
        message: 'Withdrawal marked as paid'
    });
});

// Reject Withdrawal
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
    
    transactions.push({
        type: 'withdrawal_rejected',
        user: phone,
        amount: withdrawal.amount,
        description: 'Withdrawal rejected by admin - refunded',
        date: new Date().toISOString(),
        admin: true
    });
    
    res.json({ 
        success: true, 
        message: 'Withdrawal rejected and refunded',
        newBalance: user.balance
    });
});

// Admin Stats
app.get('/admin-stats', (req, res) => {
    const totalUsers = users.length;
    const totalBalance = users.reduce((sum, u) => sum + (u.balance || 10.30), 0);
    const totalInvestments = users.reduce((sum, u) => sum + (u.investments?.length || 0), 0);
    const pendingDeposits = users.reduce((sum, u) => 
        sum + (u.deposits?.filter(d => d.status === 'pending').length || 0), 0);
    const pendingWithdrawals = users.reduce((sum, u) => 
        sum + (u.withdrawals?.filter(w => w.status === 'pending').length || 0), 0);
    const totalCommissions = users.reduce((sum, u) => sum + (u.commission || 0), 0);
    
    res.json({
        totalUsers,
        totalBalance,
        totalInvestments,
        pendingDeposits,
        pendingWithdrawals,
        totalCommissions,
        activeToday: users.filter(u => {
            const lastLogin = u.lastLogin ? new Date(u.lastLogin) : new Date(0);
            const today = new Date();
            return lastLogin.toDateString() === today.toDateString();
        }).length
    });
});

// All Transactions (Admin only)
app.get('/all-transactions', (req, res) => {
    // Sort by date, newest first
    const sorted = [...transactions].sort((a, b) => 
        new Date(b.date) - new Date(a.date)
    );
    res.json({ transactions: sorted });
});

// ========== GET ALL USERS (with full data) ==========
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
            level3,
            // Don't send password to frontend
            password: undefined
        };
    });

    res.json({ users: usersWithLevels });
});

// ========== UPDATE BALANCE (Admin) ==========
app.post('/update-balance', (req, res) => {
    const { phone, amount } = req.body;
    const user = users.find(u => u.phone === phone);
    
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }

    user.balance = (user.balance || 10.30) + parseFloat(amount);
    
    transactions.push({
        type: 'admin_add',
        user: phone,
        amount: parseFloat(amount),
        description: 'Admin added balance',
        date: new Date().toISOString(),
        admin: true
    });
    
    res.json({ 
        success: true, 
        newBalance: user.balance,
        message: `Added GHS ${amount} to ${phone}`
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Kinross Gold Backend v2.0 running on port ${PORT}`);
    console.log(`✅ All endpoints ready:`);
    console.log(`   - User auth (signup/login)`);
    console.log(`   - Password management`);
    console.log(`   - Daily returns processing`);
    console.log(`   - Product purchases`);
    console.log(`   - Spin wheel`);
    console.log(`   - Deposit/withdrawal requests`);
    console.log(`   - Admin approvals/rejections`);
    console.log(`   - Full transaction history`);
});