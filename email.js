var nodemailer = require('nodemailer'),
    CONFIG = require('./config');

var transport, fs, fd;

exports.start = function(callback) {
    transport = nodemailer.createTransport('SMTP', {
        service: 'Mandrill',
        name: 'communa-tags',
        auth: {
            user: process.env.MANDRILL_USERNAME,
            pass: process.env.MANDRILL_APIKEY
        }
    });
    callback();
};

CONFIG.LOCAL && (exports.start = function(callback) {
    fs = require('fs');

    fs.open(__dirname + '/logs/emails.txt', 'a', function(error, _fd) {
        if (error) return callback(error);

        fd = _fd;
        callback();
    });
});

exports.sendAuth = function(email, authKey) {
    var authLink = CONFIG.URL + "email/" + email + "/" + authKey;

    var mailOptions = {
        from: 'Теги <rulix.exec@gmail.com>',
        replyTo: 'Александр Рулёв <rulix.exec@gmail.com>',
        to: email,
        subject: '[Теги] Ссылка для задания пароля',
        html: "Мы пришли с миром! Вот ваша ссылка: <a href='" +
              authLink + "'>" + authLink + '</a>.<br><br>' +
              'Перейдя по ней, вы сможете зайти на сервис и установить себе пароль.<br><br>' +
              'Если у вас есть какие-либо предложения по поводу сервиса, просто ответьте на это письмо.<br><br>' +
              'Спасибо.'
    };

    transport.sendMail(mailOptions);
};

CONFIG.LOCAL && (exports.sendAuth = function(email, authKey) {
    var authLink = CONFIG.URL + "email/" + email + "/" + authKey;

    var buffer = new Buffer(authLink + '\n', 'utf-8');
    fs.write(fd, buffer, 0, buffer.length);
});
