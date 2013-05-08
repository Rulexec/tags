var async = require('async'),
    sql = require('./sql'),

    logging = require('../logging');

exports.example = function(callback) {
    var self = this;

    this.client.query(sql.getQuery('get example'), function(error, result) {
        if (error) return callback(error);

        callback(null, result.rows.map(function(row) {
            return row.tag.trim();
        }));
    });
};

exports.getUserTags = function(userId, callback) {
    this.client.query(sql.getQuery('get user tags'), [userId], function(error, result) {
        if (error) return callback(error);

        callback(null, result.rows.map(function(row) {
            return row.tag.trim();
        }));
    });
};

exports.intersect = function(tags, callback) {
    // SELECT "user" FROM tags WHERE tag = '$1' INTERSECT ...
    function genIntersectQuery(tag, i) {
        return 'SELECT "user" FROM "tags-users" WHERE tag = $' + (i + 1).toString();
    }
    function genCountQuery(user, i) {
        var userP = '$' + (i + 1).toString();
        return 'SELECT CAST(' + userP + ' AS integer) AS "user", COUNT(*) AS "count" FROM "tags-users" WHERE "user" = ' + userP;
    }
    function genTagsQuery(user, i) {
        var userP = '$' + (i + 1).toString();
        return '(SELECT CAST(' + userP + ' AS integer) AS "user", tag FROM "tags-users" WHERE "user" = ' + userP + ' LIMIT 6)';
    }

    var intersectQuery = tags.map(genIntersectQuery).join(' INTERSECT ');

    // join names
    intersectQuery = 'SELECT a.id AS "user", a.name FROM users a JOIN (' +
                     intersectQuery +
                     ') AS b ON a.id = b.user;';
    
    var clientQueryFn = this.client.query.bind(this.client);
    async.waterfall([
        async.apply(clientQueryFn, intersectQuery, tags),
        function(results, callback) {
            var userNames = {};

            var pureUsers = results.rows.map(function(row) {
                userNames[row.user] = row.name;
                return row.user;
            });

            var countQuery = pureUsers.map(genCountQuery).join(' UNION '),
                tagsQuery = pureUsers.map(genTagsQuery).join(' UNION ');

            async.parallel({
                'count': async.apply(clientQueryFn, countQuery, pureUsers),
                'tags': async.apply(clientQueryFn, tagsQuery, pureUsers)
            }, function(error, results) {
                if (error) return callback(error);

                var usersObj = {};
                
                results.count.rows.forEach(function(row) {
                    usersObj[row.user] = {
                        id: row.user,
                        name: userNames[row.user],
                        count: row.count,
                        tags: []
                    };
                });

                results.tags.rows.forEach(function(row) {
                    usersObj[row.user].tags.push(row.tag);
                });

                var result = [];
                for (var name in usersObj) if (usersObj.hasOwnProperty(name)) {
                    result.push(usersObj[name]);
                }

                logging.tagIntersect(tags, result.length);

                callback(null, result);
            });
        }
    ], callback);
};

exports.add = function(userId, tags, callback) {
    logging.tagAdd(userId, tags);

    function genQuery(tag, i) {
        var tagP = '$' + (i + 2).toString();
        return 'SELECT CAST(' + tagP + ' AS character varying(32)), $1 WHERE NOT EXISTS (' +
            'SELECT * FROM "tags-users" WHERE tag = ' + tagP +
            ' AND "user" = $1)';
    }

    // INSERT INTO "tags-users" (SELECT 'another', '1' WHERE NOT EXISTS (SELECT * FROM "tags-users" WHERE tag = 'another' AND "user" = '1') UNION ...)

    var query = 'INSERT INTO "tags-users" (tag, "user") (' +
            tags.map(genQuery).join(' UNION ') + ')';

    this.client.query(query, [userId].concat(tags), callback);
};

exports.remove = function(userId, tag, callback) {
    logging.tagRemove(userId, tag);

    this.client.query(sql.getQuery('delete tag'), [userId, tag], callback);
};
