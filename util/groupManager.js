const idGenerator = require('./id_generator');

class GroupManager {
    constructor() {
        this.groupMap = {};
    }

    createGroup(groupId) {
        if(this.groupMap[groupId]) {
            throw new Error('group already exits!');
        }
        this.groupMap[groupId] = new Map();
    }

    addMember(groupId, memberInfo) {
        let group = this.groupMap[groupId],
            id = undefined,
            obj = null;
        if(group) {
            id = idGenerator.getId();
            obj = {
                type: memberInfo.type,
                online: false,
                speaker: false,
                id: id
            };
            group.set(memberInfo.name, obj);
            obj['name'] = memberInfo.name;
        }
        return obj;
    }

    deleteGroup(groupId) {
        let member = this.groupMap[groupId];
        if(member) {
            member.clear();
        }
       return delete this.groupMap[groupId];
    }

    getGroup(groupId) {
        return this.groupMap[groupId];
    }

    deleteMember(groupId, name) {
        let group = this.groupMap[groupId];
        if(group) {
            return group.delete(name);
        }
        return false;
    }

    getMember(groupId, name) {
        let group = this.groupMap[groupId];
        if(group) {
            return group.get(name);
        }
        return null;
    }
}

var groupManager = new GroupManager();

module.exports = groupManager;
