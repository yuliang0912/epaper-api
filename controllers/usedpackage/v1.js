"use strict";

let sequelize = require('sequelize');
let moment = require('moment');
let request = require('request');
let config = require('../../configs/main');

module.exports = {

    /**
     * 更新资源包的最新使用记录
     * brandId + userId + packageId 为key, serviceId 为value 可变
     * 
     */
    updateRecord: function* () {
        this.allow('POST'); //.allowJson();
        var brandId = this.checkBody('brandId').notEmpty().toInt().value;
        var serviceId = this.checkBody('serviceId').notEmpty().toInt().value;
        var packageId = this.checkBody('packageId').notEmpty().toInt().value;
        var userId = this.request.userId;

        this.errors && this.validateError();

        // TODO: 查询记录, 不存在则创建, 否则更新serviceId
        let record = yield this.dbContents.workSequelize.usedpkgrecords.findOne({
            attributes: ['id', 'userId', 'brandId', 'serviceId', 'packageId'],
            where: {
                userId,
                brandId,
                packageId,
                status: 0
            },
            order: "updateAt DESC"
        });
        if (record) {
            // 更新
            yield this.dbContents.workSequelize.usedpkgrecords.update({
                serviceId,
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
                packageId,
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
        let brandId = this.checkQuery('brandId').notEmpty().toInt().value;
        let serviceId = this.checkQuery('serviceId').value;
        let packageId = this.checkQuery('packageId').value;
        let recordNum = this.checkQuery('recordNum').value || 1;
        let userId = this.request.userId;
        this.errors && this.validateError();
        let resArr = [];
        if(!!packageId){
            // 传递的参数指定了packageId + serviceId, 直接查询并返回
            let detail = yield getPackageInfoById(packageId, userId);
            let service = yield getServiceInfoById(serviceId, userId);
            detail.serviceId = serviceId;
            detail.serviceName = service.gGroupName;
            resArr.push(detail);
            return this.success(resArr);
        }
        // TODO: 查询资源包详情, 根据brandId + userId查询使用记录(packageId + serviceId)列表, updateAt倒序
        let record = yield this.dbContents.workSequelize.usedpkgrecords.findOne({
            attributes: ['id', 'userId', 'brandId', 'serviceId', 'packageId'],
            where: {
                userId,
                brandId,
                status: 0
            },
            order: "updateAt DESC"
        });
        if(record){
            let packageId = record.packageId;
            let serviceId = record.serviceId;
            // 检查服务的有效性
            let data = yield getServiceInfoById(serviceId, userId);
            if(data && data.gGroupState == 2){
                // service.gGroupState == 2 上架
                // 查询资源包详情
                let detail = yield getPackageInfoById(packageId, userId);
                let service = data;
                detail.serviceId = serviceId;
                detail.serviceName = service.gGroupName;
                resArr.push(detail);
                return this.success(resArr);
            }
        }
        return this.error('资源无效');
    },

    /**
     * 查询最近使用过的[服务+资源]列表
     * 
     * @returns 
     */
    getLatestServieRecords: function* (){
        let brandId = this.checkQuery('brandId').notEmpty().toInt().value;
        let recordNum = this.checkQuery('recordNum').toInt().value || 4;
        let userId = this.request.userId;
        let records = yield this.dbContents.workSequelize.usedpkgrecords.findAll({
            attributes: ['userId', 'brandId', 'serviceId', 'packageId'],
            where: {
                userId,
                brandId,
                status: 0
            },
            limit: recordNum,
            order: "updateAt DESC"
        });
        if(records && records.length > 0){
            return this.success(records);
        }
        return this.error('没有有效使用记录');
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