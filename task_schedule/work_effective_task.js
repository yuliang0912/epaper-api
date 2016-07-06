/**
 * Created by Administrator on 2016/6/30 0030.
 */
"use strict"

var moment = require('moment');
var schedule = require('node-schedule');
var dbContents = require('../configs/database').getDbContents();
var sendMsgHelper = require('../proxy/send_msg_helper');
var handle;

module.exports.start = function () {
    var rule = new schedule.RecurrenceRule().second = [(process.pid % 59) + 1];
    handle = schedule.scheduleJob(rule, workRemindTask);
}

module.exports.cancel = function () {
    handle && handle.cancel();
}

function workRemindTask() {
    var dateSplit = [];
    dateSplit.push(moment().subtract(2, 'hours').format("YYYY-MM-DD HH:mm:ss"));
    dateSplit.push(moment().format("YYYY-MM-DD HH:mm:ss"));

    dbContents.workSequelize.workBatch.findAll({
        raw: true,
        attributes: ['batchId'],
        where: {
            effectiveDate: {$between: dateSplit},
            pushStatus: {$in: [0, 2]}
        },
        limit: 20,
        order: 'effectiveDate ASC'
    }).then(batchList=> {
        var batchIds = batchList.map(m=>m.batchId);
        return batchIds.length > 0 ? dbContents.workSequelize.eworks.findAll({
            raw: true,
            attributes: [[dbContents.Sequelize.literal('CONCAT(workId)'), 'workId'], 'workName', 'publishDate', 'effectiveDate', 'batchId', 'brandId',
                [dbContents.Sequelize.literal('(SELECT GROUP_CONCAT(resourceName) FROM eworkcontents where batchId = eworks.batchId)'), 'workContent']],
            where: {batchId: {$in: batchIds}}
        }) : [];
    }).then(workList=> {
        var batchGroup = {};
        workList.forEach(item=> {
            if (!batchGroup[item.batchId]) {
                batchGroup[item.batchId] = [];
            }
            item.publishDate = moment(item.publishDate).format("YYYY-MM-DD HH:mm:ss");
            item.effectiveDate = moment(item.effectiveDate).format("YYYY-MM-DD HH:mm:ss");
            batchGroup[item.batchId].push(item);
        })
        Object.keys(batchGroup).forEach(item=> {
            pushMsg(parseInt(item), batchGroup[item]);
        });
    })
}

function pushMsg(batchId, workContents) {
    var workIds = workContents.map(m=>m.workId);
    dbContents.workSequelize.workMembers.findAll({
        raw: true,
        attributes: ['userId', 'userName'],
        where: {workId: {$in: workIds}, status: 0}
    }).then(userList=> {
        var workContent = workContents[0];
        var messageModel = {
            title: "作业提醒",
            msgType: 11,
            brandId: workContent.brandId,
            senderId: 1,
            senderName: "作业系统",
            msgIntr: "老师还没有收到你的作业,请尽快提交!"
        };
        delete workContent.batchId;
        delete workContent.brandId;
        var messageContent = {
            content: workContent,
            attach: batchId || ''
        };
        var receiverIdList = userList.map(m=> {
            return {receiverId: m.userId, receiverName: m.userName}
        });
        if (receiverIdList.length == 0) {
            dbContents.workSequelize.workBatch.update({pushStatus: 3}, {where: {batchId: batchId}});
        } else {
            sendMsgHelper.sendMsg(messageModel, messageContent, receiverIdList).then(msgId=> {
                dbContents.workSequelize.workBatch.update({pushStatus: 1}, {where: {batchId: batchId}});
            }).catch(err=> {
                dbContents.workSequelize.workBatch.update({pushStatus: 2}, {where: {batchId: batchId}});
            })
        }
    })
}


