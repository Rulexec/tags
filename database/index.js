var pg = require('pg').native,
    async = require('async'),
    crypto = require('crypto'),

    CONFIG = require('../config'),
    sql = require('./sql');

var pgConnectionString = CONFIG.POSTGRESQL;

module.exports = DB;

function DB() {
    var self = this;

    this.client = new pg.Client(pgConnectionString);

    this.start = function(callback) {
        async.series([
            async.apply(sql.start),
            async.apply(self.client.connect.bind(self.client)),
            async.apply(async.waterfall, [
                function(callback) {
                    self.client.query(sql.getQuery('is info_int exists'), callback);
                },
                function(result, callback) { callback(null, result.rows[0].isExists); },
                function(exists, callback) {
                    if (!exists) {
                        createDB(callback);
                    } else {
                        // check version/migrate
                        callback();
                    }
                }
            ])
        ], callback);
    }

    function createDB(callback) {
        self.client.query(sql.getQuery('create db'), callback);
    }

    ['tags', 'session', 'user'].forEach(add);

    function add(name) {
        var imported = require('./' + name);
        self[name] = {};

        for (var fnName in imported) if (imported.hasOwnProperty(fnName)) {
            self[name][fnName] = imported[fnName].bind(self);
        }
    }
}

DB.EXISTS = 1;
DB.NOT_EXISTS = 2;
