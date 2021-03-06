"use strict";

var sequelize = require('sequelize');


module.exports = {

    /**
     * 添加用户视频学习记录
     */
    addrecord: function*() {

        this.allow('POST'); //.allowJson();
        var brandId = this.checkBody('brandId').notEmpty().toInt().value;
        var paperId = this.checkBody('paperId').notEmpty().value;
        var paperVersion = this.checkBody('paperVersion').notEmpty().value;
        var quesId = this.checkBody('quesId').notEmpty().value;
        var quesVersion = this.checkBody('quesVersion').notEmpty().value;
        var userId = this.request.userId;

        this.errors && this.validateError();

        yield this.dbContents.workSequelize.learningrecords.create({
            brandId,
            paperId,
            paperVersion,
            quesId,
            quesVersion,
            userId,
            createdAt: new Date()
        }).then(data => {
            if (data) this.success(true);
            else this.success(false);
        }).catch(this.error);

    },
    /**
     * 获取视频课程学习记录
     */
    getrecords: function*() {

        var brandId = this.checkQuery('brandId').notEmpty().toInt().value;
        var paperId = this.checkQuery('paperId').notEmpty().value;
        var userId = this.request.userId;
        this.errors && this.validateError();

        yield this.dbContents.workSequelize.learningrecords.findAll({
            attributes: [[sequelize.literal('CONCAT(quesId)'), 'quesId'], [sequelize.literal('CONCAT(quesVersion)'), 'quesVersion'], [sequelize.fn('COUNT', sequelize.col('quesId')), 'no_does']],
            group: ['quesId'],
            order: [
                ['quesId', 'ASC']
            ],
            where: {
                paperId,
                userId,
                brandId
            }
        }).then(this.success).catch(this.error);
    }
}