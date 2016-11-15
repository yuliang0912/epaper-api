/**
 * Created by Yuliang on 2016/7/16 0016.
 * 消息类型枚举
 */

"use strict"

const msgTypeEnum = {
    //老师布置作业通知消息
    "workNotice": 10,
    //即将过期作业提醒
    "workRemind": 11,
    //老师点评作业
    "workComment": 12,
    //老师删除作业(取消已布置的作业)
    "workDelete": 13,
    //老师批改作业
    "workCorrect": 14,
    //老师检查作业
    "workCheck": 15,
    //运营商消息(站内信)
    "operatorMsg": 30
}

const receiverTypeEnum = {
    //面对个人的消息(已人为单位)
    "toIndividual": 1,
    //面对角色的消息
    "toRole": 2,
    //面对品牌的消息
    "toBrand": 3
}

module.exports = {
    msgTypeEnum, receiverTypeEnum
}
