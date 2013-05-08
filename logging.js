exports.photonLogger = function() {
    function getFields(obj) {
        var result = [];
        for (var name in obj) if (obj.hasOwnProperty(name)) result.push(name);
        return result;
    }

    return function(req, res, next) {
        console.log('REQUEST ' + req.socket.remoteAddress + ': ' + req.method + ' ' + req.url + (req.method === 'POST' ? ' : ' + getFields(req.body).join(',') : ''));
        next();
    };
};

exports.tagAdd = function(userId, tags) {
    console.log('TAG_ADD @' + userId.toString() + ': ' + tags.join(','));
};
exports.tagRemove = function(userId, tag) {
    console.log('TAG_REMOVE @' + userId.toString() + ': ' + tag);
};

exports.tagIntersect = function(tags, resultCount) {
    console.log('TAG_INTERSECT: ' + tags.join(',') + ' (' + resultCount.toString() + ')');
};

exports.error = require('./util').error;