/**
 * Created by Administrator on 2016/7/7 0007.
 */
"use strict"
var co = require('co');
var utils = require('../../lib/api_utils');
var workSequelize = require('../../configs/database').getDbContents().workSequelize;

module.exports = function (doWork, workAnswers) {
    doWork.doWorkId = utils.createInt16Number()
    switch (doWork.moduleId) {
        case 123:
            return submitVideoExplainWork(doWork, workAnswers)
        case 124:
            return submitOnlinePaperWork(doWork, workAnswers)
        default:
            throw new Error('不被支持的作业.moduleId=' + doWork.moduleId)
    }
}


//提交在线作答作业/自主学习
function submitOnlinePaperWork(doWork, workAnswers) {
    return new Promise(function (resolve, reject) {
        var isWork = parseInt(doWork.workId) > 0
        var condition = {
            workId: doWork.workId,
            packageId: doWork.packageId,
            cid: doWork.cid,
            versionId: doWork.versionId,
            parentVersionId: doWork.parentVersionId,
            resourceType: doWork.resourceType
        }
        if (isWork) {
            condition.workStatus = 4
        }
        co(function *() {
            yield workSequelize.doEworks.count({
                where: condition
            }).then(count=> {
                doWork.delStatus = count > 0 ? 2 : 0;
            }).catch(err=> {
                reject(err);
            })
            workSequelize.transaction(function (trans) {
                var doEworkFunc = workSequelize.doEworks.create(doWork)
                var workAnswerFunc = workSequelize.workAnswers.create({
                    doWorkId: doWork.doWorkId,
                    submitContent: JSON.stringify(workAnswers)
                })
                return Promise.all([doEworkFunc, workAnswerFunc])
            }).then(data=> {
                resolve(doWork.doWorkId)
            }).catch(err=> {
                reject(err);
            })
        })()
    });
}

//提交视频讲解作业或者自主练习
function submitVideoExplainWork(doWork, workAnswers) {
    return new Promise(function (resolve, reject) {
        workSequelize.transaction(function (trans) {
            doWork.delStatus = 0
            var doEworkFunc = workSequelize.doEworks.create(doWork, {transaction: trans})
            var workAnswerFunc = workSequelize.workAnswers.create({
                doWorkId: doWork.doWorkId,
                submitContent: JSON.stringify(workAnswers)
            }, {transaction: trans})
            var unpdateStatusFunc = workSequelize.doEworks.update({delStatus: 2}, {
                where: {
                    workId: doWork.workId,
                    versionId: doWork.versionId,
                    parentVersionId: doWork.parentVersionId,
                    resourceType: doWork.resourceType,
                    doWorkId: {$ne: doWork.doWorkId}
                },
                transaction: trans
            })
            return Promise.all([doEworkFunc, workAnswerFunc, unpdateStatusFunc])
        }).then(data=> {
            resolve(doWork.doWorkId)
        }).catch(err=> {
            reject(err);
        })
    });
}