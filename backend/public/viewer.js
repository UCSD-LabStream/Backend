const socket = io("https://labstream.ucsd.edu", {
	path: '/camera/socket.io',
});

var peer = new Peer();
let viewerId;

peer.on('open', function(id) {
	viewerId = id;
});

peer.on('call', function(call) {
	call.answer();
	call.on('stream', (stream) => {
		let hostVideo = document.getElementById('video');
	let videoTracks = stream.getVideoTracks();
		let stream1 = new MediaStream([videoTracks[0]]);
		if (videoTracks.length > 1) {
			let stream2 = new MediaStream([videoTracks[1]]);
			document.getElementById('video2').srcObject = stream2;
		}
    	hostVideo.srcObject = stream1;
	})
  });

socket.on('connect', async (event) => {
    await new Promise(resolve => {
        const checkViewerId = setInterval(() => {
            if (typeof viewerId !== 'undefined') {
                clearInterval(checkViewerId);
                resolve();
            }
        }, 100);
    });

    socket.emit("stream_view", JSON.stringify({
        'client': '8555',
        'operation': 'connecting',
        'viewerId': viewerId
    }));
});
