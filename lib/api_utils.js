/**
 * Created by Administrator on 2016/7/8 0008.
 */

var uuid = require('node-uuid');

var utils = module.exports = {};

utils.createInt16Number = function () {
    return Math.floor(Math.random() * 10000000000000000);
}

utils.getUuid = function () {
    return uuid.v1();
}