var crypto = require('crypto'),
    sql = require('./sql'),
    ERROR = require('../util').error;

exports.update = function(sessionId, key, value, callback) {
    var self = this;

    if (key !== 'user') {
        callback('not supported');
        return;
    }

    crypto.randomBytes(16, function(error, buf) {
        if (error) return callback(error);

        var session = buf.toString('hex');
        onSessionGenerated(session);
    });

    function onSessionGenerated(session) {
        // FIXME collisions

        self.client.query(sql.getQuery('save session'), [session, value], function(error) {
            if (error) return callback(error);

            callback(null, session);
        });
    }
};

exports.read = function(sessionId, key, callback) {
    if (key === 'user') {
        this.client.query(sql.getQuery('get session user_id'), [sessionId], function(error, result) {
            if (error) return callback(error);

            if (result.rowCount === 1) {
                callback(null, result.rows[0].user_id);
            } else {
                callback(null, null);
            }
        });
    } else {
        callback('not supported');
    }
};

exports.remove = function(sessionId, key, callback) {
    if (key === 'user') {
        this.client.query(sql.getQuery('delete session'), [sessionId], callback);
    } else {
        callback('not supported');
    }
};
