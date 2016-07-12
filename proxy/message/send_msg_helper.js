/**
 * Created by Administrator on 2016/7/1 0001.
 */
"use strict"

var msgHelper = require('./rabbit_helper');
var msgSequelize = require('../../configs/database').getDbContents().messageSequelize;

module.exports.sendMsg = function (messageModel, messageContent, receiverIdList) {
    return new Promise(function (resolve, reject) {
        msgSequelize.transaction(function (trans) {
            let msgId = 0;
            return msgSequelize.msgMain.create(messageModel, {
                transaction: trans
            }).then(msg=> {
                messageContent.msgId = msgId = msg.msgId
                messageContent.msgType = msg.msgType
                receiverIdList.forEach(m=>m.msgId = msgId)
                var contentFunc = msgSequelize.msgContent.create(messageContent, {transaction: trans})
                var receiverFunc = msgSequelize.msgReceiver.bulkCreate(receiverIdList, {transaction: trans})
                return Promise.all([contentFunc, receiverFunc])
            }).then(data=> {
                return msgId;
            });
        }).then(function (msgId) {
            resolve(msgId);
            //此处异步发送MQ,无需等待执行结果
            msgHelper.publishMsg(msgId.toString()).then(isSuccess=> {
                msgSequelize.msgMain.update({status: isSuccess ? 2 : 3}, {where: {msgId: msgId}});
            });
        }).catch(reject)
    });
}
