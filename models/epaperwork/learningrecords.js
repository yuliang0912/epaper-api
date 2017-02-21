"use strict";

var Sequelize = require('sequelize');

module.exports = function(workSequelize) {
    return workSequelize.define(
        'videorecords', {
            id: {
                type: Sequelize.BIGINT,
                primaryKey: true,
                autoIncrement: true
            },
            brandId: {
                type: Sequelize.INTEGER
            },
            userId: {
                type: Sequelize.INTEGER
            },
            paperId: {
                type: Sequelize.BIGINT
            },
            paperVersion: {
                type: Sequelize.BIGINT
            },
            quesId: {
                type: Sequelize.BIGINT,
            },
            quesVersion: {
                type: Sequelize.BIGINT,
            },
            createdAt: {
                type: Sequelize.DATE,
            }
        }, {
            timestamps: false,
            freezeTableName: true,
            tableName: "learning_records"
        }
    );
};