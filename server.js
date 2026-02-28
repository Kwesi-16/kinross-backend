const express = require('express');
const cors = require('cors');
const app = express();

// Store users in memory (for now)
let users = [];

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.json({ message: 'Kinross Gold API Running!' });
});

app.post('/signup', (req, res) => {
    const { name, phone, password } = req.body;
    
    // Check if user exists
    if (users.find(u => u.phone === phone)) {
        return res.status(400).json({ error: 'Phone exists' });
    }
    
    // Create new user
    const newUser = {
        name,
        phone,
        password,
        balance: 10.30,
        joined: new Date().toISOString()
    };
    
    users.push(newUser);
    res.json({ success: true, user: newUser });
});

app.post('/login', (req, res) => {
    const { phone, password } = req.body;
    const user = users.find(u => u.phone === phone && u.password === password);
    
    if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    res.json({ success: true, user });
});

app.get('/users', (req, res) => {
    res.json({ users });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
