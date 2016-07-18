/**
 * Created by Administrator on 2016/7/7 0007.
 */

"use strict"
var co = require('co')
var Sequelize = require('sequelize')
var utils = require('../../lib/api_utils')
var workSequelize = require('../../configs/database').getDbContents().workSequelize

module.exports.submitWork = function (doWork, workAnswers) {
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

//提交在线作答作业/自主学习(自主练习接受批改前最后一次的,作业接受第一次的)
function submitOnlinePaperWork(doWork, workAnswers) {
    return new Promise(function (resolve, reject) {
        if (!workAnswers.every(m=>Array.isArray(m.answers) && m.answers.length > 0)) {
            reject(new Error("workAnswers格式错误"))
        }
        var isWork = parseInt(doWork.workId) > 0
        var baseCondition = {
            workId: doWork.workId,
            brandId: doWork.brandId,
            packageId: doWork.packageId,
            cid: doWork.cid,
            versionId: doWork.versionId,
            parentVersionId: doWork.parentVersionId,
            resourceType: doWork.resourceType
        }
        co(function *() {
            yield workSequelize.doEworks.count({
                where: isWork ? baseCondition : Object.assign({workStatus: 4}, baseCondition)
            }).then(count=> {
                doWork.delStatus = count > 0 ? 2 : 0;
            }).catch(reject)
        })()

        workSequelize.transaction(function (trans) {
            var doEworkFunc = workSequelize.doEworks.create(doWork, {transaction: trans})
            var workAnswerFunc = workSequelize.workAnswers.create({
                doWorkId: doWork.doWorkId,
                submitContent: workAnswers
            }, {transaction: trans})
            return Promise.all([doEworkFunc, workAnswerFunc])
        }).then(data=> {
            resolve(doWork.doWorkId)
            // if (isWork) {
            //     workSequelize.query("UPDATE doeworks INNER JOIN eworks ON doeworks.workId = eworks.workId\
            //         SET doeworks.classId = eworks.classId WHERE doeworks.doWorkId =" + doWork.doWorkId, {
            //         type: Sequelize.QueryTypes.UPDATE
            //     })
            // }
            if (!isWork && doWork.delStatus === 0) {
                workSequelize.doEworks.update({delStatus: 2}, {
                    where: Object.assign(baseCondition, {doWorkId: {$ne: doWork.doWorkId}})
                })
            }
        }).catch(reject)
    });
}

//提交视频讲解作业或者自主练习(视频讲解作业与自主练习都接受最后一次)
function submitVideoExplainWork(doWork, workAnswers) {
    return new Promise(function (resolve, reject) {
        if (!workAnswers.every(m=>Array.isArray(m.learnRecods) && m.learnRecods.length > 0)) {
            reject(new Error("workAnswers格式错误"))
        }
        workSequelize.transaction(function (trans) {
            doWork.delStatus = 0
            var doEworkFunc = workSequelize.doEworks.create(doWork, {transaction: trans})
            var workAnswerFunc = workSequelize.workAnswers.create({
                doWorkId: doWork.doWorkId,
                submitContent: workAnswers
            }, {transaction: trans})
            return Promise.all([doEworkFunc, workAnswerFunc])
        }).then(data=> {
            resolve(doWork.doWorkId)
            workSequelize.doEworks.update({delStatus: 2}, {
                where: {
                    workId: doWork.workId,
                    brandId: doWork.brandId,
                    packageId: doWork.packageId,
                    cid: doWork.cid,
                    versionId: doWork.versionId,
                    parentVersionId: doWork.parentVersionId,
                    resourceType: doWork.resourceType,
                    doWorkId: {$ne: doWork.doWorkId}
                }
            })
            workSequelize.query("UPDATE doeworks SET submitCount =\
            (SELECT count FROM (SELECT COUNT(*) as count FROM doeworks WHERE workId = :workId AND \
            packageId = :packageId AND cid = :cid AND brandId = :brandId AND versionId = :versionId AND\
            parentVersionId = :parentVersionId AND resourceType = :resourceType) t)\
            WHERE doWorkId = " + doWork.doWorkId, {
                type: Sequelize.QueryTypes.UPDATE,
                replacements: {
                    workId: doWork.workId,
                    brandId: doWork.brandId,
                    packageId: doWork.packageId,
                    cid: doWork.cid,
                    versionId: doWork.versionId,
                    parentVersionId: doWork.parentVersionId,
                    resourceType: doWork.resourceType
                }
            })
        }).catch(reject)
    });
}