const axios = require('axios');
const config = require('../../util/config');
const WebSocket = require('ws');
const Promise = require('bluebird');
const axiosWebStreamer = require('../webStreamer/index');
const groupManager = require('../../util/groupManager');
const sessionManager = require('../../util/sessionManager');

const wsName = 'thirdpartyWMS';
let global_seq = 1;
const CRLF = '\r\n';

let ws;

let intervalTimer = setInterval(()=> {
    try {
        ws = new WebSocket(`${config.signalingServer[1]}/${wsName}`);
    } catch (err) {
        console.log(err.message);
    }
    if(ws) {
        ws.on('open', function open() {
            clearInterval(intervalTimer);
            console.log(`WebSocket client ${wsName} has connected to server ${config.signalingServer[1]}`)
        });

        ws.on('message', function incoming(data) {
            let chunk;

            if (typeof data !== 'string') {
                chunk = data.toString();
            } else {
                chunk = data;
            }
            let parser = parse_msg(chunk);
            if(parser) {
                OnMessage(parser.body, parser.header);
            }
        });

        ws.on('error', (err) => {
            console.log(err);
        })
    }
}, 3000);

function subscriptionGenerator(msg) {
    return `request:${global_seq++}${CRLF}method:POST${CRLF}path:/webrtc/subscription${CRLF}${CRLF}${JSON.stringify(msg)}`;
}

function send(msg) {
    if(ws && ws.readyState === WebSocket.OPEN) {
        ws.send(msg);
    }
}

const instance = axios.create({
    baseURL: `${config.signalingServer[0]}`
});

async function createPeerConnection(connectionId, groupId = '') {
    let res = await instance.post('/webrtc/peerconnection', {
        connection: connectionId,
        group: groupId
    });
    if(res.status === 200) {
        let subscribeMsg = {
            endpoint : [{
                type: 'offerer',
                group: groupId,
                connection: connectionId,
                topic: ['connection']
            }],
            notify_addr: wsName
        };
        send(subscriptionGenerator(subscribeMsg))
    }
    return Promise.resolve(res);
}

function destroyPeerConnection(connectionId, groupId = '') {
    return instance.delete('/webrtc/peerconnection', {
        data: {
            connection: connectionId,
            group: groupId
        }
    });
}

function createGroup(groupId) {
    return instance.post('/webrtc/group', {
        group: groupId
    });
}

function destroyGroup(groupId) {
    return instance.delete('/webrtc/group', {
        data: {
            group: groupId
        }
    });
}

function parse_msg(ws_data) {
    let index = ws_data.indexOf(`${CRLF}${CRLF}`),
        body = ws_data.slice(index + CRLF.length*2);

    if (index === -1) {
        error('invalid websocket msg! no \r\n!');
        return null;
    }
    let headersString = ws_data.slice(0, index + CRLF.length),
        header = Object.create(null),
        start = 0;

    while (true) {
        let pos = headersString.indexOf(CRLF, start);

        if (pos === -1) {
            break;
        }
        let line = headersString.slice(start, pos);

        start = pos + CRLF.length;

        let arr = line.split(':'),
            key = arr[0].trim(),
            value = arr[1].trim();

        switch (key) {
            case 'request':
            case 'response':
            case 'status_code':
            {
                header[key] = Number.parseInt(value);
                break;
            }
            case 'method':
            {
                header.method = value;
                break;
            }
            case 'path':
            {
                header.url = value;
                break;
            }
        }
    }

    if (!header.request && !header.response) {
        error('invalid websocket msg! no seq id!');
        return null;
    }

    return {
        header : header,
        body : body
    };
}

function OnMessage(data, req, res) {
/*    if (req.headers) {
        console.log(JSON.stringify(req.headers));
    }*/

    let path = req.url;

    switch (path) {
        case "/webrtc/notification":
            onNotification(data, req);
            break;
        default:
            break;
    }
}

function onNotification(data, req) {

    let dataStr;

    if (typeof data !== 'string') {
        dataStr = data.toString();
    } else {
        dataStr = data;
    }
    console.log(dataStr);

    let dataObj = JSON.parse(dataStr);
    let endpoint = dataObj.endpoint;
    if(endpoint) {
        let connectionId = endpoint.connection,
            groupId = endpoint.group;
        console.log(`connectionId: ${connectionId}, groupId: ${groupId}`);
        if(!groupId && connectionId) {
            let streamId = axiosWebStreamer.getStreamByEndpoint(connectionId);
            axios.delete(`${config.webStreamer.SERVER}/livestream/endpoint?id=${streamId}&endpoint=["${connectionId}"]`)
                .then( res => {
                    if(res.status === 200) {
                        console.log('delete livestream viewer successed');
                    }
                })
                .catch( err => {
                    console.log(err.message);
                });
            axiosWebStreamer.updateStreamEndpointMap(streamId, connectionId);
            if(axiosWebStreamer.noMoreViewer(streamId)) {
                axios.delete(`${config.webStreamer.SERVER}/livestream?id=${streamId}`)
                    .then( res => {
                        if(res.status === 200) {
                            console.log('delete livestream successed');
                        }
                    })
                    .catch( err => {
                        console.log(err.message);
                    });
                sessionManager.deleteSession(streamId);
            }
        } else if(groupId) {
            if(connectionId) {
                axios.delete(`${config.webStreamer.SERVER}/muti-points/endpoint`, {
                    id: groupId,
                    endpoint: [connectionId]
                });
                axios.delete(`${config.webStreamer.SERVER}/muti-points?id=${groupId}`);
            } else {
                let group = groupManager.getGroup(groupId),
                    endpoint = [];

                for(let [key, value] of group.entries()) {
                    let endpointId = value && value.id;
                    endpoint.push(endpointId)
                }
                axios.delete(`${config.webStreamer.SERVER}/muti-points/endpoint`, {
                    id: groupId,
                    endpoint: endpoint
                });
                axios.delete(`${config.webStreamer.SERVER}/muti-points?id=${groupId}`);
            }
        }
    }
}



module.exports = {
    createPeerConnection,
    destroyPeerConnection,
    createGroup,
    destroyGroup
};
