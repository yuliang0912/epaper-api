/**
 * Created by yuliang on 2017/2/17.
 */


"use strict"

var registerFunc = []

module.exports.register = function (shutdownFunc) {
    if (typeof shutdownFunc === "function") {
        registerFunc.push(shutdownFunc)
    }
}

process.on('SIGINT', function () {
    try {
        registerFunc.forEach(func=> {
            func()
        })
    } catch (e) {
        process.exit(1);
    }
    setTimeout(function () {
        console.log("程序准备关闭中.")
        process.exit(0);
    }, 290) //pm2默认是300,所以在未配置PM2的情况下,不超过300即可
})

process.on('exit', function () {
    console.log("程序已经关闭完成.")
});