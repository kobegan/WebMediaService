const Router = require('koa-router');
const router = new Router();
const axiosWebStreamer = require('../axios/webStreamer');
const sessionManager = require('../util/sessionManager');
const groupManager = require('../util/groupManager');
const connectionManager = require('../util/connectionManager');



router.put('/sessionInfo', async (ctx, next) => {
    let data = ctx.request.body;
    sessionManager.createSession(data.connectionId, data.title, data.desc, data.sessionType);
    ctx.status = 200;
});

router.get('/sessionInfo', async (ctx, next) => {

    let arr = [];

    for (let [key, value] of sessionManager.entries()) {
        arr.push({
            connectionId : key,
            title : value.getTitle(),
            desc : value.getDesc(),
            sessionType : value.getSessionType()
        });
    }
    ctx.body = {
        sessionInfo: arr
    };
    ctx.status = 200;
});

router.delete('/sessionInfo', async (ctx, next) => {
    let sessionId = ctx.request.body.sessionId;

    groupManager.deleteGroup(sessionId);

    ctx.status = sessionManager.deleteSession(sessionId) ? 200 : 404;
});

router.get('/signalingBridge/:connectionId', async (ctx, next) => {
    let connectionId = ctx.params.connectionId;
    console.log('connectionId: ' + connectionId);

    if(connectionId === undefined) {
        ctx.status = 400;
        return;
    }
    let signalingBridge = connectionManager.getSignalingBridge(connectionId);
    console.log('signalBridge: ' + signalingBridge);
    ctx.body = {
        signalingBridge: signalingBridge
    };
    ctx.status = 200;
});

router.get('/ptt/group/members/:groupId', async (ctx, next) => {
    let groupId = ctx.params.groupId;
    console.log('groupId: ' + groupId);

    let group = groupManager.getGroup(Number(groupId));
    let groupMember = [];
    for(let [key,value] of group.entries()) {
        value['name'] = key;
        groupMember.push(value);
    }
    ctx.body = {groupMember: groupMember};
    ctx.status = 200;
});

router.get('/ptt/group/member/:groupId/:name', async (ctx, next) => {
    let groupId = ctx.params.groupId,
        name = ctx.params.name,
        member = groupManager.getMember(groupId, name);
    if(member) {
        ctx.body = {
            member: member
        };
        ctx.status = 200;
    } else {
        ctx.status = 404;
    }
});

router.put('/ptt/group/member/:groupId', async (ctx, next) => {
    let groupId = ctx.params.groupId,
        memberInfo = ctx.request.body;
    let member = groupManager.addMember(groupId, memberInfo);
    if(member !== null) {
        ctx.status = 200;
        ctx.body = {
            member: member
        }
    } else {
        ctx.status = 400
    }
});

router.post('/ptt/group/member/online/:groupId/:name', async (ctx, next) => {
    let groupId = ctx.params.groupId,
        name = ctx.params.name,
        member = groupManager.getMember(groupId,name);

    member.online = true;
    ctx.status = 200;
});

router.delete('/ptt/group/member/:groupId/:name', async (ctx, next) => {
    let groupId = ctx.params.groupId,
        name = ctx.params.name;
    let success = groupManager.deleteMember(groupId, name);
    ctx.status = success ? 200 : 400;
});


router.post('/livestream', async (ctx, next) => {
    await axiosWebStreamer.createLiveStream(ctx, next);
});

router.delete('/livestream', async (ctx, next) => {
    await axiosWebStreamer.deleteLiveStream(ctx, next);
});

router.post('/livestream/viewer', async (ctx, next) => {
    await axiosWebStreamer.addLiveStreamViewer(ctx, next);
});

router.delete('/livestream/viewer', async (ctx, next) => {
    await axiosWebStreamer.removeLiveStreamViewer(ctx, next);
});

router.post('/ptt/group', async (ctx, next) => {
    await axiosWebStreamer.createMultiPoint(ctx, next);
});

router.delete('/ptt/group', async (ctx, next) => {
    await axiosWebStreamer.deleteMultiPoint(ctx, next);
});

router.post('/ptt/group/endpoint', async (ctx, next) => {
    await axiosWebStreamer.addMultiPointEndpoint(ctx, next);
});

router.delete('/ptt/group/endpoint', async (ctx, next) => {
    await axiosWebStreamer.removeMultiPointEndpoint(ctx, next);
});

router.post('/ptt/endpoint/speaker', async (ctx, next) => {
    await axiosWebStreamer.setMultiPointSpeaker(ctx, next);
});

function strMapToObj(strMap) {
    let obj = Object.create(null);
    for (let [k,v] of strMap) {
        obj[k] = v;
    }
    return obj;
}

module.exports = router;
