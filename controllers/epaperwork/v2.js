/**
 * Created by yuliang on 2017/3/16.
 */

"use strict"

var Promise = require('bluebird')
var Sequelize = require('sequelize');

module.exports.noAuths = ['getDoWorkInfo']

module.exports.getPublishWorkRecordsForWeiXin = function *() {
    var page = this.checkQuery('page').toInt().gt(0).value;
    var pageSize = this.checkQuery('pageSize').toInt().gt(0).value;
    var brandId = this.checkQuery('brandId').toInt().value;
    this.errors && this.validateError();

    var workList = yield this.dbContents.workSequelize.eworks.findAndCount({
        raw: true,
        attributes: [[Sequelize.literal('CONCAT(workId)'), 'workId'], 'totalNum', 'workType', ['tags', 'reviceObject'], 'workName', 'publishDate', 'sendDate', 'effectiveDate'],
        where: {brandId: brandId, publishUserId: this.request.userId, status: 0},
        offset: (page - 1) * pageSize,
        limit: pageSize,
        order: 'publishDate DESC'
    });

    var submitCountList = [], workContentList = [];
    if (workList.count > 0) {
        var workIds = workList.rows.map(m=>m.workId);

        var eworkContentFunc = this.dbContents.workSequelize.workContents.findAll({
            raw: true,
            attributes: ['contentId', [Sequelize.literal('CONCAT(workId)'), 'workId'], 'resourceType', 'moduleId', 'parentVersionId', 'versionId', 'resourceName', 'requirementContent'],
            where: {workId: {$in: workIds}}
        });

        var submitCountFunc = this.dbContents.workSequelize.doEworks.findAll({
            raw: true,
            attributes: [[Sequelize.literal('COUNT(DISTINCT userId)'), 'submitCount'], 'workId', 'resourceType', 'parentVersionId', 'versionId'],
            where: {workId: {$in: workIds}},
            group: 'workId,resourceType,parentVersionId,versionId'
        });

        submitCountList = yield submitCountFunc;
        workContentList = yield eworkContentFunc;
    }

    workContentList.forEach(item=> {
        let model = submitCountList.find(m=> {
            return m.workId == item.workId && m.resourceType == item.resourceType
                && m.parentVersionId == item.parentVersionId && m.versionId == item.versionId
        })
        try {
            item.requirementContent = JSON.parse(item.requirementContent);
        } catch (e) {
            item.requirementContent = {}
        }
        item.submitCount = model ? model.submitCount : 0;
    })

    this.success({
        page: page,
        pageSize: pageSize,
        totalCount: workList.count,
        pageCount: Math.ceil(workList.count / pageSize),
        pageList: workList.rows.map(item=> {
            return {
                workId: item.workId,
                serviceType: item.workType,
                workName: item.workName,
                totalNum: item.totalNum,
                reviceObject: item.reviceObject,
                publishDate: item.publishDate.valueOf() / 1000,
                sendDate: item.sendDate.valueOf() / 1000,
                effectiveDate: item.effectiveDate.valueOf() / 1000,
                workContents: workContentList.filter(content=> {
                    return content.workId == item.workId;
                })
            };
        })
    });
}

module.exports.getWorkContenSubmitRecords = function *() {
    var workId = this.checkQuery('workId').isNumeric().value;
    var contentId = this.checkQuery('contentId').toInt().gt(0).value;
    this.errors && this.validateError();

    var workContent = yield this.dbContents.workSequelize.workContents.findOne({
        raw: true,
        attributes: ['resourceType', 'parentVersionId', 'versionId'],
        where: {contentId, workId}
    });
    var workMembers = yield this.dbContents.workSequelize.workMembers.findAll({
        raw: true,
        attributes: ['userId', 'userName'],
        where: {workId}
    });

    if (!workContent) {
        this.error("参数错误,找不到作业内容")
    }

    var sql = `SELECT eworkmembers.userId,eworkmembers.userName,doeworks.actualScore,doeworks.submitDate FROM eworkmembers 
             INNER JOIN doeworks ON  eworkmembers.userId = doeworks.userId AND eworkmembers.workId = doeworks.workId
             WHERE eworkmembers.workId = ${workId} AND doeworks.delStatus = 0 AND doeworks.resourceType = '${workContent.resourceType}' 
             AND doeworks.versionId = '${workContent.versionId}' AND doeworks.parentVersionId = '${workContent.parentVersionId}' 
             ORDER BY doeworks.actualScore DESC,doeworks.submitDate ASC`;

    var submitList = yield this.dbContents.workSequelize.query(sql, {type: "SELECT"})

    submitList.forEach(item=> {
        item.submitDate = item.submitDate.valueOf() / 1000;
    })

    workMembers.forEach(member=> {
        if (!submitList.some(n=>n.userId == member.userId)) {
            submitList.push({userId: member.userId, userName: member.userName, actualScore: 0, submitDate: 0})
        }
    });

    this.success(submitList)
}

module.exports.getDoWorkInfo = function *() {
    var doWorkId = this.checkQuery('doWorkId').isNumeric().value;
    this.errors && this.validateError();

    var task1 = this.dbContents.workSequelize.doEworks.findById(doWorkId, {raw: true})
    var task2 = this.dbContents.workSequelize.workAnswers.findById(doWorkId, {raw: true})

    var doWorkInfo, workAnswer, checkedResource = null, requirementContent = null;

    yield Promise.all([task1, task2]).spread(function (result1, result2) {
        doWorkInfo = result1, workAnswer = result2;
    })

    if (!doWorkInfo) {
        this.error("未找到作业", 101)
    }
    if (doWorkInfo.workId > 0) {
        yield this.dbContents.workSequelize.workContents.findOne({
            attributes: ["checkedResource", "requirementContent"],
            where: {
                workId: doWorkInfo.workId,
                moduleId: doWorkInfo.moduleId,
                versionId: doWorkInfo.versionId,
                parentVersionId: doWorkInfo.parentVersionId
            },
            raw: true
        }).then(data=> {
            if (data) {
                checkedResource = data.checkedResource;
                requirementContent = data.requirementContent;
            }
        })
    }

    var result = {
        doWorkId,
        userId: doWorkInfo.userId,
        userName: doWorkInfo.userName,
        workName: doWorkInfo.resourceName,
        workScore: doWorkInfo.workScore,
        actualScore: doWorkInfo.actualScore,
        workLong: doWorkInfo.workLong,
        workStatus: doWorkInfo.workStatus,
        moduleId: doWorkInfo.moduleId,
        resourceType: doWorkInfo.resourceType,
        versionId: doWorkInfo.versionId,
        parentVersionId: doWorkInfo.parentVersionId,
        submitDate: doWorkInfo.submitDate.valueOf() / 1000,
        submitCount: doWorkInfo.submitCount,
        comment: doWorkInfo.comment
    }

    if (workAnswer.correctContent) {
        try {
            workAnswer.correctContent = JSON.parse(workAnswer.correctContent);
        } catch (e) {
            workAnswer.correctContent = []
        }
    }
    if (Array.isArray(workAnswer.correctContent) && workAnswer.correctContent.length > 0) {
        result.workAnswers = workAnswer.correctContent
    } else {
        result.workAnswers = JSON.parse(workAnswer.submitContent)
    }
    result.checkedResource = checkedResource ? checkedResource.split(',') : [];

    if (requirementContent) {
        try {
            result.requirementContent = JSON.parse(requirementContent);
        } catch (e) {
            result.requirementContent = {}
        }
    } else {
        result.requirementContent = null;
    }
    this.success(result)
}

//获取答案统计
module.exports.workAnswerStatistics = function *() {
    var workId = this.checkQuery('workId').isNumeric().value;
    var contentId = this.checkQuery('contentId').toInt().value;
    this.errors && this.validateError();

    var result = {}
    var eworksFunc = this.dbContents.workSequelize.eworks.findById(workId);
    var workContentFunc = this.dbContents.workSequelize.workContents.findById(contentId);

    yield Promise.all([eworksFunc, workContentFunc]).spread((eworkInfo, workContent)=> {
        if (!eworkInfo || !workContent || workContent.workId != workId) {
            this.error("参数workId或者contentId错误")
        }
        result.checkedResource = workContent.checkedResource
        result.totalNum = eworkInfo.totalNum
        return workContent
    }).then(workContent=> {
        let sqlDoworkList =
            `SELECT doworkId FROM doeworks WHERE workId = :workId AND moduleId = :moduleId
             AND versionId = :versionId AND parentVersionId = :parentVersionId AND delStatus = 0 GROUP BY userId`;
        return this.dbContents.workSequelize.query(sqlDoworkList, {
            raw: true, type: 'SELECT', replacements: {
                workId, moduleId: workContent.moduleId,
                versionId: workContent.versionId, parentVersionId: workContent.parentVersionId
            }
        })
    }).then(doworkIdList=> {
        result.submitCount = doworkIdList.length;
        if (doworkIdList.length == 0) {
            return []
        }
        var doworkId = doworkIdList.map(item=>item.doworkId).toString()

        var sql1 = `SELECT avg(score) as avgScore,COUNT(*) as submitCount,versionId FROM eworkanswerdetails 
                    WHERE doworkId in (${doworkId}) GROUP BY versionId`;
        var sql2 = `SELECT COUNT(*) as errorCount,versionId FROM eworkanswerdetails 
                    WHERE doworkId in (${doworkId}) AND assess = 2 GROUP BY versionId`;

        var task1 = this.dbContents.workSequelize.query(sql1, {raw: true, type: 'SELECT'})
        var task2 = this.dbContents.workSequelize.query(sql2, {raw: true, type: 'SELECT'})

        return Promise.all([task1, task2]).spread(function (avgInfoList, errInfoList) {
            avgInfoList.forEach(item=> {
                var errInfo = errInfoList.find(m=>m.versionId == item.versionId)
                item.errorCount = errInfo ? errInfo.errorCount : 0
            })
            return avgInfoList
        })
    }).then(statistics=> {
        result.statistics = statistics
        this.success(result)
    }).catch(this.error)
}