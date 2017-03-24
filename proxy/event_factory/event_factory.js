/**
 * Created by Yuliang on 2016/7/14 0014.
 */

"use strict"

var eventEmitter = require('events').EventEmitter;
var configs = require('../../configs/event_factory.json')

configs.forEach(item=> {
    let handlers = require(item.requireFilePath)
    let eventInstall = module.exports[item.name] = new eventEmitter();

    eventInstall.handlerFunc = {}
    eventInstall.eventNameArray = []
    eventInstall.setMaxListeners(item.events.length);

    item.events.forEach(event=> {
        eventInstall.eventNameArray.push(event.name)
        event.eventHandler.forEach(handlerName=> {
            let handler = handlers[handlerName]
            if (typeof handler === 'function') {
                eventInstall.on(event.name, handler)
                //对外暴露原始方法,方便给需要做回调的情景下使用
                eventInstall.handlerFunc[handlerName] = handler
            } else {
                console.log("事件模块%s下,未找到事件%s,监听失败", item.name, handlerName)
            }
        })
    })
})

process.setMaxListeners(200)