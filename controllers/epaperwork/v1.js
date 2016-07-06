"use strict"

var _ = require('underscore');
var Sequelize = require('sequelize');

function sleep(sleepTime) {
    for (var start = +new Date; +new Date - start <= sleepTime;) {
    }
}

module.exports = {
    //按批次获取布置的作业
    getPublishWorkRecords: function *() {
        var page = this.checkQuery('page').toInt().gt(0).value;
        var pageSize = this.checkQuery('pageSize').toInt().gt(0).value;
        var brandId = this.checkQuery('brandId').toInt().value;
        this.errors && this.validateError();

        var batchList = yield this.dbContents.workSequelize.workBatch.findAndCount({
            raw: true,
            where: {brandId: brandId},
            offset: (page - 1) * pageSize,
            limit: pageSize,
        });

        var workList = [], workContentList = [];
        if (batchList.count > 0) {
            var batchIds = batchList.rows.map(m=>m.batchId);
            var eworkFunc = this.dbContents.workSequelize.eworks.findAll({
                attributes: ['batchId', [Sequelize.literal('CONCAT(workId)'), 'workId'], ['tags', 'reviceObject'], 'classId'],
                where: {batchId: {$in: batchIds}}
            });
            var eworkContentFunc = this.dbContents.workSequelize.workContents.findAll({
                attributes: ['batchId', 'packageId', 'cid', 'moduleId', 'versionId', 'parentVersionId', 'resourceName', 'resourceType'],
                where: {batchId: {$in: batchIds}}
            });
            workList = yield eworkFunc;
            workContentList = yield eworkContentFunc;
        }

        var result = batchList.rows.map(item=> {
            return {
                batchId: item.batchId,
                brandId: item.brandId,
                serviceType: item.workType,
                workName: item.workName,
                publishUserId: item.publishUserId,
                publishUserName: item.publishUserName,
                publishDate: item.publishDate.valueOf() / 1000,
                effectiveDate: item.effectiveDate.valueOf() / 1000,
                workList: workList.filter(work=> {
                    return work.batchId == item.batchId;
                }),
                workContents: workContentList.filter(content=> {
                    return content.batchId == item.batchId;
                })
            };
        });

        this.success({
            page: page,
            pageSize: pageSize,
            totalCount: batchList.count,
            pageCount: Math.ceil(batchList.count / pageSize),
            pageList: result
        });
    },
    //根据作业ID和最后查询日期获取最新提交的作业数量
    getAddCount: function *() {
        var workId = this.checkQuery('workId').notEmpty().isNumeric().value;
        var lastDate = this.checkQuery('lastDate').notEmpty().toDate().value;
        this.errors && this.validateError();

        yield this.dbContents.workSequelize.doEworks.count({
            where: {delStatus: 0, submitDate: {$gt: lastDate}, workId: workId}
        }).then(this.success);
    },
    //根据班级ID获取当前班级中所有人提交的自主测试书籍信息
    getSelfLearnBooks: function *() {
        var page = this.checkQuery('page').toInt().gt(0).value;
        var pageSize = this.checkQuery('pageSize').toInt().gt(0).value;
        var brandId = this.checkQuery('brandId').toInt().value;
        var classIds = this.checkQuery('classIds').notEmpty().match(/^\d+(,\d+)*$/).value;
        this.errors && this.validateError();

        classIds = classIds.split(',').map(item=>parseInt(item));

        var totalCount = yield this.dbContents.workSequelize.doEworks.findOne({
            raw: true,
            attributes: [[Sequelize.literal('COUNT(DISTINCT packageId)'), 'count']],
            where: {brandId: brandId, workId: 0, moduleId: {$ne: 5}, classId: {$in: classIds}},
        }).then(data=>data.count);

        var result = (totalCount > (page - 1) * pageSize) ?
            yield this.dbContents.workSequelize.doEworks.findAll({
                attributes: ['packageId', [Sequelize.literal('GROUP_CONCAT(DISTINCT classId)'), 'classIds']],
                where: {brandId: brandId, workId: 0, moduleId: {$ne: 5}, classId: {$in: classIds}},
                group: 'packageId',
                order: 'submitDate DESC',
                offset: (page - 1) * pageSize,
                limit: pageSize,
            }) : [];

        this.success({
            page: page, pageSize: pageSize,
            totalCount: totalCount,
            pageCount: Math.ceil(totalCount / pageSize),
            pageList: result
        });
    },
    //根据班级ID和书籍ID以及最后查询时间来获取新提交的自主测试
    getSelfLearnAddCount: function *() {
        var brandId = this.checkQuery('brandId').toInt().value;
        var classId = this.checkQuery('classId').toInt().gt(0).value;
        var packageId = this.checkQuery('packageId').toInt().gt(0).value;
        var lastDate = this.checkQuery('lastDate').notEmpty().toDate().value;
        this.errors && this.validateError();

        yield this.dbContents.workSequelize.doEworks.count({
            where: {
                workId: 0,
                delStatus: 0,
                classId: classId,
                brandId: brandId,
                packageId: packageId,
                moduleId: {$ne: 5},
                submitDate: {$gt: lastDate}
            },
        }).then(this.success);
    },
    //获取答题卡作业新提交的作业次数
    getPaperWorkAddCount: function *() {
        var brandId = this.checkQuery('brandId').toInt().value;
        var codeId = this.checkQuery('codeId').toInt().value;
        var classId = this.checkQuery('classId').toInt().gt(0).value;
        var lastDate = this.checkQuery('lastDate').notEmpty().toDate().value;
        this.errors && this.validateError();

        yield this.dbContents.workSequelize.doEworks.count({
            where: {
                delStatus: 0,
                brandId: brandId,
                moduleId: 5,
                codeId: codeId,
                classId: classId,
                submitDate: {$gt: lastDate}
            },
        }).then(this.success);
    },
    //根据班级ID和目录ID获取自主学习的记录
    getSelfLearnWorks: function *() {
        var brandId = this.checkQuery('brandId').toInt().value;
        var classId = this.checkQuery('classId').toInt().gt(0).value;
        var packageId = this.checkQuery('packageId').toInt().gt(0).value;
        var cid = this.checkQuery('cid').notEmpty().value;
        this.errors && this.validateError();

        yield this.dbContents.workSequelize.doEworks.findAll({
            raw: true,
            attributes: [[Sequelize.literal('CONCAT(doWorkId)'), 'doWorkId'], 'userId', 'userName', 'packageId',
                'cId', 'moduleId', 'versionId', 'resourceName', 'parentVersionId', 'resourceType', 'submitDate',
                'doWorkPackageUrl', 'workScore', 'actualScore', 'workLong', 'classId', 'submitCount'],
            where: {
                workId: 0,
                delStatus: 0,
                classId: classId,
                brandId: brandId,
                packageId: packageId,
                moduleId: {$ne: 5},
                cid: cid
            }
        }).then(data=> {
            data.forEach(m=>m.submitDate = m.submitDate.valueOf() / 1000);
            this.success(data);
        });
    },
    //根据作业ID获取作业详情
    getUserWorkDetail: function *() {
        var workId = this.checkQuery('workId').notEmpty().isNumeric().value;
        this.errors && this.validateError();

        var eworksFunc = this.dbContents.workSequelize.eworks.findOne({
            attributes: [[Sequelize.literal('CONCAT(workId)'), 'workId'], 'workName', 'publishUserId',
                'publishUserName', 'workMessage', 'publishDate', 'effectiveDate', 'totalNum', 'Status', 'workType'],
            where: {workId: workId},
        });

        var doeworksFunc = this.dbContents.workSequelize.doEworks.findAll({
            raw: true,
            attributes: [[Sequelize.literal('CONCAT(doWorkId)'), 'doWorkId'], 'actualScore', 'workLong',
                'doWorkPackageUrl', 'workStatus', 'submitCount', 'comment', 'versionId', 'parentVersionId', 'moduleId'],
            where: {workId: workId, userId: this.request.userId, delStatus: 0}
        });

        var workContentsFunc = this.dbContents.workSequelize.workContents.findAll({
            raw: true,
            attributes: ['packageId', 'cid', 'versionId', 'parentVersionId', 'moduleId', 'resourceName',
                'requirementContent', 'checkedResource'],
            where: {workId: workId}
        });

        yield Promise.all([eworksFunc, doeworksFunc, workContentsFunc]).then(results=> {
            var eworks = results[0];
            var result = {
                workId: workId,
                workName: eworks.workName,
                publishUserId: eworks.publishUserId,
                publishUserName: eworks.publishUserName,
                workMessage: eworks.workMessage,
                publishDate: eworks.publishDate.valueOf() / 1000,
                effectiveDate: eworks.effectiveDate.valueOf() / 1000,
                totalNum: eworks.totalNum,
                isDel: eworks.status == 2 ? 1 : 0,
                serviceType: eworks.workType
            };
            result.workContents = results[2].map(item=> {
                var data = _.find(results[1], model=> {
                    return item.versionId === model.versionId
                        && item.parentVersionId === model.parentVersionId
                        && item.moduleId === model.moduleId;
                })
                if (data !== undefined) {
                    item.doWorkId = data.doWorkId;
                    item.actualScore = data.actualScore;
                    item.workLong = data.workLong;
                    item.doWorkPackageUrl = data.doWorkPackageUrl;
                    item.workStatus = data.workStatus;
                    item.submitCount = data.submitCount;
                    item.commentContent = data.comment;
                } else {
                    item.doWorkId = "0";
                    item.actualScore = "0";
                    item.workLong = 0;
                    item.doWorkPackageUrl = "";
                    item.workStatus = 0;
                    item.submitCount = 0;
                    item.commentContent = "";
                }
                delete item.workId;
                item.packageId = item.packageId.toString();
                return item;
            });
            this.success(result);
        })
    }
}






