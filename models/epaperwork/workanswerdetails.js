/**
 * Created by yuliang on 2017-05-12.
 */


"use strict"

var Sequelize = require('sequelize');

module.exports = function (workSequelize) {
    return workSequelize.define(
        'eworkanswerdetails',
        {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            doWorkId: {
                type: Sequelize.STRING,
            },
            workId: {
                type: Sequelize.STRING,
            },
            contentId: {
                type: Sequelize.INTEGER,
            },
            versionId: {
                type: Sequelize.STRING,
            },
            assess: {
                type: Sequelize.INTEGER,
            },
            score: {
                type: Sequelize.INTEGER,
            },
            answerContent: {
                type: Sequelize.JSON,
                defaultValue: []
            }
        },
        {
            timestamps: false,
            freezeTableName: true,
            tableName: "eworkanswerdetails",
            classMethods: {
                associate: function (models) { // N:1
                    this.belongsTo(models.doEworks, {foreignKey: 'doWorkId'});
                }
            }
        }
    );
}
