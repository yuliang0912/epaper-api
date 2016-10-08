/**
 * Created by yuliang on 2016/6/10.
 * 自动注册路由的插件
 * 程序会自动读取controllers中的文件夹作为controller名称
 * 在系统第一次调用具体接口时,会加载对应版本的actions
 */

"use strict"

var fs = require('fs');
var path = require('path');
var _ = require('underscore');
var Router = require('koa-router');
var apiCode = require('./api_code_enum');

var CiwongApis = {};
var prototype = {ctrlNameList: [], ctrlList: {}};

/*获取接口实例对象*/
prototype.getApiInstall = (ctrlName, version)=> {
    if (!_.some(CiwongApis.ctrlNameList, (item)=> Object.is(item, ctrlName))) {
        /*未找到控制器*/
        throw Object.assign(new Error("未找到指定的接口"),
            {errCode: apiCode.errCodeEnum.notFoundController});
    }
    if (Object.is(CiwongApis.ctrlList[ctrlName][version], undefined)) {
        CiwongApis.ctrlList[ctrlName][version] = CiwongApis.ctrlList[ctrlName](version);
    }
    return CiwongApis.ctrlList[ctrlName][version];
};

Object.setPrototypeOf(CiwongApis, prototype);

fs.readdirSync(path.join(__dirname, '../controllers')).forEach((ctrlName)=> {
    ctrlName = ctrlName.toLowerCase();
    prototype.ctrlList[ctrlName] = requireController('../controllers/' + ctrlName);
    prototype.ctrlNameList.push(ctrlName);
});

function requireController(ctrlName) {
    return function (version = 'v1') {
        try {
            let model = {};
            model.actions = [];
            model.controller = require(path.join(__dirname, ctrlName, path.basename(version)));
            Object.keys(model.controller).forEach((item)=> {
                if (_.isFunction(model.controller[item])) {
                    if (item === item.toLowerCase()) {
                        model.actions.push(item);
                    } else {
                        model.controller[item.toLowerCase()] = model.controller[item];
                        model.actions.push(item.toLowerCase());
                        delete model.controller[item];
                    }
                }
            });
            return Object.freeze(model); // create new & freeze
        } catch (e) {
            console.log(e);
            /*未找到接口版本*/
            throw Object.assign(new Error("未找到" + version + "版本的接口"),
                {errCode: apiCode.errCodeEnum.notFoundApiVersion});
        }
    };
}

CiwongApis.getAction = function (ctrlName, version, action) {
    let install = CiwongApis.getApiInstall(ctrlName, version);

    if (!_.some(install.actions, (item)=> Object.is(item, action))) {
        throw Object.assign(new Error("未找到指定的接口"),
            {errCode: apiCode.errCodeEnum.notFoundApiAction});
    }

    let isNeedAuthorization = !(Array.isArray(install.controller.noAuths) ? install.controller.noAuths : [])
        .some(item=>Object.is(item.toLowerCase(), action));
    install.controller[action].isNeedAuthorization = isNeedAuthorization;

    return install.controller[action];
};

CiwongApis.middleware = function *() {
    var scheme = this.path.toLowerCase().split('/').filter(item=> item.trim().length > 0);

    if (scheme.length <= 1) {
        yield this.redirect('/index.html');
    }
    if (scheme.length == 2) {
        scheme.splice(1, 0, "v1");
    }

    let apiFuncs = CiwongApis.getAction(scheme[0], scheme[1], scheme[2]);

    if (apiFuncs.isNeedAuthorization) {
        yield require('./api_basice_auth');
    }

    yield apiFuncs;
};

module.exports = function (app) {
    let router = new Router();

    /*所有请求均路由到CiwongApi中间件上来处理*/
    router.all('/*', CiwongApis.middleware);

    return router.middleware();
}