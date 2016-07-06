/**
 * Created by Administrator on 2016/6/15 0015.
 */
"use strict"

var _ = require('underscore');
var moment = require('moment');
var format = require('string-format');
var Sequelize = require('sequelize');
var sendMsgHelper = require('../../proxy/send_msg_helper');

//目前后台只能针对用户ID进行推送.前期只实现这一部分功能,后期考虑针对角色进行推送
module.exports = {
    noAuths: [],
    //发送消息
    sendMsg: function *() {
        this.allow('POST').allowJson();
        var title = this.checkBody('title').notEmpty().value;
        var msgType = this.checkBody('msgType').toInt().value;
        var brandId = this.checkBody('brandId').toInt().value;
        var senderId = this.checkBody('senderId').toInt().value;
        var senderName = this.checkBody('senderName').notEmpty().value;
        var content = this.checkBody('content').toJson().value;
        var msgIntr = this.checkBody('msgIntr').notEmpty().value;
        var attach = this.checkBody('attach').default('').value;
        var receiverIdList = this.checkBody('receiverIdList').notEmpty().value;
        if (!Array.isArray(receiverIdList) || receiverIdList.length < 1) {
            this.error('receiverIdList格式错误')
        }
        this.errors && this.validateError();

        var messageModel = {
            title, msgType, brandId, senderId, senderName, msgIntr
        };
        var messageContent = {
            content, attach
        };
        yield sendMsgHelper.sendMsg(messageModel, messageContent, receiverIdList).then(this.success);
    },
    //分组获取未读消息数量
    getNoReadMsgCount: function *() {
        var brandId = this.checkQuery('brandId').toInt().value;
        this.errors && this.validateError();

        let sql = "SELECT senderId,COUNT(*) as msgCount,MAX(msgmain.msgId) as maxMsgId FROM msgreceiver \
                 INNER JOIN msgmain on msgreceiver.msgId = msgmain.msgId\
                 WHERE msgStatus = 0 AND receiverId = :receiverId AND msgmain.`status` = 0\
                 AND brandId = :brandId  GROUP BY senderId";

        yield this.dbContents.messageSequelize.query(sql, {
            replacements: {
                brandId: brandId,
                receiverId: this.request.userId
            },
            type: Sequelize.QueryTypes.SELECT
        }).then(this.success);
    },
    //分组获取消息列表以及该分组未读消息数量
    getMsgList: function *() {
        var brandId = this.checkQuery('brandId').toInt().value;
        this.errors && this.validateError();

        var sqlParams = {
            brandId: brandId,
            receiverId: this.request.userId
        };
        let sql = "SELECT * FROM(\
                    SELECT msgmain.*,msgreceiver.msgStatus FROM msgmain\
                    LEFT JOIN msgreceiver on msgreceiver.msgId = msgmain.msgId\
                    WHERE receiverId = :receiverId AND msgmain.`status` = 0\
                    AND brandId = :brandId ORDER BY msgmain.msgId DESC\
                ) temp GROUP BY senderId ORDER BY msgId DESC";

        var msgList = yield this.dbContents.messageSequelize.query(sql, {
            replacements: sqlParams,
            type: Sequelize.QueryTypes.SELECT
        });

        if (msgList.length === 0) {
            return this.success([]);
        }

        sql = "SELECT senderId,COUNT(*) as msgCount FROM msgreceiver\
             INNER JOIN msgmain on msgreceiver.msgId = msgmain.msgId\
             WHERE msgStatus = 0 AND receiverId = :receiverId AND msgmain.`status` = 0\
             AND brandId = :brandId GROUP BY senderId";

        var noReadList = yield this.dbContents.messageSequelize.query(sql, {
            replacements: sqlParams,
            type: Sequelize.QueryTypes.SELECT
        });

        msgList.forEach(function (item) {
            var model = _.find(noReadList, function (m) {
                    return m.senderId === item.senderId
                }) || {};
            item.noReadCount = model.msgCount || 0;
            item.publishDate = item.publishDate.valueOf() / 1000;
        });

        this.success(msgList);
    },
    //根据发送者ID获取消息列表
    getMsgsBySenderId: function *() {
        var page = this.getQueryString("page", parseInt);
        var pageSize = this.getQueryString("pageSize", parseInt);
        var brandId = this.getQueryString("brandId", parseInt);
        var senderId = this.getQueryString("senderId", parseInt);

        var sqlParams = {
            brandId: brandId,
            senderId: senderId,
            receiverId: this.request.userId,
            beginIndex: (page - 1) * pageSize,
            end: page * pageSize
        };

        let baseSql = "SELECT {0} FROM msgreceiver\
                        INNER JOIN msgmain ON msgmain.msgId = msgreceiver.msgId\
                        INNER JOIN msgcontent ON msgcontent.msgId = msgreceiver.msgId\
                        WHERE msgreceiver.receiverId = :receiverId\
                        AND msgmain.senderId = :senderId AND msgmain.status = 0\
                        AND brandId = :brandId";

        let sqlPage = format(baseSql, " count(*)  AS msgCount ");

        var Sequelize = this.dbContents.Sequelize;
        var msgTotalCount = yield this.dbContents.messageSequelize.query(sqlPage, {
            plain: true,
            replacements: sqlParams,
            type: Sequelize.QueryTypes.SELECT
        }).then(data=>data.msgCount);

        var msgList = [];
        if (msgTotalCount > sqlParams.beginIndex) {
            let sql = format(baseSql, "msgmain.*,msgreceiver.msgStatus,msgcontent.content");
            sql += " LIMIT :beginIndex,:end";

            msgList = yield this.dbContents.messageSequelize.query(sql, {
                replacements: sqlParams,
                type: Sequelize.QueryTypes.SELECT
            }).then(data=> {
                data.forEach(t=> {
                    t.content = JSON.parse(t.content);
                    t.publishDate = t.publishDate.valueOf() / 1000;
                });
                return data;
            });
        }

        this.success({
            page: page,
            pageSize: pageSize,
            totalCount: msgTotalCount,
            pageCount: Math.ceil(msgTotalCount / pageSize),
            pageList: msgList
        });
    },
    //根据消息类型ID获取消息列表
    getMsgsByType: function *() {
        var page = this.getQueryString("page", parseInt);
        var pageSize = this.getQueryString("pageSize", parseInt);
        var msgType = this.getQueryString("msgType", parseInt);
        var brandId = this.getQueryString("brandId", parseInt);

        var sqlParams = {
            brandId: brandId,
            msgType: msgType,
            receiverId: this.request.userId,
            beginIndex: (page - 1) * pageSize,
            end: pageSize
        };

        let baseSql = "SELECT {0} FROM msgreceiver\
                        INNER JOIN msgmain ON msgmain.msgId = msgreceiver.msgId\
                        INNER JOIN msgcontent ON msgcontent.msgId = msgreceiver.msgId\
                        WHERE msgreceiver.receiverId = :receiverId\
                        AND msgmain.msgType = :msgType AND msgmain.status = 0\
                        AND msgmain.brandId = :brandId";

        let sqlPage = format(baseSql, "count(*) AS msgCount ");

        var Sequelize = this.dbContents.Sequelize;
        var msgTotalCount = yield this.dbContents.messageSequelize.query(sqlPage, {
            plain: true,
            replacements: sqlParams,
            type: Sequelize.QueryTypes.SELECT
        }).then(data=>data.msgCount);

        var msgList = [];
        if (msgTotalCount > (page - 1) * pageSize) {
            let sql = format(baseSql, "msgmain.*,msgreceiver.msgStatus,msgcontent.content");
            sql += " LIMIT :beginIndex,:end";

            msgList = yield this.dbContents.messageSequelize.query(sql, {
                replacements: sqlParams,
                type: Sequelize.QueryTypes.SELECT
            }).then(data=> {
                data.forEach(t=> {
                    t.content = JSON.parse(t.content);
                    t.publishDate = t.publishDate.valueOf() / 1000;
                });
                return data;
            });
        }
        this.success({
            page: page,
            pageSize: pageSize,
            totalCount: msgTotalCount,
            pageCount: Math.ceil(msgTotalCount / pageSize),
            pageList: msgList
        });
    },
    //设置消息为已读状态
    setRead: function *() {
        var msgIds = this.getQueryString("msgIds", "");

        if (!/^\d{1,}$/.test(msgIds.replace(/\,/g, ""))) {
            return this.error("参数msgIds格式错误", 101);
        }

        var msgList = msgIds.split(',').map(item=>parseInt(item));

        yield this.dbContents.messageSequelize.msgReceiver.update({msgStatus: 1}, {
            where: {
                receiverId: this.request.userId,
                msgId: {$in: msgList}
            }
        }).then(data=> {
            this.success(data[0] > 0);
        });
    },
}
