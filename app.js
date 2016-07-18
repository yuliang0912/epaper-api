"use strict";

var app = require('koa')()
var config = require('./configs/main')

app.name = config.name
app.keys = config.keys
app.env = config.env
app.proxy = true;

if (config.env === 'development') {
    var debug = require('debug')('epaper-api');
}

//中间键加载顺序不允许调整
app.use(require('koa-favicon')(__dirname + '/web/favicon.ico'))
app.use(require('koa-static')(config.static.directory, config.static))
app.use(require('koa-compress')())
app.use(require('./lib/api_response')())
app.use(require('koa-bodyparser')(config.bodyparser))
app.use(require('./lib/api_auto_route')(app))
require('koa-validate')(app)
require('./proxy/message/rabbit_helper')(config.msgRabbitMq)
require('./task_schedule/work_effective_task').start();

app.on('error', function (err) {
    log.error('server error', err);
});

require('./configs/database')().then(dbContents=> {
    app.context.dbContents = dbContents;
    console.log("database initialized");
}).catch(err=> {
    console.log(err);
    console.log("database initialize faild");
});

if (!module.parent) {
    app.listen(config.port || 3000, function () {
        console.log('Server running on port ' + config.port || 3000)
    })
} else {
    module.exports = app
}