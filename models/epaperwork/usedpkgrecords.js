"use strict";

var Sequelize = require('sequelize');

module.exports = function(workSequelize) {
    return workSequelize.define(
        'usedpkgrecords', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },            
            userId: {
                type: Sequelize.INTEGER,
                primaryKey: true,
            },
            brandId: {
                type: Sequelize.INTEGER
            },            
            serviceId: {
                type: Sequelize.INTEGER
            },
            latestPackageId: {
                type: Sequelize.INTEGER
            },
            createAt: {
                type: Sequelize.DATE,
            },
            updateAt: {
                type: Sequelize.DATE,
            },
            status: {
                type: Sequelize.INTEGER,
            }
        }, {
            timestamps: false,
            freezeTableName: true,
            tableName: "package_used_records"
        }
    );
};