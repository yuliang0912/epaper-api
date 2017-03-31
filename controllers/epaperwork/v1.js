"use strict"

var _ = require('underscore');
var ls = require('lodash');
var Promise = require('bluebird')
var Sequelize = require('sequelize');
var workHelper = require('./../../proxy/epaperwork/work_helper');
var eventFactory = require('./../../proxy/event_factory/event_factory')
var utils = require('../../lib/api_utils')
var work_helper = require('../../proxy/epaperwork/work_helper');

module.exports = {
    //作业相关事件触发器
    workEventTriggler: function *() {
        this.allow('POST').allowJson();
        var eventName = this.checkBody('eventName').notEmpty().value;
        var eventArgs = this.checkBody('eventArgs').notEmpty().value;
        this.errors && this.validateError();

        if (!eventFactory.workEvent) {
            this.error('作业事件已从配置中取消或者更改', 101)
        }

        if (!eventFactory.workEvent.eventNameArray.some(t=>t === eventName)) {
            this.error('未找到事件' + eventName, 101)
        }

        var userId = this.request.userId;

        eventFactory.workEvent.emit(eventName, eventArgs, userId)
        this.success(1)
    },
    //按批次获取布置的作业
    getPublishWorkRecords: function *() {
        var page = this.checkQuery('page').toInt().gt(0).value;
        var pageSize = this.checkQuery('pageSize').toInt().gt(0).value;
        var brandId = this.checkQuery('brandId').toInt().value;
        this.errors && this.validateError();

        var batchList = yield this.dbContents.workSequelize.workBatch.findAndCount({
            raw: true,
            where: {brandId: brandId, publishUserId: this.request.userId, status: 0},
            offset: (page - 1) * pageSize,
            limit: pageSize,
            order: 'batchId DESC'
        });

        var workList = [], workContentList = [];
        if (batchList.count > 0) {
            var batchIds = batchList.rows.map(m=>m.batchId);
            var eworkFunc = this.dbContents.workSequelize.eworks.findAll({
                attributes: ['batchId', [Sequelize.literal('CONCAT(workId)'), 'workId'], ['tags', 'reviceObject'], 'classId'],
                where: {batchId: {$in: batchIds}, status: 0}
            });
            var eworkContentFunc = this.dbContents.workSequelize.workContents.findAll({
                attributes: [[Sequelize.literal('DISTINCT batchId'), 'batchId'], 'packageId', 'cId', 'moduleId', 'versionId', 'parentVersionId', 'resourceName', 'resourceType', 'checkedResource'],
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
                sendDate: item.sendDate.valueOf() / 1000,
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

        yield workHelper.getProductInfo(result.map(t=>t.packageId)).then(products=> {
            result.forEach(item=> {
                var product = products.find(t=>t.product_id === item.packageId);
                item.productId = item.packageId;
                if (product) {
                    item.productName = product.product_name;
                    item.cover = product.cover_img_url;
                } else {
                    item.productName = item.cover = "";
                }
            })
        });

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
            attributes: [[Sequelize.literal('COUNT(*)'), 'addCount'], 'cId'],
            where: {
                classId, brandId, packageId,
                workId: 0,
                delStatus: 0,
                moduleId: {$ne: 5},
                submitDate: {$gt: lastDate}
            },
            group: 'cId'
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
                'doWorkPackageUrl', 'workScore', 'actualScore', 'workStatus', 'workLong', 'classId', 'submitCount',
                [Sequelize.literal('comment'), 'commentContent']],
            where: {
                classId, brandId, packageId, cid,
                workId: 0,
                delStatus: 0,
                moduleId: {$ne: 5},
            }
        }).each(m=>m.submitDate = m.submitDate.valueOf() / 1000).then(this.success).catch(this.error)
    },
    //根据作业ID获取作业详情
    getUserWorkDetail: function *() {
        var workId = this.checkQuery('workId').notEmpty().isNumeric().value;
        this.errors && this.validateError();

        var eworksFunc = this.dbContents.workSequelize.eworks.findById(workId, {
            attributes: [[Sequelize.literal('CONCAT(workId)'), 'workId'], 'workName', 'publishUserId', 'publishUserName',
                'workMessage', 'publishDate', 'effectiveDate', 'totalNum', 'workType', 'status', 'classId']
        });

        var doeworksFunc = this.dbContents.workSequelize.doEworks.findAll({
            raw: true,
            attributes: [[Sequelize.literal('CONCAT(doWorkId)'), 'doWorkId'], 'actualScore', 'workLong',
                'doWorkPackageUrl', 'workStatus', 'submitCount', 'comment', 'versionId', 'parentVersionId', 'moduleId'],
            where: {workId: workId, userId: this.request.userId, delStatus: 0}
        });

        var workContentsFunc = this.dbContents.workSequelize.workContents.findAll({
            raw: true,
            attributes: ['packageId', 'cId', 'versionId', 'parentVersionId', 'moduleId', 'resourceName',
                'resourceType', 'requirementContent', 'checkedResource'],
            where: {workId: workId}
        });


        yield Promise.all([eworksFunc, doeworksFunc, workContentsFunc]).spread(function (eworks, doeworks, workContents) {
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
                serviceType: eworks.workType,
                classId: eworks.classId
            };
            result.workContents = workContents.map(item=> {
                var data = doeworks.find(model=> {
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
            })
            return result;
        }).then(this.success).catch(this.error)
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
        var workType = this.checkBody('workType').default(0).toInt().value;
        var classId = this.checkBody('classId').toInt().value;
        var workAnswers = this.checkBody('workAnswers').toJson().value;
        var userName = this.checkBody('userName').notEmpty().value;
        var clientId = this.checkQuery('client_id').default(0).toInt().value;

        this.errors && this.validateError();
        if (!Array.isArray(workAnswers)) {
            this.error('workAnswers数据格式错误!', 101)
        }

        var doEwork = {
            workId, cid, packageId, moduleId, versionId, resourceName, parentVersionId, resourceType,
            workLong, doWorkPackageUrl, actualScore, brandId, workType, classId, userName,
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

        if (doWorkAnswer.correctContent) {
            try {
                doWorkAnswer.correctContent = JSON.parse(doWorkAnswer.correctContent);
            } catch (e) {
                doWorkAnswer.correctContent = []
            }
        }

        if (Array.isArray(doWorkAnswer.correctContent) && doWorkAnswer.correctContent.length > 0) {
            this.success(doWorkAnswer.correctContent)
        } else {
            this.success(JSON.parse(doWorkAnswer.submitContent))
        }
    },
    //获取最后一次提交的自主练习答案
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
            },
            order: "submitDate DESC"
        }).then(data=> {
            if (data) {
                return this.dbContents.workSequelize.workAnswers.findById(data.doWorkId)
            }
        }).then(workAnser=> {
            this.success(workAnser ? JSON.parse(workAnser.submitContent) : []);
        }).catch(this.error)
    },
    //老师保存批改答案[目前只支持在线作答]
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
            attributes: ['moduleId']
        })
        if (!doWorkInfo || doWorkInfo.moduleId != 124) {
            this.error('未找到作业或当前接口不支持此作业类型', 101);
        }
        //在线作答格式验证
        if (!correctContents.every(m=>Array.isArray(m.answers) && m.answers.length > 0)) {
            this.error('workAnswers数据格式错误!', 102)
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
            eventFactory.workEvent && eventFactory.workEvent.emit('corrrectWork', doWorkId)
        }).catch(this.error)
    },
    //获取视频讲解作业自主练习的资源
    getVideoWorkSelfLearnRecords: function *() {
        var brandId = this.checkQuery('brandId').toInt().value;
        var classId = this.checkQuery('classId').toInt().gt(0).value;
        this.errors && this.validateError();

        yield this.dbContents.workSequelize.doEworks.findAll({
            attributes: [[Sequelize.literal('DISTINCT versionId'), 'versionId'], 'resourceName',
                'packageId', 'cId'],
            where: {workId: 0, moduleId: 123, delStatus: 0, classId, brandId},
            order: 'submitDate DESC'
        }).then(this.success).catch(this.error)
    },
    //获取首次提交的自主练习成绩
    getFirstVideoWorkLearnSelfScore: function *() {
        var brandId = this.checkQuery('brandId').toInt().value;
        var versionId = this.checkQuery('versionId').isNumeric().value;
        var packageId = this.checkQuery('packageId').toInt().gt(0).value;
        var cid = this.checkQuery('cid').notEmpty().value;
        var classId = this.checkQuery('classId').toInt().gt(0).value;
        this.errors && this.validateError();

        yield this.dbContents.workSequelize.doEworks.findAll({
            attributes: ['userId', 'userName', 'actualScore'],
            where: {brandId, versionId, packageId, cid, classId, moduleId: 123, submitCount: 1, workId: 0}
        }).then(this.success).catch(this.error)
    },
    //获取班级中最后一次自主测试的视频讲解答案
    getSelfLearnVideoWorkAnswers: function *() {
        var brandId = this.checkQuery('brandId').toInt().value;
        var versionId = this.checkQuery('versionId').isNumeric().value;
        var packageId = this.checkQuery('packageId').toInt().gt(0).value;
        var cid = this.checkQuery('cid').notEmpty().value;
        var classId = this.checkQuery('classId').toInt().gt(0).value;
        this.errors && this.validateError();

        yield this.dbContents.workSequelize.doEworks.findAll({
            raw: true,
            attributes: ['userId', 'userName', 'actualScore'],
            include: [{
                attributes: ['submitContent'],
                model: this.dbContents.workSequelize.workAnswers
            }],
            where: {packageId, cid, versionId, brandId, classId, workId: 0, moduleId: 123, delStatus: 0}
        }).map(item=> {
            return {
                userId: item.userId,
                userName: item.userName,
                actualScore: item.actualScore,
                userAnswers: JSON.parse(item['eworkanswer.submitContent'])
            }
        }).then(this.success).catch(this.error)
    },
    //获取视频讲解作业的布置记录(PC端作业报告使用)
    getVideoWorkPublishRecords: function *() {
        var brandId = this.checkQuery('brandId').toInt().value;
        var classId = this.checkQuery('classId').toInt().gt(0).value;
        this.errors && this.validateError();

        yield this.dbContents.workSequelize.eworks.findAll({
            raw: true,
            attributes: [[Sequelize.literal('DISTINCT CONCAT(eworks.workId)'), 'workId'], 'workName'],
            include: [{
                attributes: [],
                model: this.dbContents.workSequelize.workContents,
                where: {moduleId: 123}
            }],
            where: {publishUserId: this.request.userId, brandId, classId, status: 0},
            order: "publishDate DESC"
        }).then(this.success).catch(this.error)
    },
    //获取作业内容(PC端作业报告使用)
    getWorkContents: function *() {
        var workId = this.checkQuery('workId').notEmpty().isNumeric().value;
        var moduleId = this.checkQuery('moduleId').default(123).toInt().value;
        this.errors && this.validateError();

        var condition = {workId: workId, moduleId: 123};
        if (moduleId !== 0) {
            condition.moduleId = moduleId
        }

        yield this.dbContents.workSequelize.workContents.findAll({
            attributes: ['packageId', 'cId', 'moduleId', 'versionId', 'parentVersionId', 'resourceType', 'resourceName'],
            where: condition
        }).then(this.success).catch(this.error)
    },
    //获取首次提交的作业的成绩
    getFirstWorkScore: function *() {
        var versionId = this.checkQuery('versionId').isNumeric().value;
        var parentVersionId = this.checkQuery('parentVersionId').isNumeric().value;
        var resourceType = this.checkQuery('resourceType').isUUID().value;
        var workId = this.checkQuery('workId').isNumeric().value;
        this.errors && this.validateError();

        yield this.dbContents.workSequelize.doEworks.findAll({
            attributes: ['userId', 'userName', 'actualScore'],
            where: {versionId, parentVersionId, resourceType, workId, submitCount: 1}
        }).then(this.success)
    },
    //批量获取作业答案(PC端作业报告使用)
    getUserVideoWorkAnswers: function *() {
        var versionId = this.checkQuery('versionId').isNumeric().value;
        var workId = this.checkQuery('workId').isNumeric().value;
        this.errors && this.validateError();

        yield this.dbContents.workSequelize.doEworks.findAll({
            raw: true,
            attributes: ['userId', 'userName', 'actualScore'],
            include: [{
                attributes: ['submitContent'],
                model: this.dbContents.workSequelize.workAnswers
            }],
            where: {versionId, workId, moduleId: 123, delStatus: 0}
        }).map(item=> {
            return {
                userId: item.userId,
                userName: item.userName,
                actualScore: item.actualScore,
                userAnswers: JSON.parse(item['eworkanswer.submitContent'])
            }
        }).then(this.success).catch(this.error)
    },
    //根据doworkId获取作业信息
    getDoWorkInfo: function *() {
        var doWorkId = this.checkQuery('doWorkId').isNumeric().value;
        this.errors && this.validateError();
        yield this.dbContents.workSequelize.doEworks.findById(doWorkId, {
            raw: true,
            attributes: [[Sequelize.literal('CONCAT(doWorkId)'), 'doWorkId'], 'userId', 'userName', 'packageId',
                'cId', 'moduleId', 'resourceName', 'versionId', 'parentVersionId', 'resourceType', 'submitDate',
                'doWorkPackageUrl', [Sequelize.literal('CONCAT(workId)'), 'workId'], 'actualScore', 'workLong', 'workStatus', 'classId',
                'submitCount', 'workType', [Sequelize.literal('CONCAT(comment)'), 'commentContent']]
        }).then(doWork=> {
            if (doWork) {
                doWork.submitDate = doWork.submitDate.toUnix()
                doWork.packageId = doWork.packageId.toString()
            }
            this.success(doWork)
        }).catch(this.error)
    },
    getUserCurrDateWorks: function *() {
        var sql = `SELECT eworks.workId,eworks.workName,eworkcontents.resourceName,eworkcontents.packageId,eworkcontents.cId,
                   eworkcontents.moduleId FROM eworks 
                   INNER JOIN eworkmembers ON eworks.workId =  eworkmembers.workId
                   INNER JOIN eworkcontents ON eworks.workId = eworkcontents.workId
                   WHERE eworkmembers.userId = ${this.request.userId}
                   AND eworks.publishDate > CURRENT_DATE()`

        yield this.dbContents.workSequelize.query(sql, {
            raw: true,
            type: 'SELECT'
        }).then(list=> list.groupBy('workId')).map(item=> {
            return {
                workName: item.value[0].workName,
                packageUrl: `http://file.dzb.ciwong.com/epaper/catalogue_${item.value[0].packageId}_${item.value[0].cId}.zip`,
                workList: item.value,
            }
        }).then(this.success).catch(this.error)
    },
    getReceiveBookchapters: function *() {
        var brandId = this.checkQuery('brandId').toInt().value;
        var serviceId = this.checkQuery('serviceId').toInt().gt(0).value;
        var packageId = this.checkQuery('packageId').toInt().gt(0).value;
        this.errors && this.validateError();

        yield this.dbContents.workSequelize.eworks.findAll({
            raw: true,
            attributes: [],
            include: [
                {
                    attributes: [],
                    model: this.dbContents.workSequelize.workMembers,
                    where: {userId: this.request.userId}
                }, {
                    attributes: [[Sequelize.literal('DISTINCT cId'), 'cId']],
                    model: this.dbContents.workSequelize.workContents,
                    where: {packageId}
                }],
            where: {status: 0, brandId, workType: serviceId}
        }).map(item=> {
            return item["eworkcontents.cId"];
        }).then(this.success)
    },
    scoreCoefficient: function *() {
        var brandId = this.checkQuery('brandId').toInt().value;
        this.errors && this.validateError();

        var coefficient = 1.0;
        switch (brandId) {
            case 1:
                coefficient = 1.1;
                break;
            default:
                break;
        }
        this.success(coefficient)
    },
    /**
     * 获取一个作业内容的统计成绩
     * @contentId
     */
    getEworkContentScoreStatistics: function *(){
        // 1.查询单个作业内容(by contentId)
        // 2.查询本次作业信息(by workId), 包括内容列表信息
        // 3.查询班级成员列表(by classId)
        let contentId = this.checkQuery('contentId').notEmpty().toInt().value;
        let userId = this.request.userId;
        this.errors && this.validateError();
        let result;
        let work;
        let contentList;
        let receivers;
        let submitRecords;
        let classMembers;
        let statistics;
        let currentContent = yield this.dbContents.workSequelize.workContents.findById(contentId, {
            raw: true,
            attributes: ['contentId'
            , 'batchId'
            , [Sequelize.literal('CONCAT(workId)')
            , 'workId']
            , [Sequelize.literal('CONCAT(packageId)')
            , 'packageId']
            , 'cId'
            , 'moduleId'
            , 'versionId'
            , 'parentVersionId'
            , 'resourceType'
            , 'resourceName']
        });
        if(currentContent){
            let moduleId = parseInt(currentContent.moduleId); // 10 同步跟读 15 听说模考 124 线上作答 126 视频教程
            currentContent.score = 100;
            switch (moduleId) {
                case 10:
                    currentContent.moduleName = '同步跟读';
                    break;
                case 15:
                    currentContent.moduleName = '听说模考';
                    currentContent.score = 15;
                case 124:
                    currentContent.moduleName = '线上作答';
                case 126:
                    currentContent.moduleName = '视频教程';
                default:
                    break;
            }
            let workId = currentContent.workId;
            work = yield this.dbContents.workSequelize
            .eworks
            .findById(workId, {
                raw: true,
                attributes: [
                    [Sequelize.literal('CONCAT(workId)'), 'workId'], 
                    'workName', 
                    [Sequelize.literal('CONCAT(classId)'), 'classId']],
                where: {status: 0}
            });
            if(work){
                // 查询作业内容列表
                contentList = yield this.dbContents.workSequelize
                .workContents
                .findAll({
                    attributes: [
                        'contentId',
                        'resourceName'
                    ],
                    where: {
                        workId
                    }
                });
                work.contentList = contentList;
                // 查询作业接收者列表
                receivers = yield this.dbContents.workSequelize
                .workMembers
                .findAll({
                    attributes: [[Sequelize.literal('CONCAT(workId)'), 'workId'], 'userId', 'userName', 'status', 'isRead'],
                    where: {
                        workId
                    }
                });
                if(receivers && receivers.length > 0){
                    classMembers = classMembers || receivers.map(r=> {return {userId: r.userId, userName: r.userName}}) || [];
                    // 查询作业内容提交记录列表
                    submitRecords = yield this.dbContents.workSequelize
                    .doEworks
                    .findAll({
                        attributes: [[Sequelize.literal('CONCAT(doWorkId)'), 'doWorkId']
                        , 'userId', 'userName'
                        , [Sequelize.literal('CONCAT(packageId)'), 'packageId']
                        , 'cId', 'moduleId', 'versionId', 'resourceName', 'parentVersionId', 'resourceType'
                        , 'submitDate'
                        , [Sequelize.literal('CONCAT(workId)'), 'workId']
                        , 'workScore'
                        , 'actualScore'],
                        where: {
                            workId,
                            packageId: currentContent.packageId,
                            cId: currentContent.cId,
                            moduleId: currentContent.moduleId,
                            versionId: currentContent.versionId,
                            parentVersionId: currentContent.parentVersionId,
                            resourceType: currentContent.resourceType,
                            userId: {$in: receivers.map(r=>r.userId)}
                        }
                    });
                    if(submitRecords && submitRecords.length){
                        submitRecords.forEach(r=>{
                            let mid = parseInt(r.moduleId);
                            switch (mid) {
                                case 15: // 听说模考
                                    r.workScore = 15;
                                    break;
                                default: // 其它
                                    r.workScore = 100;
                                    break;
                            }
                        });
                        // TODO: 查询班级成员列表, 确定未被布置作业的学生
                        let classId = work.classId;
                        classMembers = yield work_helper.getClassMembers(classId, userId);
                        let unreceivers = [];
                        classMembers.forEach(cm=>{
                            let t = receivers.find(r=>r.userId==cm.userId);
                            if(!t){
                                unreceivers.push(cm);
                            }
                        });
                        // 统计(最高, 最低, 平均分, 优秀率, 及格率)
                        let max = ls.max(submitRecords, 'actualScore').actualScore;
                        let min = ls.min(submitRecords, 'actualScore').actualScore;
                        let scores = submitRecords.map(r=>r.actualScore);
                        let average = ls.sum(scores) / submitRecords.length;
                        let passRate = ls.filter(submitRecords, (sr)=>sr.actualScore>=(currentContent.score*0.6)).length / submitRecords.length;
                        let excellentRate = ls.filter(submitRecords, (sr)=>sr.actualScore>=(currentContent.score*0.8)).length / submitRecords.length;
                        statistics = {max, min, average, passRate, excellentRate};
                        let sortRes = ls.sortByOrder(submitRecords, ['actualScore'], ['desc']);
                        let records = [];
                        sortRes.forEach(r=>{
                            let currentIndex = sortRes.indexOf(r) + 1;
                            r = r.dataValues;
                            records.push(Object.assign({index: currentIndex}, r));
                        });
                        this.success({ work, currentContent, unreceivers, receivers, statistics, records: records });
                        return;
                    }
                }

            }
        }
        this.error('无有效记录');
    },
    /**
     * 获取一次作业的统计成绩
     * @workId
     */
    getEworkScoreStatistics: function *(){
        // 1.查询本次作业信息(by workId), 包括内容列表信息
        let workId = this.checkQuery('workId').notEmpty().toInt().value;
        let userId = this.request.userId;
        this.errors && this.validateError();
        let result;
        let work;
        let contentList;
        let receivers;
        let submitRecords;
        let classMembers;
        let statistics;
        work = yield this.dbContents.workSequelize
        .eworks
        .findById(workId, {
            raw: true,
            attributes: [
                [Sequelize.literal('CONCAT(workId)'), 'workId'], 
                'workName', 
                [Sequelize.literal('CONCAT(classId)'), 'classId']],
            where: {status: 0}
        });
        if(work){
            // 查询作业内容列表
            contentList = yield this.dbContents.workSequelize
            .workContents
            .findAll({
                attributes: [
                    'contentId',
                    [Sequelize.literal('CONCAT(workId)'), 'workId'],
                    [Sequelize.literal('CONCAT(packageId)'), 'packageId']
                    , 'cId', 'moduleId', 'versionId', 'resourceName', 'parentVersionId', 'resourceType', 'resourceName'
                ],
                where: {
                    workId
                }
            });
            contentList = ls.sortBy(contentList, 'contentId');
            work.contentList = contentList;
            // 查询作业接收者列表
            receivers = yield this.dbContents.workSequelize
            .workMembers
            .findAll({
                attributes: [[Sequelize.literal('CONCAT(workId)'), 'workId'], 'userId', 'userName', 'status', 'isRead'],
                where: {
                    workId
                }
            });
            if(receivers && receivers.length > 0){
                // 查询作业内容提交记录列表
                submitRecords = yield this.dbContents.workSequelize
                .doEworks
                .findAll({
                    attributes: [[Sequelize.literal('CONCAT(doWorkId)'), 'doWorkId']
                    , 'userId', 'userName'
                    , [Sequelize.literal('CONCAT(packageId)'), 'packageId']
                    , 'cId', 'moduleId', 'versionId', 'resourceName', 'parentVersionId', 'resourceType'
                    , 'submitDate'
                    , [Sequelize.literal('CONCAT(workId)'), 'workId']
                    , 'workScore'
                    , 'actualScore'],
                    where: {
                        workId,
                        userId: {$in: receivers.map(r=>r.userId)}
                    }
                });
                if(submitRecords && submitRecords.length){
                    submitRecords.forEach(r=>{
                        let mid = parseInt(r.moduleId);
                        switch (mid) {
                            case 15: // 听说模考
                                r.workScore = 15;
                                break;
                            default: // 其它
                                r.workScore = 100;
                                break;
                        }
                    });
                    // 以用户分组统计
                    let groups = ls.groupBy(submitRecords, 'userId');
                    let header = ['排名', '姓名'];
                    let contentNames = contentList.map(c=>c.resourceName);
                    header = header.concat(contentNames);
                    header.push('总分');
                    let scoreOfMembers = [];
                    for (let key in groups) {
                        if (groups.hasOwnProperty(key)) {
                            let element = groups[key];
                            let member = element[0];
                            let scoreOfMember = {};
                            let scores = element.map(e=>e.actualScore);
                            scoreOfMember.totalScore = ls.sum(scores);
                            scoreOfMember.userId = member.userId;
                            scoreOfMember.userName = member.userName;
                            contentList.forEach(c=>{
                                scoreOfMember[c.contentId + '-' + c.resourceName] = 0;
                                let r = ls.find(element, (e)=>e.packageId==c.packageId&&e.cId==c.cId&&e.versionId==c.versionId&&e.parentVersionId==c.parentVersionId&&e.resourceType==c.resourceType);
                                if(r){
                                    r.contentId = c.contentId;
                                    scoreOfMember[c.contentId + '-' + c.resourceName] = r.actualScore;
                                }
                            });

                            scoreOfMembers.push(scoreOfMember);
                        }
                    }
                    // TODO: 查询班级成员列表, 确定未被布置作业的学生
                    let classId = work.classId;
                    classMembers = yield work_helper.getClassMembers(classId, userId);
                    let unreceivers = [];
                    classMembers.forEach(cm=>{
                        let t = receivers.find(r=>r.userId==cm.userId);
                        if(!t){
                            unreceivers.push(cm);
                        }
                    });
                    // 统计(最高, 最低, 平均分)
                    let max = ls.max(scoreOfMembers, 'totalScore').totalScore;
                    let min = ls.min(scoreOfMembers, 'totalScore').totalScore;
                    let scores = scoreOfMembers.map(r=>r.totalScore);
                    let average = ls.sum(scores) / scoreOfMembers.length;
                    statistics = {max, min, average};
                    let sortRes = ls.sortByOrder(scoreOfMembers, ['totalScore'], ['desc']);
                    sortRes.forEach(r=>{
                        r.index = sortRes.indexOf(r) + 1;
                    });
                    this.success({ work, header, unreceivers, receivers, records: sortRes, statistics });
                    return;
                }
            }

        }
        this.error('无有效记录');
    }
}






