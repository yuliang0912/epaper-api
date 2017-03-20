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

String.prototype.curString = function (length, additional = '', startIndex = 0) {
    return this.length > length
        ? this.substr(startIndex, length) + additional
        : this.substr(startIndex, length)
}

Array.prototype.groupBy = function (key) {
    var batchGroup = {};
    this.forEach(item=> {
        if (!batchGroup[item[key]]) {
            batchGroup[item[key]] = [];
        }
        batchGroup[item[key]].push(item);
    })
    return Object.keys(batchGroup).map(item=> {
        return {key: item, value: batchGroup[item]}
    });
}

Array.prototype.binarySearch = function (value) {
    var startIndex = 0,
        stopIndex = items.length - 1,
        middle = Math.floor((stopIndex + startIndex) / 2);
    var items = this;
    while (items[middle] != value && startIndex < stopIndex) {
        if (value < items[middle]) {
            stopIndex = middle - 1;
        } else if (value > items[middle]) {
            startIndex = middle + 1;
        }
        middle = Math.floor((stopIndex + startIndex) / 2);
    }
    return (items[middle] != value) ? -1 : middle;
}


Date.prototype.toUnix = function () {
    return this.valueOf() / 1000;
}