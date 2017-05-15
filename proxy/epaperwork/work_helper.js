/**
 * Created by Administrator on 2016/7/7 0007.
 */

"use strict"
var request = require('request');
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
            moduleId: 124,
            userId: doWork.userId
        }

        workSequelize.doEworks.count({
            where: isWork ? baseCondition : Object.assign({workStatus: 4}, baseCondition)
        }).then(count=> {
            doWork.delStatus = count > 0 ? 2 : 0;
            return workSequelize.transaction(function (trans) {
                var doEworkFunc = workSequelize.doEworks.create(doWork, {transaction: trans})
                var workAnswerFunc = workSequelize.workAnswers.create({
                    doWorkId: doWork.doWorkId,
                    submitContent: workAnswers
                }, {transaction: trans})
                var workDetails = workAnswers.map(item=> {
                    return {
                        doWorkId: doWork.doWorkId,
                        workId: doWork.workId,
                        contentId: doWork.contentId,
                        versionId: item.versionId,
                        assess: item.assess,
                        score: item.score,
                        answerContent: item.answers
                    }
                })
                var workDetailFunc = workSequelize.workAnswerDetails.bulkCreate(workDetails, {transaction: trans})
                return Promise.all([doEworkFunc, workAnswerFunc, workDetailFunc])
            })
        }).then(data=> {
            resolve(doWork.doWorkId)
            isWork && workSequelize.workMembers.update({status: 2}, {
                where: {workId: doWork.workId, userId: doWork.userId}
            })
            !isWork && doWork.delStatus === 0 && workSequelize.doEworks.update({delStatus: 2}, {
                where: Object.assign(baseCondition, {doWorkId: {$ne: doWork.doWorkId}})
            })
        }).catch(reject)
    });
}

//外网已经不存在视频讲解题目了.
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
            parseInt(doWork.workId) > 0 && workSequelize.workMembers.update({status: 2}, {
                where: {workId: doWork.workId, userId: doWork.userId}
            })
            workSequelize.doEworks.update({delStatus: 2}, {
                where: {
                    workId: doWork.workId,
                    brandId: doWork.brandId,
                    packageId: doWork.packageId,
                    cid: doWork.cid,
                    versionId: doWork.versionId,
                    moduleId: 123,
                    doWorkId: {$ne: doWork.doWorkId},
                    userId: doWork.userId
                }
            })
            workSequelize.query("UPDATE doeworks SET submitCount =\
            (SELECT count FROM (SELECT COUNT(*) as count FROM doeworks WHERE workId = :workId AND \
            packageId = :packageId AND cid = :cid AND brandId = :brandId AND versionId = :versionId AND\
            moduleId = 123 AND userId = :userId) t)\
            WHERE doWorkId = " + doWork.doWorkId, {
                type: Sequelize.QueryTypes.UPDATE,
                replacements: {
                    workId: doWork.workId,
                    brandId: doWork.brandId,
                    packageId: doWork.packageId,
                    cid: doWork.cid,
                    versionId: doWork.versionId,
                    userId: doWork.userId
                }
            })
        }).catch(reject)
    });
}

//获取产品信息
module.exports.getProductInfo = function (productIds) {
    return new Promise(function (resolve, reject) {
        if (!Array.isArray(productIds) || productIds.length < 1) {
            return resolve([]);
        }
        request.get('http://100.114.31.171:9014/service/v2/get_service_product_by_Id?pIds=' + productIds.join(','), {
            auth: {
                user: '155014',
                pass: '1',
                sendImmediately: true
            }
        }, function (err, response, body) {
            if (err) {
                return reject(err)
            }
            var body = JSON.parse(body)
            if (body.ret == 0 && body.errcode == 0) {
                resolve(body.data)
            } else {
                reject(body.msg)
            }
        });
    })
}

//根据classId获取班级成员列表
module.exports.getClassMembers = function (classId, userId, role) {
    let request = require('request');
    let url = 'http://100.114.31.171:19014/relation/class/get_members';
    return new Promise(function (resolve, reject) {
        request.get(url, {
            auth: {
                user: userId + '', // 必须为字符串
                pass: '1',
                sendImmediately: true
            },
            qs: {
                _classId: classId,
                role: role
            }
        }, function (err, response, body) {
            if (err) {
                return reject(err)
            }
            var body = JSON.parse(body)
            if (body.ret == 0 && body.errcode == 0) {
                resolve(body.data)
            } else {
                reject(body.msg)
            }
        });
    })
}

