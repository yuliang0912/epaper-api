"use strict"

var _ = require('underscore');
var Sequelize = require('sequelize');
var workHelper = require('./../../proxy/epaperwork/work_helper');

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
                raw: true,
                attributes: ['packageId', [Sequelize.literal('GROUP_CONCAT(DISTINCT classId)'), 'classIds']],
                where: {brandId, workId: 0, moduleId: {$ne: 5}, classId: {$in: classIds}},
                group: 'packageId',
                order: 'submitDate DESC',
                offset: (page - 1) * pageSize,
                limit: pageSize,
            }) : [];

        result.forEach(item=> {
            item.productId = item.packageId;
            item.productName = "书籍名称";
            item.cover = "http://www.ciwong.com"
        })

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

        yield this.dbContents.workSequelize.doEworks.findAll({
            attributes: [[Sequelize.literal('COUNT(*)'), 'addCount'], 'cid'],
            where: {
                classId, brandId, packageId,
                workId: 0,
                delStatus: 0,
                moduleId: {$ne: 5},
                submitDate: {$gt: lastDate}
            },
            group: 'cid'
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
                brandId, codeId, classId,
                delStatus: 0,
                moduleId: 5,
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
                classId, brandId, packageId, cid,
                workId: 0,
                delStatus: 0,
                moduleId: {$ne: 5},
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

        var eworksFunc = this.dbContents.workSequelize.eworks.findById(workId, {
            attributes: [[Sequelize.literal('CONCAT(workId)'), 'workId'], 'workName', 'publishUserId',
                'publishUserName', 'workMessage', 'publishDate', 'effectiveDate', 'totalNum', 'Status', 'workType']
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
        }).catch(this.error)
    },
    //提交线上作答作业
    submitWork: function *() {
        this.allow('POST').allowJson();
        var workId = this.checkBody('workId').default(0).isNumeric().value;
        var cid = this.checkBody('cId').isNumeric().value;
        var packageId = this.checkBody('packageId').toInt().value;
        var moduleId = this.checkBody('moduleId').in([123, 124]).toInt().value;
        var versionId = this.checkBody('versionId').isNumeric().value;
        var resourceName = this.checkBody('resourceName').notEmpty().value;
        var parentVersionId = this.checkBody('parentVersionId').isNumeric().value;
        var resourceType = this.checkBody('resourceType').isUUID().value;
        var workLong = this.checkBody('workLong').toInt().value;
        var doWorkPackageUrl = this.checkBody('doWorkPackageUrl').isUrl().value;
        var actualScore = this.checkBody('actualScore').toFloat().value;
        var brandId = this.checkBody('brandId').toInt().value;
        var classId = this.checkBody('classId').toInt().value;
        var workAnswers = this.checkBody('workAnswers').toJson().value;
        var userName = this.checkBody('userName').notEmpty().value;
        var clientId = this.checkQuery('client_id').default(0).toInt().value;

        this.errors && this.validateError();
        if (!Array.isArray(workAnswers) || workAnswers.length < 1) {
            this.error('workAnswers数据格式错误!', 101)
        }

        var doEwork = {
            workId, cid, packageId, moduleId, versionId, resourceName, parentVersionId, resourceType,
            workLong, doWorkPackageUrl, actualScore, brandId, classId, userName,
            workScore: 100,
            workStatus: 1,
            sourceType: clientId,
            insteadUserName: userName
        };
        doEwork.userId = doEwork.insteadUserId = this.request.userId;

        yield workHelper.submitWork(doEwork, workAnswers).then(this.success).catch(this.error)
    },
    //获取作业答案
    getWorkAnswers: function *() {
        var doWorkId = this.checkQuery('doWorkId').isNumeric().value;
        this.errors && this.validateError();

        var doWorkAnswer = yield this.dbContents.workSequelize.workAnswers.findById(doWorkId)
        if (!doWorkAnswer) {
            return this.success([]);
        }
        doWorkAnswer.correctContent = JSON.parse(doWorkAnswer.correctContent);

        if (Array.isArray(doWorkAnswer.correctContent) && doWorkAnswer.correctContent.length > 0) {
            this.success(doWorkAnswer.correctContent)
        } else {
            this.success(JSON.parse(doWorkAnswer.submitContent))
        }
    },
    //获取自主练习答案
    getLastSelfLearnAnswer: function *() {
        var brandId = this.checkQuery('brandId').toInt().value;
        var versionId = this.checkQuery('versionId').isNumeric().value;
        var packageId = this.checkQuery('packageId').toInt().gt(0).value;
        var resourceType = this.checkQuery('resourceType').isUUID().value;
        var cid = this.checkQuery('cid').notEmpty().value;
        this.errors && this.validateError();

        yield this.dbContents.workSequelize.doEworks.findOne({
            attributes: ['doWorkId'],
            where: {
                brandId, versionId, packageId, resourceType, cid, workId: 0
            }
        }).then(data=> {
            if (data) {
                return this.dbContents.workSequelize.workAnswers.findById(data.doWorkId)
            }
        }).then(workAnser=> {
            this.success(workAnser ? JSON.parse(workAnser.submitContent) : []);
        }).catch(this.error)
    },
    //老师保存批改答案
    saveCorrectAnswer: function *() {
        this.allow('POST').allowJson();
        var doWorkId = this.checkBody('doWorkId').isNumeric().value;
        var actualScore = this.checkBody('actualScore').toFloat().value;
        var correctContents = this.checkBody('correctContents').toJson().value;
        this.errors && this.validateError();

        if (!Array.isArray(correctContents) || correctContents.length < 1) {
            this.error('workAnswers数据格式错误!', 101)
        }
        var doWorkInfo = yield this.dbContents.workSequelize.doEworks.findById(doWorkId, {
            raw: true,
            attributes: [[Sequelize.literal('CONCAT(doeworks.workId)'), 'workId'], 'moduleId', 'brandId',
                'resourceName', 'userId', 'userName'],
            include: [{
                attributes: [],
                model: this.dbContents.workSequelize.eworks,
                where: {publishUserId: this.request.userId}
            }],
        })
        if (!doWorkInfo) {
            this.error('未找到作业或无批改权限', 102);
        }
        if (![123, 124].some(t=>t == doWorkInfo.moduleId)) {
            this.error('当前接口不支持此作业类型', 103);
        }
        //视频讲解格式验证
        if (doWorkInfo.moduleId === 123 && !correctContents.every(m=>Array.isArray(m.learnRecods) && m.learnRecods.length > 0)) {
            this.error('workAnswers数据格式错误!', 104)
        }
        //在线作答格式验证
        if (doWorkInfo.moduleId === 124 && !correctContents.every(m=>Array.isArray(m.answers) && m.answers.length > 0)) {
            this.error('workAnswers数据格式错误!', 105)
        }

        yield this.dbContents.workSequelize.transaction(trans=> {
            var updateDoeworksFunc = this.dbContents.workSequelize.doEworks.update({
                actualScore,
                workStatus: 4
            }, {where: {doWorkId}, transaction: trans})

            var updateAnswerFunc = this.dbContents.workSequelize.workAnswers.update({
                correctContent: correctContents,
                correctDate: Date.now()
            }, {where: {doWorkId}, transaction: trans})

            return Promise.all([updateDoeworksFunc, updateAnswerFunc])
        }).then(t=> {
            this.success(1)
            doWorkInfo.actualScore = actualScore;
            doWorkInfo.doWorkId = doWorkId;
            workHelper.sendCorrrectMsg(doWorkInfo).then(console.log).catch(console.log)
        }).catch(this.error)
    }
}






