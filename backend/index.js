const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());

const httpServer = createServer(app);
const io = new Server(httpServer, {
    path: '/labstream/socket.io',
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

// State management
let state = {
    gear1: 0,
    gear2: 0,
    gear3: 0,
    gear4: 0,
    lastAdjusted: null
};

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('Client connected');

    socket.on('adjust', (data) => {
        const { gear, value } = data;

        switch(gear) {
            case 1:
                state.gear1 = value;
                break;
            case 2:
                state.gear2 = value;
                break;
            case 3:
                state.gear3 = value;
                break;
            case 4:
                state.gear4 = value;
                break;
        }

        state.lastAdjusted = new Date().toISOString().replace('T', ' ').substring(0, 19);

        io.emit('gear', {
            gear1: state.gear1,
            gear2: state.gear2,
            gear3: state.gear3,
            gear4: state.gear4,
            last_adjusted: state.lastAdjusted
        });
    });

    socket.on('gear_state', () => {
        socket.emit('gear', {
            gear1: state.gear1,
            gear2: state.gear2,
            gear3: state.gear3,
            gear4: state.gear4,
            last_adjusted: state.lastAdjusted
        });
    });
});

// Express routes
app.get('/labstream', (req, res) => {
    res.send(`
        <html>
        <head>
        <title>LabStream</title>
        </head>
        <body>
        <h1>LabStream</h1>
        <p>You have reached the LabStream server. You can see the gear values.</p>
        <p>Last adjusted: ${state.lastAdjusted || 'Have not been adjusted'}</p>
        <p>Gear 1: ${state.gear1} degrees</p>
        <p>Gear 2: ${state.gear2} degrees</p>
        <p>Gear 3: ${state.gear3} degrees</p>
        <p>Gear 4: ${state.gear4} degrees</p>
        <p>To change the gear value, please visit our front end.</p>
        </body>
        </html>
    `);
});

app.get('/frontend', (req, res) => {
    res.sendFile(path.join(__dirname, 'templates', 'index.html'));
});

// Start server
const PORT = 8080;
httpServer.listen(PORT, () => {
    console.log(`Starting server on port ${PORT}`);
});