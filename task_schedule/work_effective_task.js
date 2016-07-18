/**
 * Created by Yuliang on 2016/6/30 0030.
 * 定时任务,定时扫描作业表,给快要到期还未提交作业的学生推送通知
 */
"use strict"

var moment = require('moment');
var schedule = require('node-schedule');
var eventFactory = require('../proxy/event_factory/event_factory')
var dbContents = require('../configs/database').getDbContents();

var handle;

module.exports.start = function () {
    var rule = new schedule.RecurrenceRule();
    rule.second = process.pid % 60;
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
        batchList.length > 0 && eventFactory.workEvent && eventFactory.workEvent.emit('workEffective', batchList.map(m=>m.batchId))
    })
}



