"use strict";
var path = require('path')

var env = process.env.NODE_ENV || 'development';
var port = process.env.PORT || 8895;
var host = 'http://localhost' + (port != 80 ? ':' + port : '');

var DEBUG = env !== 'production'

module.exports = {
    //http://koajs.com/#application
    name: "epaper-api",
    keys: ['47b6a58e4d127b89373cf32dcbb0fdb22b0c42cf'],
    env: env,
    port: port,
    //https://github.com/koajs/static#options
    static: {
        directory: path.resolve(__dirname, '../web')
    },
    //https://github.com/koajs/body-parser#options
    bodyparser: {},
    //https://github.com/koajs/generic-session#options
    //https://github.com/rkusa/koa-passport
    auth: {},
    //https://github.com/koajs/ejs
    view: {
        root: path.resolve(__dirname, '../web'),
        cache: DEBUG ? false : 'memory',
    }
}

if (env === "production") {
    module.exports.msgRabbitMq = {
        connOptions: {
            host: '101.200.87.163',
            port: 5672,
            login: "cwmq_admin",
            password: "L0v3@4dmin_cwmq",
            authMechanism: 'AMQPLAIN'
        },
        implOptions: {
            defaultExchangeName: 'exchange.msg',
            reconnect: true,
            reconnectBackoffTime: 10000  //10秒尝试连接一次
        },
        queueName: 'msgQueue',
        exchangeName: 'exchange.msg'
    }
} else {
    module.exports.msgRabbitMq = {
        connOptions: {
            host: '121.14.117.241',
            port: 5670,
            login: "cwmq_admin",
            password: "L0v3@4dmin_cwmq",
            authMechanism: 'AMQPLAIN',
            vhost: "msg001"
        },
        implOptions: {
            defaultExchangeName: 'exchange.msg',
            reconnect: true,
            reconnectBackoffTime: 10000  //10秒尝试连接一次
        },
        queueName: 'msgQueue',
        exchangeName: 'exchange.msg'
    }
}