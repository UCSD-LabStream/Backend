const path = require('path');
const express = require('express');
const { createServer } = require('https');
const cors = require('cors');
const { Server } = require('socket.io');
const bodyParser = require('body-parser');
const fs = require("fs");
const mqtt = require('mqtt');
const app = express();

app.use(cors());
app.use('/static', express.static(path.join(__dirname, 'public')));
app.use(express.static('public'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

let clients = [];
const HTTP_PORT = 8080;
const options = {
    key: fs.readFileSync("/etc/ssl/private/privkey.pem"),
    cert: fs.readFileSync("/etc/ssl/certs/fullchain.pem"),
};
const httpServer = createServer(options, app);
const io = new Server(httpServer, {
    path: '/labstream/socket.io',
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

// State management
let state = {
    brewsters_filter: 0,
    imageMotorH: "stop",
    imageMotorV: "stop",
    filterMotorH: "stop",
    filterMotorV: "stop",
    lastAdjusted: null
};

const client = mqtt.connect('mqtts://labstream.ucsd.edu:1883');

client.on('connect', () => {
    console.log('Connected to MQTT broker!');
    client.subscribe('brewsters_filter');
    client.subscribe('brewsters_filter_distance');
    client.subscribe('filter_motor_H');
    client.subscribe('filter_motor_V');
    client.subscribe('image_motor_H');
    client.subscribe('image_motor_V');
});

client.on('message', (topic, message) => {
    console.log(topic)
    console.log(message.toString())
    switch (topic) {
        case 'filter_motor_H':
            if (message.toString() === '3') {
                socket.emit('filter_motor_H_done');
            }
        case 'filter_motor_V':
            if (message.toString() === '3') {
                socket.emit('filter_motor_V_done');
            }
        case 'image_motor_H':
            if (message.toString() === '3') {
                socket.emit('image_motor_H_done');
            }
        case 'image_motor_V':
            if (message.toString() === '3') {
                socket.emit('image_motor_V_done');
            }
        case 'brewsters_filter':
            switch (message.toString()) {
                case '4':
                    socket.emit('filter_homed');
                case '5':
                    socket.emit('filter_limit', "0")
                case '6':
                    socketk.emit('filter_limit', "1")
            }
        case 'brewsters_filter_distance':
            let dist = parseFloat(message.toString())/1.7277;
            socket.emit('filter_distance', dist.toFixed(3)); 
    } 
});

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('Front-end connected');

    socket.on('adjust', (data) => {
        const { gear, value } = data;
        switch(gear) {
            case 1:
                state.filterMotorH = value;
                client.publish("filter_motor_H", String(value));
                break;
	    case 2:
                state.filterMotorV = value;
                client.publish("filter_motor_V", String(value));
                break;
            case 3:
                state.imageMotorH = value;
                client.publish("image_motor_H", String(value));
                break;
	    case 4:
                state.imageMotorV = value;
                client.publish("image_motor_V", String(value));
                break;
        }

        state.lastAdjusted = new Date().toISOString().replace('T', ' ').substring(0, 19);
    });

    socket.on('brewsters_adjust', (data) => {
         const { value } = data;
        state.brewsters_filter = value;
        client.publish("brewsters_filter", String(value));
        state.lastAdjusted = new Date().toISOString().replace('T', ' ').substring(0, 19);
    });

    socket.on('gear_state', () => {
        state.filterMotorH = "stop";
        state.filterMotorV = "stop";
        state.imageMotorH = "stop";
        state.imageMotorV = "stop";
    });

    socket.on('brewsters_gear_state', () => {
        state.brewsters_filter = 0;
    });

});

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
        <p>Filter motor H state: ${state.filterMotorH}</p>
        <p>Filter motor V state: ${state.filterMotorV}</p>
        <p>Image motor H state: ${state.imageMotorH}</p>
        <p>Image motor V state: ${state.imageMotorV}</p>
        <p>Brewster's filter motor state: ${state.brewsters_filter}</p>
        <p>To change the gear value, please visit our front end.</p>
        </body>
        </html>
    `);
});

process.on('uncaughtException', (error, origin) => {
	console.log('----- Uncaught exception -----');
	console.log(error);
	console.log('----- Exception origin -----');
	console.log(origin);
	console.log('----- Status -----');
});

const cameraServer = new Server(httpServer, {
	path: '/camera',
	cors: {
		origin: '*',
		methods: ['GET', 'POST']
	}
});

let hostSocket;
let viewerPeerIds = [];

cameraServer.on('connection', (socket) => {
	console.log("Viewer or streamer joined");
	clients.push(socket);
	socket.on('stream_start', (data) => {
		data = JSON.parse(data);
		console.log(data);
		hostPeerId = data.hostId;
		hostSocket = socket;
	});
	socket.on('stream_view', (data) => {
		data = JSON.parse(data);
		console.log(data);
		viewerPeerIds.push(data.viewerId);
		hostSocket.emit('viewer_join', data.viewerId);
	});
});

httpServer.listen(HTTP_PORT,()=>{ console.log(`HTTPS server starting on ${HTTP_PORT}`); });
