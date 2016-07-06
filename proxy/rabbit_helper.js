/**
 * Created by Administrator on 2016/6/29 0029.
 */
"use strict"

var amqp = require('amqp');
var exchangeFactory = {};

module.exports = function (options) {
    var config = options || {};
    var conn = amqp.createConnection(config.connOptions);
    conn.on('ready', function () {
        var exchange = conn.exchange(config.exchangeName, {
            type: 'direct',
            autoDelete: false,
            confirm: true
        });
        conn.queue(config.queueName, {durable: true, autoDelete: false}, function (queue) {
            queue.bind(exchange, '', function () {
                exchangeFactory['exchange.msg'] = exchange;
            });
            /*
             queue.subscribe(function (message, header, deliveryInfo) {
             console.log("消费消息");
             if (message.data) {
             console.log(message.data.toString());
             }
             });
             */
        });
        console.log('rabbitMQ connection success!');
    });
    conn.on('error', function (err) {
        console.log("rabbitMQ connection faild," + err.toString());
    });
}

//发送消息到MQ
module.exports.publishMsg = function (dataStr) {
    return new Promise(function (resolve, reject) {
        var exchange = exchangeFactory["exchange.msg"];
        if (!exchange || exchange.binds == 0) {
            return resolve(false);
        }
        exchange.publish('', dataStr, {}, function (ret, err) {
            err ? reject(err) : resolve(!ret)
        });
    });
}