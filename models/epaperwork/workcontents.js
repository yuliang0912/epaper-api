/**
 * Created by Administrator on 2016/6/28 0028.
 */

var Sequelize = require('sequelize');

module.exports = function (workSequelize) {
    return workSequelize.define(
        'eworkcontents',
        {
            contentId: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            batchId: {
                type: Sequelize.INTEGER,
                allowNull: false
            },
            workId: {
                type: Sequelize.BIGINT,
                primaryKey: true
            },
            packageId: {
                type: Sequelize.BIGINT,
                allowNull: false
            },
            cid: {
                type: Sequelize.STRING,
                allowNull: false
            },
            moduleId: {
                type: Sequelize.INTEGER,
                allowNull: false
            },
            resourceName: {
                type: Sequelize.STRING,
                allowNull: false
            },
            versionId: {
                type: Sequelize.STRING,
                allowNull: false
            },
            parentVersionId: {
                type: Sequelize.STRING,
                allowNull: false
            },
            resourceType: {
                type: Sequelize.STRING,
                allowNull: false
            },
            requirementContent: {
                type: Sequelize.STRING,
            },
            checkedResource: {
                type: Sequelize.STRING,
            },
            workScore: {
                type: Sequelize.DECIMAL(6, 2),
                defaultValue: 100
            },
        },
        {
            timestamps: false,
            freezeTableName: true,
            tableName: "eworkcontents",
            classMethods: {
                associate: function (models) { // N:1
                    this.belongsTo(models.eworks, {foreignKey: 'workId'});
                }
            }
        }
    );
}