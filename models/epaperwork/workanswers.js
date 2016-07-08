/**
 * Created by Administrator on 2016/7/7 0007.
 */
"use strict"

var Sequelize = require('sequelize');

module.exports = function (workSequelize) {
    return workSequelize.define(
        'eworkanswers',
        {
            doWorkId: {
                type: Sequelize.BIGINT,
                primaryKey: true
            },
            submitContent: {
                type: Sequelize.STRING,
                allowNull: false,
            },
            correctContent: {
                type: Sequelize.STRING,
                defaultValue: ''
            },
            correctDate: {
                type: Sequelize.DATE,
                defaultValue: Sequelize.NOW
            }
        },
        {
            timestamps: false,
            freezeTableName: true,
            tableName: "eworkanswers",
            classMethods: {
                associate: function (models) { // 1:1
                    this.belongsTo(models.doEworks, {foreignKey: 'doWorkId'});
                }
            }
        }
    );
}