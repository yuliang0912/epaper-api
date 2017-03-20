/**
 * Created by yuliang on 2016/12/4.
 */

"use strict"

const kenx = require('knex')
var shutdown = require('./shutdown')

const dbConfig =
    process.env.NODE_ENV === 'production'
        ? require('../configs/dbconfig_pro.json')
        : process.env.NODE_ENV === 'test'
        ? require('../configs/dbconfig_test.json')
        : require('../configs/dbconfig.json')

var epaperWork = kenx({
    client: 'mysql',
    connection: {
        host: dbConfig.epaperWork.config.host,
        user: dbConfig.epaperWork.username,
        password: dbConfig.epaperWork.password,
        database: dbConfig.epaperWork.database,
        charset: 'utf8',
        reconnect: true
    },
    pool: {
        min: dbConfig.epaperWork.config.pool.minConnections,
        max: dbConfig.epaperWork.config.pool.maxConnections,
    },
    acquireConnectionTimeout: dbConfig.epaperWork.config.pool.maxIdleTime,
    debug: true // process.env.NODE_ENV !== 'production'
})

module.exports = {
    epaperWork: epaperWork
}

epaperWork.on('query-error', function (error, obj) {
    console.log("===========knex:epaperWork error begin===============")
    console.log(error.toString())
    console.log(JSON.stringify(obj))
    console.log("===========end=============== \n")
})

shutdown.register(function () {
    epaperWork.destroy()
})
