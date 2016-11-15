/**
 * Created by Yuliang on 2016/8/17 0017.
 */

"use strict"

var schedule = require('node-schedule');
var msgHelper = require('../proxy/message/rabbit_helper');
var dbContents = require('../configs/database').getDbContents();

var handle;

module.exports.start = function () {
    var rule = new schedule.RecurrenceRule();
    var random = process.pid % 15;
    rule.second = process.pid % 60;
    rule.minute = [1, 15, 30, 45].map(m=>m += random);
    handle = schedule.scheduleJob(rule, pushMessageToMqTask);
}

module.exports.cancel = function () {
    handle && handle.cancel();
}

function pushMessageToMqTask() {
    dbContents.messageSequelize.msgMain.findAll({
        raw: true,
        attributes: ['msgId'],
        where: {status: {$in: [0, 3]}},
        limit: 50,
        order: 'msgId ASC'
    }).then(msgIdList=> {
        msgIdList.forEach(msg=> {
            var msgId = msg.msgId;
            msgHelper.publishMsg(msgId.toString()).then(isSuccess=> {
                dbContents.messageSequelize.msgMain.update({status: isSuccess ? 2 : 3}, {where: {msgId: msgId}})
            }).catch(err=> {
                dbContents.messageSequelize.msgMain.update({status: 3}, {where: {msgId: msgId}})
            })
        })
    })
}


