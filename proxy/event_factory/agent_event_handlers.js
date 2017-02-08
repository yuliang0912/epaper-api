/**
 * Created by yuliang on 2016/10/18.
 */

"use strict"

var Promise = require('bluebird')
var apiUtils = require('../../lib/api_utils')
var sendMsgHelper = require('../message/send_msg_helper')
var msgEnum = require('../message/message_enum')

//代理给个人推送消息
module.exports.pushMessageHandler = function (msgInfo) {
    return new Promise(function (resolve, reject) {
        let messageModel = {
            title: "运营商消息",
            msgType: msgEnum.msgTypeEnum.operatorMsg,
            brandId: msgInfo.brandId,
            senderId: msgInfo.brandId,
            senderName: msgInfo.brandName,
            receiverType: msgEnum.receiverTypeEnum.toIndividual
        }

        messageModel.msgIntr =
            msgInfo.messageContent.content === null || msgInfo.messageContent.content === undefined || msgInfo.messageContent === ""
                ? msgInfo.messageContent.imgUrl
                : msgInfo.messageContent.content.curString(50);

        let messageContent = {
            content: msgInfo.messageContent,
            attach: msgInfo.attach || '',
        }

        return sendMsgHelper.sendMsg(messageModel, messageContent, msgInfo.receiverIdList).then(resolve).catch(reject)
    })
}

