var server = require('./server'),
    CONFIG = require('./config'),

    emailer = require('./email'),
    DB = require('./database'),

    logging = require('./logging'),

    async = require('async');

var db = new DB();

async.series([
    async.apply(emailer.start),
    async.apply(db.start)
], function(error) {
    if (error) {
        logging.error(error);
        process.exit(1);
    }

    logging.systemState('starting web server');

    server.start({
        db: db,
        host: CONFIG.HOST,

        local: CONFIG.LOCAL,
        port: CONFIG.PORT
    });
});

process.on('SIGTERM', function() {
    console.log('SHUTDOWN');
    process.exit(0);
});
