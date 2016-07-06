/**
 * Created by yuliang on 2016/6/11.
 */

"use strict"
const retCodeEnum = Object.freeze({
    //常结果
    "success": 0,
    //程序内部错误
    "serverError": 1,
    //未授权的请求
    "authenticationFailure": 2
});

const errCodeEnum = Object.freeze({
    //正常结果
    "success": 0,
    //自动捕捉的错误
    "autoSnapError": 1,
    //接口拒绝请求的错误,一般指method不正确或者未授权
    "refusedRequest": 2,
    //未找到指定的控制器
    "notFoundController": 11,
    //未找到指定的接口版本
    "notFoundApiVersion": 12,
    //未找到指定的接口,即action不存在
    "notFoundApiAction": 13,
    //接口未返回数据
    "notReturnData": 14,
    //参数类型错误
    "paramTypeError": 15,
    //API主动抛出的错误,接口内部错误范围100-200
    "apiError": 100
});

module.exports = {
    retCodeEnum, errCodeEnum
};