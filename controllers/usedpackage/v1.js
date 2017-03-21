"use strict";

let sequelize = require('sequelize');
let moment = require('moment');
let request = require('request');
let config = require('../../configs/main');

module.exports = {

    /**
     * 更新资源包的最新使用记录
     * 
     */
    updateRecord: function* () {
        this.allow('POST'); //.allowJson();
        var brandId = this.checkBody('brandId').notEmpty().toInt().value;
        var serviceId = this.checkBody('serviceId').notEmpty().toInt().value;
        var latestPackageId = this.checkBody('packageId').notEmpty().toInt().value;
        var userId = this.request.userId;

        this.errors && this.validateError();

        // TODO: 查询记录, 不存在则创建, 否则更新
        let record = yield this.dbContents.workSequelize.usedpkgrecords.findOne({
            attributes: ['id', 'userId', 'brandId', 'serviceId', 'latestPackageId'],
            where: {
                userId,
                brandId,
                status: 0
            },
        });
        if (record) {
            // 更新
            yield this.dbContents.workSequelize.usedpkgrecords.update({
                serviceId,
                latestPackageId,
                updateAt: moment().format("YYYY-MM-DD HH:mm:ss")
            }, {
                where: {
                    id: record.id
                }
            });
        } else {
            // 创建
            let nowTime = moment().format("YYYY-MM-DD HH:mm:ss");
            yield this.dbContents.workSequelize.usedpkgrecords.create({
                userId,
                brandId,
                serviceId,
                latestPackageId,
                updateAt: nowTime,
                createAt: nowTime
            });
        }
        this.success();
    },

    /**
     * 查询老师布置作业时最新的资源包使用记录
     * 
     */
    getLatest: function* () {
        console.log('');
        var brandId = this.checkQuery('brandId').notEmpty().toInt().value;
        let serviceId = this.checkQuery('serviceId').value;
        let packageId = this.checkQuery('packageId').value;
        var userId = this.request.userId;
        this.errors && this.validateError();
        if(!!packageId){
            let detail = yield getPackageInfoById(packageId, userId);
            return this.success(detail);
        }
        // TODO: 查询资源包详情
        // 1. 查询latestPackageId
        let record = yield this.dbContents.workSequelize.usedpkgrecords.findOne({
            attributes: ['id', 'userId', 'brandId', 'serviceId', 'latestPackageId'],
            where: {
                userId,
                brandId,
                status: 0
            },
        });
        if(record){
            let latestPackageId = record.latestPackageId;
            let serviceId = record.serviceId;
            // 检查服务的有效性
            let data = yield getServiceInfoById(serviceId, userId);
            if(data){
                // 查询资源包详情
                let detail = yield getPackageInfoById(latestPackageId, userId);
                return this.success(detail);
            }
        }
        return this.error('资源无效');
    }
}


//根据packageId获取资源包详情
function getPackageInfoById(packageId, userId) {
    let url = 'http://100.114.31.171:8890/package/catalogues_package';
    if(config.env == 'development') url = 'http://eapi.ciwong.com/gateway/v1/package/catalogues_package?accessToken=0000936ab763407bbeab510204983cac7cbe54cb&clientId=100039';
    return new Promise(function (resolve, reject) {
        request.get(url, {
            auth: {
                user: userId + '', // 必须为字符串
                pass: '1',
                sendImmediately: true
            },
            qs: {
                packageId
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

//根据serviceId获取服务详情
function getServiceInfoById(serviceId, userId) {
    let url = 'http://10.170.251.29:8866/jfyservice/getbyid';
    if(config.env == 'development') url = 'http://eapi.ciwong.com/gateway/v1/jfyservice/getbyid?accessToken=0000936ab763407bbeab510204983cac7cbe54cb&clientId=100039';
    return new Promise(function (resolve, reject) {
        request.get(url, {
            auth: {
                user: userId + '', // 必须为字符串
                pass: '1',
                sendImmediately: true
            },
            qs: { serviceId }
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