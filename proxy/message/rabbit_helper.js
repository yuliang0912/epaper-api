/**
 * Created by Yuliang on 2016/6/29 0029.
 */

"use strict"

var amqp = require('amqp');
var config = {};

module.exports = function (options) {
    config = options || {};
}

module.exports.publishMsg = function (dataStr) {
    return new Promise(function (resolve, reject) {
        if (dataStr === null || dataStr === undefined || dataStr === "0") {
            return resolve(false);
        }
        var connection = amqp.createConnection(config.connOptions);
        connection.on('ready', function () {
            var exchange = connection.exchange(config.exchangeName, {type: 'direct', autoDelete: false, confirm: true});
            connection.queue(config.queueName, {durable: true, autoDelete: false}, function (queue) {
                queue.bind(exchange, '', function () {
                    exchange.publish('', dataStr, {}, function (ret, err) {
                        err ? reject(err) : resolve(!ret)
                        connection.end();
                    });
                });
                // queue.subscribe(function (message, header, deliveryInfo) {
                //     console.log("消费消息");
                //     if (message.data) {
                //         console.log(message.data.toString());
                //     }
                // });
            });
        });
        connection.on('error', function (err) {
            reject(err)
            connection.end();
            console.log("rabbitMQ connection faild," + err.toString());
        });
    });
}
