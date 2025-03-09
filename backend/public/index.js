const socket = io('https://labstream.ucsd.edu.', {
	path: '/camera/socket.io',
});

console.log('is socket connected? ', socket.connected);

var peer = new Peer();
let hostId;
let hostVideo;
let viewerIds = [];
let call;
let stream;

async function init() {
	const testing = await navigator.mediaDevices.getUserMedia({video: true, audio: false});
	const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter(device => device.kind === 'videoinput');
	const streams = [];
	// first stream
	stream = await navigator.mediaDevices.getUserMedia({video: { deviceId: videoDevices[0].deviceId }, audio: false});
	if (videoDevices.length > 1) {
	let secondaryStream = await navigator.mediaDevices.getUserMedia({video: { deviceId: videoDevices[1].deviceId }, audio: false});
	stream.addTrack(secondaryStream.getVideoTracks()[0]);
		let secondaryVideo = document.getElementById('video2');
        secondaryVideo.srcObject = secondaryStream;
	}
    hostVideo = document.getElementById('video');
    hostVideo.srcObject = stream;
}

peer.on('open', function(id) {
    hostId = id;
});

socket.on('connect', async (event) => {
	console.log('Connected to server!');
    await new Promise(resolve => {
        const checkHostId = setInterval(() => {
            if (typeof hostId !== 'undefined') {
                clearInterval(checkHostId);
                resolve();
            }
        }, 100);
    });

    socket.emit('stream_start',  JSON.stringify({
        'client': '8555',
        'operation': 'connecting',
        'hostId': hostId
    }));
});

socket.on('viewer_join', (event) => {
    call = peer.call(event, stream)
    let exampleText = document.getElementById('example-text')
    exampleText.innerHTML = event;
})

init()

