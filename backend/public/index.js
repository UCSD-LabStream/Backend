// const ws = new WebSocket('ws://13.57.216.198:8555');
const ws = new WebSocket('ws://localhost:8555');

var peer = new Peer();
let hostId;
let hostVideo;
let viewerIds = [];
let call;
let localStream;

async function init() {
    let stream = await navigator.mediaDevices.getUserMedia({video: true, audio: true});
    localStream = stream;
    hostVideo = document.getElementById('video');
    hostVideo.srcObject = localStream;
}

peer.on('open', function(id) {
    hostId = id;
});

ws.addEventListener('open', async (event) => {
    await new Promise(resolve => {
        const checkHostId = setInterval(() => {
            if (typeof hostId !== 'undefined') {
                clearInterval(checkHostId);
                resolve();
            }
        }, 100);
    });

    ws.send(JSON.stringify({
        'client': '8555',
        'operation': 'connecting',
        'hostId': hostId
    }));
});

ws.addEventListener('message', (event) => {
    call = peer.call(event.data, localStream)
    let exampleText = document.getElementById('example-text')
    exampleText.innerHTML = event.data;
})

init()

