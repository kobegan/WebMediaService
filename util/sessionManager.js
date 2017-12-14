
class SessionInstance {
 constructor(title, desc, type) {
     this.sessionType = type;
     this.title = title;
     this.desc = desc;
     this.members = [];
 }
 addMember(endpointType, name, id) {
     this.members.push({
         type: endpointType,
         name: name,
         Id: id
     })
 }

 getTitle() {
     return this.title;
 }

 getDesc() {
     return this.desc;
 }

 getSessionType() {
     return this.sessionType;
 }

 getMembers() {
     return this.members;
 }

}

class SessionManager {
    constructor() {
        this.sessionMap = new Map();
    }

    createSession(sessionId, title, desc, type) {
        console.log(`createSession: ${sessionId}`);
        this.sessionMap.set(sessionId, new SessionInstance(title, desc, type));
    }

    deleteSession(sessionId) {
        console.log(`deleteSession: ${sessionId}`);
       return this.sessionMap.delete(sessionId);
    }

    getSession(sessionId) {
        return this.sessionMap.get(sessionId);
    }
    entries() {
        return this.sessionMap.entries();
    }
}

var sessionManager = new SessionManager();

module.exports = sessionManager;
