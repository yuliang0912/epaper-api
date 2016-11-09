/**
 * Created by yuliang on 2016/10/24.
 */

"use strict"

module.exports = {
    noAuths: ['getLogs'],
    addLog: function *() {
        this.allow('POST').allowJson();
        var brandId = this.checkBody('brandId').toInt().value;
        var appVersion = this.checkBody('appVersion').notEmpty().value;
        var phoneVersion = this.checkBody('phoneVersion').notEmpty().value;
        var osVersion = this.checkBody('osVersion').notEmpty().value;
        var netWorkType = this.checkBody('netWorkType').notEmpty().value;
        var errorType = this.checkBody('errorType').toInt().value;
        var logDesc = this.checkBody('logDesc').default('').value;
        var remark = this.checkBody('remark').default('').value;
        this.errors && this.validateError();

        var model = {
            userId: this.request.userId,
            brandId,
            logInfo: {
                appVersion, phoneVersion, osVersion, netWorkType, errorType, logDesc, remark,
                ip: this.request.ip
            }
        }
        yield this.dbContents.messageSequelize.userLogs.create(model).then(data=> {
            return data && data.id > 0 ? 1 : 0;
        }).then(this.success).catch(this.error)
    },
    getLogs: function *() {
        var brandId = this.checkQuery('brandId').default(-1).toInt().value;
        var userId = this.checkQuery('userId').notEmpty().toInt().value;
        this.errors && this.validateError();

        var condition = {userId}

        if (brandId > -1) {
            condition.brandId = brandId;
        }

        yield this.dbContents.messageSequelize.userLogs.findAll({where: condition, order: 'Id DESC', raw: true})
            .then(result=> {
                result.forEach(t=>t.logInfo = JSON.parse(t.logInfo))
                return result
            }).then(this.success).catch(this.error)
    }
}