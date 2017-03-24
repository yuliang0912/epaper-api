/**
 * Created by Yuliang on 2016/6/29 0029.
 */

"use strict"


var amqp = require('amqp');
var exchange, isReady = false;
var config = require('../../configs/main').msgRabbitMq
var conn = amqp.createConnection(config.connOptions, config.implOptions);
var shutdown = require('../../lib/shutdown')

conn.on('close', function () {
    isReady = false
    console.log("rabbitMQ has closed...")
})

conn.on('ready', function () {
    exchange = conn.exchange(config.exchangeName, {
        type: 'direct',
        autoDelete: false,
        confirm: true
    })
    exchange.on("open", function () {
        isReady = true
    })
    conn.queue(config.queueName, {durable: true, autoDelete: false}, function (queue) {
        queue.bind(exchange, config.queueName, function () {
        });
        // queue.subscribe(function (message, header, deliveryInfo) {
        //     if (message.data) {
        //         console.log(message.data.toString());
        //     }
        // });
    });
    console.log('rabbitMQ connection success!');
});

conn.on('error', function (err) {
    isReady = false
    console.log("rabbitMQ error," + err.toString());
})

conn.on('disconnect', function () {
    console.log("rabbitMQ disconnect");
})

//发送消息到MQ
module.exports.publishMsg = function (dataStr) {
    return new Promise(function (resolve, reject) {
        if (!isReady || !exchange || exchange.binds == 0) {
            console.log("rabbitMQ is not open");
            return resolve(false);
        }
        exchange.publish('', dataStr, {}, function (ret, err) {
            err ? reject(err) : resolve(!ret)
        });
    });
}

//程序关闭时,自动关闭连接
shutdown.register(function () {
    conn.setImplOptions({reconnect: false})
    conn.disconnect()
    conn.end()
    conn.destroy()
})
