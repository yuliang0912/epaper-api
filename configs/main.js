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
    },
    msgRabbitMq: {
        connOptions: {
            host: '121.14.117.241',
            port: 5670,
            login: "cwmq_admin",
            password: "L0v3@4dmin_cwmq",
            authMechanism: 'AMQPLAIN',
            vhost: "msg001"
        },
        queueName: 'msgQueue',
        exchangeName: 'exchange.msg'
    },
    // msgRabbitMq: {
    //     connOptions: {
    //         host: '101.200.87.163',
    //         port: 5672,
    //         login: "cwmq_admin",
    //         password: "L0v3@4dmin_cwmq",
    //         authMechanism: 'AMQPLAIN',
    //         connectionTimeout: 10000,
    //         noDelay: true,
    //         ssl: {
    //             enabled: false
    //         }
    //         //vhost: "msg001"
    //     },
    //     queueName: 'msgQueue',
    //     exchangeName: 'exchange.msg'
    // }
    //https://github.com/balderdashy/waterline
    //https://github.com/balderdashy/waterline-docs#supported-adapters
}