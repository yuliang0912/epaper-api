/**
 * Created by yuliang on 2017/4/13.
 */

"use strict"

var schedule = require('node-schedule');
var dbContents = require('../configs/database').getDbContents();

module.exports.start = function () {
    var rule = new schedule.RecurrenceRule();
    rule.hour = [2, 4, 6, 8]; //每天凌晨2,4,6,8点执行
    schedule.scheduleJob(rule, clearMsgTask);
}

var clearList = []
function clearMsgTask() {
    var sql = `SELECT receiverId FROM (
                 SELECT receiverId,COUNT(*) as total from msgreceiver GROUP BY receiverId
               ) temp WHERE total > 100 ORDER BY total DESC LIMIT 1000`;

    dbContents.messageSequelize.query(sql, {type: "SELECT"}).then(dataList=> {
        if (dataList.length > 0) {
            clearList = clearList.concat(dataList)
            console.log("本次预清理消息人数:" + dataList.length)
        }
    })
}

setInterval(function () {
    if (clearList.length == 0) {
        return;
    }
    var userInfo = clearList.shift()

    var sql = `SELECT msgmain.msgId as msgId FROM msgreceiver
                 INNER JOIN msgmain on msgreceiver.msgId = msgmain.msgId
                 WHERE msgreceiver.receiverId = :receiverId 
               ORDER BY msgmain.msgId DESC LIMIT 100,1`;

    dbContents.messageSequelize.query(sql, {
        type: "SELECT",
        replacements: {receiverId: userInfo.receiverId}
    }).then(data=> {
        data.length > 0 && dbContents.messageSequelize.query("DELETE FROM msgreceiver WHERE receiverId = :receiverId AND msgId < :msgId", {
            type: "UPDATE",
            replacements: {receiverId: userInfo.receiverId, msgId: data[0].msgId}
        })
    })
}, 2000)
