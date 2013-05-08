var fs = require('fs');

var queries = {};

exports.start = function(callback) {
    fs.readFile(__dirname + '/queries.sql', {encoding: 'utf-8'}, onRead);
    
    function onRead(error, content) {
        if (error) return callback(error);

        var currentName = null, currentQuery;

        function process() {
            if (currentName) queries[currentName] = currentQuery;
        }

        content.split('\n').forEach(function(line) {
            if (line.slice(0, 7) === '--##-- ') {
                process();
                currentName = line.slice(7).trim();
                currentQuery = '';
            } else {
                if (line != '') {
                    currentQuery += line + '\n';
                }
            }
        });
        process();

        callback();
    }
};

exports.getQuery = function(name) {
    return queries[name];
};
