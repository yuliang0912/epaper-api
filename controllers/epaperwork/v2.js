/**
 * Created by yuliang on 2017/3/16.
 */

"use strict"

var Sequelize = require('sequelize');

module.exports.getPublishWorkRecordsForWeiXin = function *() {
    var page = this.checkQuery('page').toInt().gt(0).value;
    var pageSize = this.checkQuery('pageSize').toInt().gt(0).value;
    var brandId = this.checkQuery('brandId').toInt().value;
    this.errors && this.validateError();

    var workList = yield this.dbContents.workSequelize.eworks.findAndCount({
        raw: true,
        attributes: [[Sequelize.literal('CONCAT(workId)'), 'workId'], 'totalNum', 'workType', ['tags', 'reviceObject'], 'workName', 'publishDate', 'effectiveDate'],
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
            attributes: ['contentId', [Sequelize.literal('CONCAT(workId)'), 'workId'], 'resourceType', 'parentVersionId', 'versionId', 'resourceName'],
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
             AND doeworks.versionId = ${workContent.versionId} AND doeworks.parentVersionId = ${workContent.parentVersionId} 
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