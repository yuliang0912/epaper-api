/**
 * Created by Yuliang on 2016/7/14 0014.
 */

"use strict"

var co = require('co')
var apiUtils = require('../../lib/api_utils')
var dbContents = require('../../configs/database').getDbContents()
var sendMsgHelper = require('../message/send_msg_helper')
var msgEnum = require('../message/message_enum')

const workSenderId = 1
const workSenderName = '作业消息'

//发布作业事件
module.exports.publishWorkHandler = function (batchId) {
    return new Promise(function (resolve, reject) {
        var workBatchFunc = dbContents.workSequelize.workBatch.findById(batchId, {raw: true})
        var workContentFunc = dbContents.workSequelize.workContents.findOne({
            raw: true,
            attributes: [[dbContents.Sequelize.literal('GROUP_CONCAT(resourceName)'), 'workContent']],
            where: {batchId}
        })
        var workMembers = dbContents.workSequelize.workMembers.findAll({
            raw: true,
            attributes: [[dbContents.Sequelize.literal('CONCAT(ework.workId)'), 'workId'], ['userId', 'receiverId'], ['userName', 'receiverName']],
            include: [{
                attributes: [],
                model: dbContents.workSequelize.eworks,
                where: {batchId}
            }]
        })
        Promise.all([workBatchFunc, workContentFunc, workMembers]).then(results=> {
            let batch = results[0]
            if (!batch) {
                return resolve()
            }
            let messageModel = {
                title: "作业通知",
                msgType: msgEnum.msgTypeEnum.workNotice,
                senderId: workSenderId,
                senderName: workSenderName,
                brandId: batch.brandId,
                receiverType: msgEnum.receiverTypeEnum.toIndividual,
                msgIntr: "亲爱的同学,你收到新的作业了!"
            }
            let messageContent = {
                content: {
                    workName: batch.workName,
                    publishDate: batch.publishDate.toUnix(),
                    effectiveDate: batch.effectiveDate.toUnix(),
                    workContent: results[1].workContent || ''
                }
            }
            let tasks = results[2].groupBy('workId').map(work=> {
                messageContent.attach = messageContent.content.workId = work.key
                work.value.forEach(m=>delete m.workId)
                return sendMsgHelper.sendMsg(messageModel, messageContent, work.value)
            })
            return Promise.all(tasks)
        }).then(resolve).catch(reject)
    })
}

//删除作业事件
module.exports.deleteWorkHandler = function (workId) {
    return new Promise(function (resolve, reject) {
        var eworkFunc = dbContents.workSequelize.eworks.findById(workId, {raw: true})
        var workContentFunc = dbContents.workSequelize.workContents.findOne({
            raw: true,
            attributes: [[dbContents.Sequelize.literal('GROUP_CONCAT(resourceName)'), 'workContent']],
            where: {workId}
        })
        var workMembers = dbContents.workSequelize.workMembers.findAll({
            raw: true,
            attributes: [['userId', 'receiverId'], ['userName', 'receiverName']],
            where: {workId}
        })
        Promise.all([eworkFunc, workContentFunc, workMembers]).then(results=> {
            let eworkModel = results[0]
            if (!eworkModel) {
                return resolve()
            }
            let messageModel = {
                title: "取消作业",
                msgType: msgEnum.msgTypeEnum.workDelete,
                senderId: workSenderId,
                senderName: workSenderName,
                brandId: eworkModel.brandId,
                receiverType: msgEnum.receiverTypeEnum.toIndividual,
                msgIntr: "老师取消了一次作业！"
            }
            let messageContent = {
                content: {
                    workId: workId,
                    workName: eworkModel.workName,
                    publishDate: eworkModel.publishDate.toUnix(),
                    effectiveDate: eworkModel.effectiveDate.toUnix(),
                    workContent: results[1].workContent || ''
                },
                attach: workId
            }
            return sendMsgHelper.sendMsg(messageModel, messageContent, results[2])
        }).then(resolve).catch(reject)
    })
}

//作业过期事件
module.exports.workEffectiveHandler = function (batchIdList) {
    return new Promise(function (resolve, reject) {
        if (!Array.isArray(batchIdList) || batchIdList.length < 1) {
            return resolve()
        }
        dbContents.workSequelize.eworks.findAll({
            raw: true,
            attributes: [[dbContents.Sequelize.literal('CONCAT(workId)'), 'workId'], 'workName', 'publishDate', 'effectiveDate', 'batchId', 'brandId',
                [dbContents.Sequelize.literal('(SELECT GROUP_CONCAT(resourceName) FROM eworkcontents where batchId = eworks.batchId)'), 'workContent']],
            where: {batchId: {$in: batchIdList}}
        }).then(workList=> {
            if (workList.length < 1) {
                return resolve()
            }
            let batchWorkGroup = workList.groupBy('batchId')
            let messageModel = {
                title: "作业提醒",
                msgType: msgEnum.msgTypeEnum.workRemind,
                senderId: workSenderId,
                senderName: workSenderName,
                receiverType: msgEnum.receiverTypeEnum.toIndividual,
                msgIntr: "老师还没有收到你的作业,请尽快提交!"
            }
            let tasks = batchWorkGroup.map(batch=> {
                let workContent = batch.value[0]
                messageModel.brandId = workContent.brandId
                workContent.publishDate = workContent.publishDate.toUnix()
                workContent.effectiveDate = workContent.effectiveDate.toUnix()
                delete workContent.batchId
                delete workContent.brandId
                let messageContent = {
                    content: workContent,
                    attach: batch.key || ''
                }
                return dbContents.workSequelize.workMembers.findAll({
                    raw: true,
                    attributes: [['userId', 'receiverId'], ['userName', 'receiverName']],
                    where: {workId: {$in: batch.value.map(m=>m.workId)}, status: 0}
                }).then(userList=> {
                    return sendMsgHelper.sendMsg(messageModel, messageContent, userList)
                }).then(msgId=> {
                    dbContents.workSequelize.workBatch.update({pushStatus: 1}, {where: {batchId: batch.key}})
                    return msgId
                }).catch(err=> {
                    dbContents.workSequelize.workBatch.update({pushStatus: 2}, {where: {batchId: batch.key}})
                })
            })
            return Promise.all(tasks)
        }).then(resolve).catch(reject)
    })
}

//批改作业事件
module.exports.corrrectWorkHandler = function (doWorkId) {
    return new Promise(function (resolve, reject) {
        dbContents.workSequelize.doEworks.findById(doWorkId, {raw: true}).then(doEwork=> {
            if (!doEwork || doEwork.workId === 0) {
                return resolve()
            }
            let messageModel = {
                title: "批改作业",
                msgType: msgEnum.msgTypeEnum.workCorrect,
                brandId: doEwork.brandId,
                senderId: workSenderId,
                senderName: workSenderName,
                receiverType: msgEnum.receiverTypeEnum.toIndividual,
                msgIntr: "老师批改了你的作业\"" + doEwork.resourceName + "\",作业得分" + doEwork.actualScore + "!"
            }
            let receiverIdList = [{receiverId: doEwork.userId, receiverName: doEwork.userName}]
            let messageContent = {
                content: {
                    workId: doEwork.workId.toString(),
                    doWorkId: doWorkId.toString(),
                    resoruceName: doEwork.resourceName
                },
                attach: doWorkId
            }
            return sendMsgHelper.sendMsg(messageModel, messageContent, receiverIdList)
        }).then(resolve).catch(reject)
    })
}

//点评作业事件
module.exports.commentWorkHandler = function (doWorkId) {
    return new Promise(function (resolve, reject) {
        dbContents.workSequelize.doEworks.findById(doWorkId, {raw: true}).then(doEwork=> {
            if (!doEwork || doEwork.workId === 0) {
                return resolve()
            }
            let messageModel = {
                title: "作业点评",
                msgType: msgEnum.msgTypeEnum.workComment,
                brandId: doEwork.brandId,
                senderId: workSenderId,
                senderName: workSenderName,
                receiverType: msgEnum.receiverTypeEnum.toIndividual,
                msgIntr: '老师对你的作业！"' + doEwork.resourceName + '"进行了点评，' + doEwork.comment.curString(20, "...")
            }
            let receiverIdList = [{receiverId: doEwork.userId, receiverName: doEwork.userName}]
            let messageContent = {
                content: {
                    workId: doEwork.workId.toString(),
                    doWorkId: doWorkId.toString(),
                    resoruceName: doEwork.resourceName
                },
                attach: doWorkId
            }
            return sendMsgHelper.sendMsg(messageModel, messageContent, receiverIdList)
        }).then(resolve).catch(reject)
    })
}

//检查作业事件
module.exports.checkWorkHandler = function (checkWorkInfo) {
    return new Promise(function (resolve, reject) {
        let messageContent = {
            attach: checkWorkInfo.workId
        }
        dbContents.workSequelize.eworks.findById(checkWorkInfo.workId, {raw: true}).then(workInfo=> {
            checkWorkInfo.brandId = workInfo.brandId;
            messageContent.content = {
                workId: workInfo.workId,
                workName: workInfo.workName,
                publishDate: workInfo.publishDate.toUnix(),
                effectiveDate: workInfo.effectiveDate.toUnix(),
            }
            return dbContents.workSequelize.workContents.findOne({
                raw: true,
                attributes: [[dbContents.Sequelize.literal('GROUP_CONCAT(resourceName)'), 'workContent']],
                where: {workId: checkWorkInfo.workId}
            })
        }).then(workContent=> {
            messageContent.content.workContent = workContent.workContent
            return dbContents.workSequelize.workMembers.findAll({
                raw: true,
                attributes: [['userId', 'receiverId'], ['userName', 'receiverName']],
                where: {workId: checkWorkInfo.workId, status: 0}
            })
        }).then(userList=> {
            let messageModel = {
                title: "作业提醒",
                brandId: checkWorkInfo.brandId,
                msgType: msgEnum.msgTypeEnum.workRemind,
                senderId: workSenderId,
                senderName: workSenderName,
                receiverType: msgEnum.receiverTypeEnum.toIndividual,
                msgIntr: "老师还没有收到你的作业,请尽快提交!"
            }
            return sendMsgHelper.sendMsg(messageModel, messageContent, userList)
        }).then(()=> {
            return checkWorkInfo.addDoWorkIds.length > 0 ? dbContents.workSequelize.doEworks.findAll({
                raw: true,
                attributes: [['userId', 'receiverId'], ['userName', 'receiverName']],
                where: {doWorkId: {$in: checkWorkInfo.addDoWorkIds}}
            }) : []
        }).then(userList=> {
            let messageModel = {
                title: "检查作业",
                brandId: checkWorkInfo.brandId,
                msgType: msgEnum.msgTypeEnum.workCheck,
                senderId: workSenderId,
                senderName: workSenderName,
                receiverType: msgEnum.receiverTypeEnum.toIndividual,
                msgIntr: "老师已经检查了你的作业!"
            }
            return sendMsgHelper.sendMsg(messageModel, messageContent, userList)
        }).then(resolve).catch(reject)
    })
}

//测试同步异步事件
module.exports.testEventHandler = co(function *() {
    yield dbContents.workSequelize.eworks.findById('4611689331361501573', {raw: true})
})
