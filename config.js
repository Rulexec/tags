var config;

var isLocal = Boolean(process.env.LOCAL) && process.env.LOCAL !== 'false',
    host = process.env.HOST || '127.0.0.1',
    port = process.env.PORT || 5000;

module.exports = config = {
    LOCAL: isLocal,
    PORT: port,

    POSTGRESQL: process.env.HEROKU_POSTGRESQL_COBALT_URL ||
                'tcp://tags:tags@localhost/tags',

    HOST: !isLocal ? 'tags.muna.by' : host + ':' + port,
    URL: !isLocal ?
         'http://tags.muna.by/' :
         'http://' + host + ':' + port + '/'
};
