/**
 * Created by Administrator on 2016/6/15 0015.
 */
"use strict"

var _ = require('underscore');
var moment = require('moment');
var format = require('string-format');
var Sequelize = require('sequelize');
var eventFactory = require('./../../proxy/event_factory/event_factory')
var sendMsgHelper = require('../../proxy/message/send_msg_helper');

//目前后台只能针对用户ID进行推送.前期只实现这一部分功能,后期考虑针对角色进行推送
module.exports = {
    noAuths: [],
    test: function *() {
        this.success(this.request.headers);
    },
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
        yield sendMsgHelper.sendMsg(messageModel, messageContent, receiverIdList).then(this.success).catch(this.error)
    },
    //代理商消息模块
    agentEventTriggler: function *() {
        this.allow('POST').allowJson();
        var eventName = this.checkBody('eventName').notEmpty().value;
        var eventArgs = this.checkBody('eventArgs').notEmpty().value;
        this.errors && this.validateError();

        if (!eventFactory.agentEvent) {
            this.error('代理商事件已从配置中取消或者更改', 101)
        }

        if (!eventFactory.agentEvent.eventNameArray.some(t=>t === eventName)) {
            this.error('未找到事件' + eventName, 102)
        }
        eventFactory.agentEvent.emit(eventName, eventArgs)
        this.success(1)
    },
    //分组获取未读消息数量
    getNoReadMsgCount: function *() {
        var brandId = this.checkQuery('brandId').toInt().value;
        this.errors && this.validateError();

        let sql = "SELECT senderId,COUNT(*) as msgCount,MAX(msgmain.msgId) as maxMsgId FROM msgreceiver \
                 INNER JOIN msgmain on msgreceiver.msgId = msgmain.msgId\
                 WHERE msgStatus = 0 AND receiverId = :receiverId AND msgmain.`status` <> 1\
                 AND brandId = :brandId  GROUP BY senderId";

        yield this.dbContents.messageSequelize.query(sql, {
            replacements: {
                brandId: brandId,
                receiverId: this.request.userId
            },
            type: Sequelize.QueryTypes.SELECT
        }).then(this.success);
    },
    //根据消息类型获取未读消息数量
    getNoReadMsgCountByType: function *() {
        var msgType = this.checkQuery('msgType').toInt().value;
        var brandId = this.checkQuery('brandId').toInt().value;
        this.errors && this.validateError();

        let sql = "SELECT COUNT(*) as msgCount FROM msgreceiver\
                INNER JOIN msgmain on msgreceiver.msgId = msgmain.msgId\
                WHERE msgStatus = 0 AND receiverId = :receiverId AND msgmain.`status` <> 1\
                AND brandId = :brandId AND msgmain.msgType = :msgType";

        yield this.dbContents.messageSequelize.query(sql, {
            replacements: {
                brandId: brandId,
                msgType: msgType,
                receiverId: this.request.userId
            },
            type: Sequelize.QueryTypes.SELECT
        }).then(data=> {
            if (Array.isArray(data) && data.length > 0) {
                this.success(data[0].msgCount)
            } else {
                this.success(0)
            }
        });
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
                    WHERE receiverId = :receiverId AND msgmain.`status` <> 1\
                    AND brandId = :brandId ORDER BY msgmain.msgId DESC\
                ) temp GROUP BY senderId";

        //修改支持广播类型(2017-4-13恢复以前)
        // let sql = `SELECT * FROM (SELECT * FROM (
        //               SELECT msgmain.*,msgreceiver.msgStatus FROM msgmain
        //               INNER JOIN msgreceiver on msgreceiver.msgId = msgmain.msgId AND msgmain.receiverType = 1
        //               WHERE receiverId = :receiverId AND msgmain.status <> 1 AND brandId = :brandId
        //               UNION ALL
        //               SELECT msgmain.*,1 FROM msgmain
        //               WHERE receiverType = 2 AND msgmain.status <> 1 AND brandId = :brandId
        //           ) Temp ORDER BY msgId DESC) Temp1 GROUP BY senderId`;

        var msgList = yield this.dbContents.messageSequelize.query(sql, {
            replacements: sqlParams,
            type: Sequelize.QueryTypes.SELECT
        });

        if (msgList.length === 0) {
            return this.success([]);
        }

        sql = "SELECT senderId,COUNT(*) as msgCount FROM msgreceiver\
             INNER JOIN msgmain on msgreceiver.msgId = msgmain.msgId\
             WHERE msgStatus = 0 AND receiverId = :receiverId AND msgmain.`status` <> 1\
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
        var page = this.checkQuery('page').toInt().value;
        var pageSize = this.checkQuery('pageSize').toInt().value;
        var brandId = this.checkQuery('brandId').toInt().value;
        var senderId = this.checkQuery('senderId').toInt().value;
        this.errors && this.validateError();

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
                        AND msgmain.senderId = :senderId AND msgmain.status <> 1\
                        AND brandId = :brandId ORDER BY msgmain.MsgId DESC";

        //2017-4-13恢复以前
        // let baseSql = `SELECT {0} FROM (
        //                  SELECT msgmain.*,msgreceiver.msgStatus,msgcontent.content FROM msgreceiver
        //                  INNER JOIN msgmain ON msgmain.msgId = msgreceiver.msgId
        //                  INNER JOIN msgcontent ON msgcontent.msgId = msgreceiver.msgId
        //                  WHERE msgreceiver.receiverId = :receiverId
        //                  AND msgmain.senderId = :senderId AND msgmain.status <> 1 AND brandId = :brandId
        //                  UNION ALL
        //                  SELECT msgmain.*,1,msgcontent.content FROM msgmain
        //                  INNER JOIN msgcontent ON msgcontent.msgId = msgmain.msgId
        //                  WHERE receiverType = 2 AND msgmain.status <> 1 AND brandId = :brandId AND senderId = :senderId
        //                ) as t ORDER BY msgId DESC`;

        let sqlPage = format(baseSql, " count(*)  AS msgCount ");

        var Sequelize = this.dbContents.Sequelize;
        var msgTotalCount = yield this.dbContents.messageSequelize.query(sqlPage, {
            plain: true,
            replacements: sqlParams,
            type: Sequelize.QueryTypes.SELECT
        }).then(data=>data.msgCount);

        var msgList = [];
        if (msgTotalCount > sqlParams.beginIndex) {
            let sql = format(baseSql, "*");
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
        var page = this.checkQuery('page').toInt().value;
        var pageSize = this.checkQuery('pageSize').toInt().value;
        var brandId = this.checkQuery('brandId').toInt().value;
        var msgType = this.checkQuery('msgType').toInt().value;
        this.errors && this.validateError();

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
                        AND msgmain.msgType = :msgType AND msgmain.status <> 1\
                        AND msgmain.brandId = :brandId ORDER BY msgmain.MsgId DESC";

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
        var msgIds = this.checkQuery('msgIds').notEmpty().match(/^\d+(,\d+)*$/).value;
        this.errors && this.validateError();

        yield this.dbContents.messageSequelize.msgReceiver.update({msgStatus: 1}, {
            where: {
                receiverId: this.request.userId,
                msgId: {$in: msgIds.split(',').map(m=>parseInt(m))}
            }
        }).then(data=> {
            this.success(data[0] > 0);
        })
    },
    //设置消息为已读状态
    setReadByMsgType: function *() {
        var msgType = this.checkQuery('msgType').toInt().value;
        var brandId = this.checkQuery('brandId').toInt().value;
        this.errors && this.validateError();

        yield this.dbContents.messageSequelize.msgReceiver.update({msgStatus: 1}, {
            where: {
                receiverId: this.request.userId,
                brandId, msgType
            }
        }).then(data=> {
            this.success(data[0] > 0);
        })
    },
    delete: function *() {
        var msgId = this.checkQuery('msgId').toInt().value;
        this.errors && this.validateError();

        yield this.dbContents.messageSequelize.msgReceiver.destroy({
            where: {
                msgId: msgId,
                receiverId: this.request.userId,
            }
        }).then(data=> {
            this.success(data[0] > 0);
        })
    }
}
