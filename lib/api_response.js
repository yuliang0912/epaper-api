/**
 * Created by yuliang on 2016/6/10.
 */

"use strict"
var _ = require('underscore');
var apiCode = require('./api_code_enum');

function buildReturnObject(ret, errCode, msg, data) {
    var result = {ret: apiCode.retCodeEnum.success, errcode: apiCode.errCodeEnum.success, msg: "success"};
    if (_.isNumber(ret)) {
        result.ret = ret;
    }
    if (_.isNumber(errCode)) {
        result.errcode = parseInt(errCode);
    }
    result.msg = (msg || "success").toString();

    if (!Object.is(data, undefined)) {
        result.data = data;
    }
    return result;
}

function getIPAdress() {
    var interfaces = require('os').networkInterfaces();
    for (var devName in interfaces) {
        var iface = interfaces[devName];
        for (var i = 0; i < iface.length; i++) {
            var alias = iface[i];
            if (alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal) {
                return alias.address;
            }
        }
    }
}

//定义apiResponse的输出响应结果
module.exports = (options)=> {
    var self = this;
    self._options = options || {};

    return function *(next) {
        this.success = (data) => {
            this.body = buildReturnObject(apiCode.retCodeEnum.success, apiCode.errCodeEnum.success, 'success', data);
        };
        this.error = this.apiError = (msg, errCode = apiCode.errCodeEnum.apiError) => {
            throw Object.assign(new Error(msg || '接口口内部异常'),
                {errCode: _.isNumber(errCode) ? errCode : apiCode.errCodeEnum.apiError});
        };
        this.validateError = function () {
            var msg = "参数校验失败,details:" + JSON.stringify(this.errors);
            throw Object.assign(new Error(msg),
                {errCode: apiCode.errCodeEnum.paramTypeError});
        };
        this.allow = (passMethod = 'GET')=> {
            var validateResult = false;
            if (_.isString(passMethod)) {
                passMethod = passMethod.toUpperCase();
                validateResult = passMethod === 'ALL' || this.method === passMethod;
            }
            else if (Array.isArray(passMethod)) {
                validateResult = passMethod.some(item => item.toUpperCase() === this.method);
            }
            if (!validateResult) {
                throw Object.assign(new Error("接口不支持" + this.method + "请求"),
                    {errCode: apiCode.errCodeEnum.refusedRequest});
            }
            return this;
        };
        this.allowJson = (()=> {
            if (!this.is("json")) {
                this.error('content-type错误,必须是application/json');
            }
            return this;
        });
        try {
            this.set("X-Response-For", getIPAdress());
            yield next;
            if (this.response.status === 404 && this.body === undefined) {
                this.body = buildReturnObject(apiCode.retCodeEnum.success,
                    apiCode.errCodeEnum.notReturnData, 'success', null);
            }
        } catch (e) {
            if (e == undefined) {
                e = new Error("未定义的错误")
            }
            this.body = buildReturnObject(e.retCode || apiCode.retCodeEnum.serverError,
                e.errCode || apiCode.errCodeEnum.autoSnapError, e.toString());
        }
    }
}





