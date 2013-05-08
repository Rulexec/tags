var sql = require('./sql'),
    DB = require('./index'),
    emailer = require('../email'),
    crypto = require('crypto'),

    async = require('async');

exports.create = function(email, callback) {
    var clientQuery = this.client.query.bind(this.client);

    var id;
    async.waterfall([
        async.apply(async.parallel, [
            async.apply(clientQuery, sql.getQuery('create user'), [email]),
            async.apply(crypto.randomBytes, 16)
        ]),
        function(results, callback) {
            var sqlResult = results[0],
                cryptoResult = results[1];

            if (sqlResult.rowCount === 1) {
                var authKey = cryptoResult.toString('hex');
                id = sqlResult.rows[0].id;

                clientQuery(sql.getQuery('save email auth key'),
                            [id, authKey], callback);
                
                emailer.sendAuth(email, authKey);
            } else {
                callback(DB.EXISTS);
            }
        }
    ], function(error) {
        if (error) callback(error);
        else callback(null, id);
    });
};

exports.update = function(id, fields, callback) {
    this.client.query(sql.getQuery('update user'),
                      [id, fields.name, fields.info, fields.show_email],
                      callback);
};

var validatedString = 'validated                       ';
exports.getUser = function(id, callback) {
    var clientQuery = this.client.query.bind(this.client);

    async.parallel([
        async.apply(clientQuery, sql.getQuery('get user'), [id]),
        async.apply(this.tags.getUserTags.bind(this), id)
    ], function(error, results) {
        if (error) return callback(error);

        var sqlResult = results[0],
            tags = results[1];

        if (sqlResult.rowCount === 1) {
            var user = sqlResult.rows[0],
                canChangePassword = user.passhash !== null ||
                                    user.passhash === validatedString;

            callback(null, {
                id: id,
                name: user.name,
                info: user.about,
                canChangePassword: canChangePassword,
                email: user.email,
                show_email: user.show_email,
                tags: tags
            });
        } else {
            callback(DB.NOT_EXISTS);
        }
    });
};
exports.getUserProfile = function(id, callback) {
    this.client.query(sql.getQuery('get user'), [id], function(error, result) {
        if (error) return callback(error);

        
        if (result.rowCount === 1) {
            var user = result.rows[0];
                canChangePassword = user.passhash !== null ||
                                    user.passhash === validatedString;

            callback(null, {
                id: id,
                name: user.name,
                info: user.about,
                email: user.email,
                canChangePassword: canChangePassword,
                show_email: user.show_email
            });
        } else {
            callback(DB.NOT_EXISTS);
        }
    });
};

exports.emailFirstAuth = function(email, authKey, callback) {
    var clientQuery = this.client.query.bind(this.client);

    var userId;
    async.waterfall([
        async.apply(clientQuery, sql.getQuery('get email auth key'), [email, authKey]),
        function (result, callback) {
            if (result.rowCount === 0) return callback(DB.NOT_EXISTS);

            userId = result.rows[0].id;
            async.parallel([
                async.apply(clientQuery, sql.getQuery('remove email auth key'),
                            [userId, result.rows[0].auth_key]),
                async.apply(clientQuery, sql.getQuery('set email validated'),
                            [userId])
            ], callback)
        }
    ], function(error) {
        if (error) callback(error);
        else callback(null, userId);
    });
};

exports.isEmailValidated = function(id, callback) {
    this.client.query(sql.getQuery('check email validation'), [id], function(error, result) {
        callback(null, result.rowCount === 1);
    });
};

exports.updatePassword = function(id, password, callback) {
    password = md5(password);
    this.client.query(sql.getQuery('update password'), [id, password], callback);
};

exports.authByPassword = function(email, password, callback) {
    password = md5(password);
    this.client.query(sql.getQuery('auth by password'),
                      [email, password], onAuth);

    function onAuth(error, result) {
        if (error) return error;

        if (result.rowCount === 1) {
            callback(null, result.rows[0].id);
        } else {
            callback(null, null);
        }
    }
};

function md5(str) {
    return crypto.createHash('md5').update(str).digest('hex');
}
