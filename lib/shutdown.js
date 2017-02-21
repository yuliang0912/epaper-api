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
    console.log("程序已关闭.")
    process.exit(0);
})

