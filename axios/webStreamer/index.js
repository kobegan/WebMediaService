const axios = require('axios');
const config = require('../../util/config');
const idGenerator = require('../../util/id_generator');
const axiosSignalingBridge = require('../signalingBridge');
const connectionManager = require('../../util/connectionManager');
const rp = require('request-promise');
const http = require('http');
const groupManager = require('../../util/groupManager');
const sessionManager = require('../../util/sessionManager');

let streamEndpointMap = new Map();

function addStreamEndpointPair(streamId, endpointId) {
    if(!streamEndpointMap.get(streamId)) {
        streamEndpointMap.set(streamId, new Array());
    }
    streamEndpointMap.get(streamId).push(endpointId);
}

module.exports.getStreamByEndpoint = function(endpointId) {
    let streamId = -1;
    for(let [key, value] of streamEndpointMap.entries() ) {
        if(value.indexOf(Number.parseInt(endpointId)) !== -1) {
            streamId = key;
            console.log('getStreamByEndpoint: ' + streamId);
            break;
        }
    }
    return streamId;
};

function noMoreViewer(streamId) {
    return streamEndpointMap.get(streamId).length === 0;
}

function updateStreamEndpointMap(streamId, viewerId) {
    let viewerArray = streamEndpointMap.get(streamId),
        index = viewerArray.indexOf(Number.parseInt(viewerId));
    if(index >= 0) {
        viewerArray.splice(index, 1);
    }
}

module.exports.noMoreViewer = noMoreViewer;
module.exports.updateStreamEndpointMap = updateStreamEndpointMap;

async function createLiveStream(ctx, next) {
    let postBody = ctx.request.body,
        streamId = idGenerator.getStreamId(),
        endpointId = idGenerator.getId(),
        postData,
        responseData;
    let signalingBridge = null;

    if(ctx.protocol === 'https') {
        signalingBridge = config.signalingServer[2];
    } else {
        signalingBridge = config.signalingServer[1];
    }

    if(postBody.source.type === 'rtsp') {
        let url = postBody.source.options.rtsp.url;

        if(url === undefined) {
            ctx = 400;
            ctx.statusMessage = 'rtsp invalid';
            return;
        }
        postData = {
            ID: endpointId.toString(),
            RTSPClient: {
                url: url
            }
        };
        responseData = {
            streamId: streamId
        };

    } else if (postBody.source.type === 'webrtc') {
        let res = await axiosSignalingBridge.createPeerConnection(endpointId);
        if(res.status === 200) {
            addStreamEndpointPair(streamId, endpointId);
            postData = {
                id: streamId.toString(),
                endpoint: {
                    ID: endpointId.toString(),
                    WebRTC: {
                        signalling_bridge: config.signalingServer[0],
                        connection: endpointId.toString(),
                        type: 'offerer',
                       // audio: postBody.source.options.webrtc.audio,
                        video: postBody.source.options.webrtc.video
                    }
                }
            };
            responseData = {
                streamId: streamId.toString(),
                connectionId: endpointId.toString(),
                signalingBridge: signalingBridge
            };

        } else {
            ctx.status = res.status;
            return;
        }
    } else {
        ctx.status = 400;
        return;
    }
    connectionManager.addConnectionSignalingBridgePair(streamId, signalingBridge);

    //for one on one
/*    connectionManager.addConnectionSignalingBridgePair(endpointId, config.signalingServer[1]);

    ctx.body = responseData;
    ctx.status = 200;
    return;*/

    let options = {
        method: 'POST',
        uri: `${config.webStreamer.SERVER}/livestream`,
        body: postData,
        qs: {
            id: streamId // -> uri + '?access_token=xxxxx%20xxxxx'
        },
        json: true, // Automatically stringifies the body to JSON
        resolveWithFullResponse: true
    };

    let res;
    try {
        res = await rp(options);
        ctx.body = responseData;
        ctx.status = res.statusCode;
    } catch (err) {
        console.error(err);
        ctx.status = 500;
    }
}

async function deleteLiveStream(ctx, next) {
    let streamId = ctx.request.body.Id;

    let viewerArray = streamEndpointMap.get(streamId);

    if(viewerArray && viewerArray.length > 0) {
        axios.delete(`${config.webStreamer.SERVER}/livestream`, {
            params: {
                id: streamId
            }
        });
        axios.delete(`${config.webStreamer.SERVER}/livestream/endpoint`, {
            data: {
                endpoint: viewerArray
            }
        });
        viewerArray.forEach( element => {
            axiosSignalingBridge.destroyPeerConnection(element);
        });
        sessionManager.deleteSession(streamId);
    }
    ctx.status = 200;
}

async function addLiveStreamViewer(ctx, next) {
    console.log('addLiveStreamViewer:');
    let postBody = ctx.request.body;
    console.log(postBody);
    let streamId = postBody.Id,
        signalingBridge = connectionManager.getSignalingBridge(Number(streamId)),
        endpointId = idGenerator.getId(),
        postData;

    if(postBody.type === 'webrtc') {
        let res;
        try {
            res = await axiosSignalingBridge.createPeerConnection(endpointId);
        } catch (err) {
            console.error(err);
            ctx.status = 500;
            return;
        }

        if(res.status === 200) {
            postData = [{
                ID: endpointId.toString(),
                WebRTC: {
                    signalling_bridge: config.signalingServer[0],
                    connection: endpointId.toString(),
                    type: "answerer",
                    audio: postBody.audio,
                    video: postBody.video
                }
            }];

            let options = {
                method: 'POST',
                uri: `${config.webStreamer.SERVER}/livestream/endpoint`,
                body: postData,
                qs: {
                    id: streamId // -> uri + '?access_token=xxxxx%20xxxxx'
                },
                json: true, // Automatically stringifies the body to JSON
                resolveWithFullResponse: true
            };

            let res = await axios.post(`${config.webStreamer.SERVER}/livestream/endpoint?id=${streamId}`, postData)
                .then( res => {
                    if(res.status === 200) {
                        addStreamEndpointPair(streamId, endpointId);
                        ctx.body = {
                            viewerId: endpointId,
                            signalingBridge: signalingBridge
                        };

                    } else {
                        axiosSignalingBridge.destroyPeerConnection(endpointId);
                    }
                    ctx.status = res.status;
                })
                .catch( error => {
                    console.log(error);
                });

        }
    }
}

async function removeLiveStreamViewer(ctx, next) {
    let viewerId = ctx.request.body.viewerId,
        streamId = ctx.request.body.streamId;

    if(viewerId === undefined || streamId === undefined) {
        ctx.status = 400;
        return;
    }

    let res = await axios.delete(`${config.webStreamer.SERVER}/livestream/endpoint?id=${streamId}&endpoint=["${viewerId}"]`)
        .catch(err => {
        console.log(err.message);
    });
    res = await axiosSignalingBridge.destroyPeerConnection(viewerId);

    updateStreamEndpointMap(streamId, viewerId);

    if(noMoreViewer(streamId)) {
        axios.delete(`${config.webStreamer.SERVER}/livestream?id=${streamId}`);
        sessionManager.deleteSession(streamId);
    }

    ctx.status = res.status;
    ctx.statusMessage = res.statusText;
}

async function createMultiPoint(ctx, next) {
    let multiPointId = idGenerator.getId();

    let res = await axiosSignalingBridge.createGroup(multiPointId);

    if(res.status === 200) {
        res = await axios.post(`${config.webStreamer.SERVER}/muti-points?id=${multiPointId}`);
        if(res.status === 200) {
            sessionManager.createSession(multiPointId, ctx.request.body.title, ctx.request.body.desc, 'multi');
            groupManager.createGroup(multiPointId);
            ctx.body = {groupId: multiPointId};
        } else {
            res = await axiosSignalingBridge.destroyGroup(multiPointId);
        }
    }
    ctx.status = res.status;
    ctx.statusMessage = res.statusText;
}

async function deleteMultiPoint(ctx, next) {
    let multiPointId = ctx.request.body.Id;

    let res = await axiosSignalingBridge.destroyGroup(multiPointId);
    let group = groupManager.getGroup(multiPointId),
        endpoint = [];

    if(res.status === 200) {
        for(let [key, value] of group.entries()) {
            let endpointId = value && value.id;
            axiosSignalingBridge.destroyPeerConnection(endpointId, multiPointId);
            endpoint.push(endpointId)
        }
        axios.delete(`${config.webStreamer.SERVER}/muti-points/endpoint`, {
            id: multiPointId,
            endpoint: endpoint
        });
        axios.delete(`${config.webStreamer.SERVER}/muti-points?id=${multiPointId}`);
    }
    ctx.status = 200;
    //ctx.statusMessage = res.statusText;
}

async function addMultiPointEndpoint(ctx, next) {
    let postBody = ctx.request.body;
    let groupId = postBody.groupId,
        endpoint = postBody.endpoint;
    let group = groupManager.getGroup(Number(groupId)),
        member,endpointId;

    let endpointArray = [], obj = {},
        returnedEndpointArray = [], returnedObj = {};

    for(let [index, item] of endpoint.entries()) {
        member = groupManager.getMember(groupId, item.name);
        endpointId = member.id;
        obj.ID = endpointId.toString();
        returnedObj.Id = endpointId;
        returnedObj.name = member.name;

        if(item.type === 'rtsp') {
            obj.RTSPClient.url = item.options.rtsp.url;
        } else if(item.type === 'webrtc') {
            let res = await axiosSignalingBridge.createPeerConnection(endpointId,groupId);
            if(res.status === 200) {
                obj.WebRTC = {
                    signalling_bridge: config.signalingServer[0],
                    group: groupId.toString(),
                    connection: endpointId.toString(),
                    type: 'answerer',
                    audio: item.options.webrtc.audio,
                    video: item.options.webrtc.video
                }
            }
        }
        returnedEndpointArray.push(returnedObj);
        endpointArray.push(obj);
    }

    let options = {
        method: 'POST',
        uri: `${config.webStreamer.SERVER}/muti-points/endpoint`,
        body: endpointArray,
        qs: {
            id: groupId // -> uri + '?access_token=xxxxx%20xxxxx'
        },
        json: true, // Automatically stringifies the body to JSON
        resolveWithFullResponse: true
    };
    let res;

    try {
        res = await rp(options);
    } catch (err) {
        console.error(err);
        ctx.status = 500;
        return;
    }

    if(res.statusCode === 200) {
        let signalingBridge = null;

        if(ctx.protocol === 'https') {
            signalingBridge = config.signalingServer[2];
        } else {
            signalingBridge = config.signalingServer[1];
        }

        ctx.body = {
            endpoint: returnedEndpointArray,
            signalingBridge: signalingBridge
        };
    }
    ctx.status = res.statusCode;
    //ctx.statusMessage = res.statusText;
}

async function removeMultiPointEndpoint(ctx, next) {
    let groupId = ctx.request.body.groupId,
        endpointId = ctx.request.body.endpointId;

    for(let id of endpointId.values()) {
        axiosSignalingBridge.destroyPeerConnection(id, groupId)
    }

    let res = await axios.delete(`${config.webStreamer.SERVER}/muti-points/endpoint`, {
        id: groupId,
        endpoint: endpointId
    });
    ctx.status = res.status;
    ctx.statusMessage = res.statusText;
}

async function setMultiPointSpeaker(ctx, next) {
    let groupId = ctx.request.body.groupId,
        endpointId = ctx.request.body.endpointId,
        memberName = ctx.request.body.name;
    let member;

    if(memberName) {
        member = groupManager.getMember(groupId, memberName);
        if(member.speaker) {
            ctx.status = 400;
            return;
        }
        endpointId = member.id;
    }

    let res = await axios.put(`${config.webStreamer.SERVER}/muti-points/speaker?id=${groupId}&endpoint=${endpointId}`);
    if(ctx.status === 200) {
        member.speaker = true;
    }
    ctx.status = res.status;
    ctx.statusMessage = res.statusText;
}

module.exports = {
    createLiveStream,
    deleteLiveStream,
    addLiveStreamViewer,
    removeLiveStreamViewer,
    createMultiPoint,
    deleteMultiPoint,
    addMultiPointEndpoint,
    removeMultiPointEndpoint,
    setMultiPointSpeaker
};
