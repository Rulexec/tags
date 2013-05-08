var photon = require('photon'),

    check = require('validator').check,
    async = require('async'),

    serverUtil = require('./server_util'),
    page = serverUtil.page,
    template = require('./template'),
    render = template.render,

    logging = require('./logging'),

    ERROR = require('./util').error,

    awsFile = serverUtil.awsFile,

    //auth = require('./auth'),
    auth = photon.auth,

    DB = require('./database');

var regexps = {
    tagSymbolsStr: 'a-zа-яё0-9<>()\\\\!@$%\\^&\\*-=+_\'":;|`~\\.\\?'
};
regexps.notTagSymbol = RegExp('[^' + regexps.tagSymbolsStr + ']', 'g');

exports.start = function(options) {

var db = options.db;

if (options.local) {
    page = serverUtil._pageLocal;
    render = template._renderLocal;
    awsFile = serverUtil.staticFile;
}

var authRequired = auth.fail(authFailed),
    authProvide = auth.provideFail(dbError);

var app = photon(
).use(photon.hostRedirect(options.host)
).use(photon.cookieParser()
).use(photon.urlencoded()

).use(photon.common()
).use(photon.decodeURI()
).use(photon.path()
).use(photon.mime('text/html', 'utf-8')
).use(photon.cookie()

).use(logging.photonLogger()

).use(photon.session({
    sessionApi: db.session})
).use(auth()

).extend(photon.routing());

app.routeStatic({
    '/': authProvide(index),
    '/favicon.ico': awsFile('favicon.ico'),

    '/find': {
        'POST': findRequestPrepare
    },

    '/join': {
        'GET': page('join.html'),
        'POST': join
    },

    '/me': authRequired(me),
    '/me/tags': {
        'POST': authRequired(meUpdate)
    },
    '/me/profile/emailed': authRequired(updateRequestEmailed),
    '/me/profile': {
        'GET': authRequired(updateRequest),
        'POST': authRequired(updateProfile)
    },

    '/me/password': {
        'GET': authRequired(password),
        'POST': authRequired(updatePassword)
    },
    '/me/password/updated': authRequired(mePasswordUpdated),

    '/log/in': {
        'GET': page('login.html'),
        'POST': login
    },
    '/log/out': logout
});

require('./static_files').forEach(function(file) {
    app.get('/static/' + file, awsFile(file));
});

function index(req, res, user) {
    var tmpl = {
        logined: Boolean(user),
        example: null
    };

    db.tags.example(function(error, tags) {
        if (error) return console.log(error), error500(res, 'DB error');

        tmpl.example = tags;
        res.end(render('index.html', tmpl));
    });
}

function join(req, res) {
    var email = req.body.email;

    if (!checkEmail(email)) {
        res.end('Invalid email!');
        return;
    }

    db.user.create(email, function(error, id) {
        if (error) {
            if (error === DB.EXISTS) {
                res.end('Already exists!');
            } else {
                ERROR(error);
                error500(res, 'DB error');
            }
            
            return;
        }

        res.user.set(id, function(error) {
            if (error) return ERROR(error), error500(res, 'DB error');

            res.redirect('/me/profile/emailed').end();
        });
    });
}

function checkEmail(email) {
    try {
        check(email).max(48).isEmail();
        return true;
    } catch(e) {
        return false;
    }
}

function updateRequest(req, res, userId, isEmailed) {
    db.user.getUserProfile(userId, function(error, user) {
        if (error) return ERROR(error), error500(res, 'DB error');

        res.end(render('update.html', {
            user: user,
            emailed: isEmailed
        }));
    });
}
function updateRequestEmailed(req, res, userId) {
    updateRequest(req, res, userId, true);
}

var passwordPage = page('password.html');
function password(req, res, userId) {
    db.user.isEmailValidated(userId, function(error, validated) {
        if (error) return ERROR(error), error500(res, 'DB error');
        
        if (validated) {
            passwordPage(req, res);
        } else {
            res.end('failed');
        }
    });
}
function updatePassword(req, res, userId) {
    var password = req.body.password;

    db.user.updatePassword(userId, password, function(error) {
        if (error) ERROR(error), error500(res, 'DB error');
        else res.redirect('/me/password/updated').end();
    });
}

app.get(/^\/email\/(.{1,64}?)\/([a-z0-9]{32})$/, function(req, res, email, authKey) {
    async.waterfall([
        async.apply(db.user.emailFirstAuth, email, authKey),
        async.apply(res.user.set)
    ], function(error) {
        if (error) return ERROR(error), error500(res, 'DB error');

        res.redirect('/me/password').end();
    });
});

// GET /person/(\d+)
app.get(/^\/person\/(\d+)$/, authProvide(function(req, res, userId, person) {
    person = parseInt(person);

    db.user.getUser(person, function(error, user) {
        if (error) {
            if (error === DB.NOT_EXISTS) {
                res.status(404).end('404 — no such person.');
            } else {
                ERROR(error);
                error500(res, 'DB error');
            }
            return;
        }

        res.end(render('me.html', {
            viewing: userId !== user.id,
            logined: Boolean(userId),
            user: user
        }));
    });
}));

// GET /find/(.+)/
app.get(/^\/find\/(.+)\/$/, authProvide(function(req, res, user, tags) {
    tags = toKeyArray(tags, '/');

    var tmpl = {
        logined: Boolean(user),
        search: tags,
        results: null,
        count: null
    };

    db.tags.intersect(tags, function(error, result) {
        if (error) return ERROR(error), error500(res, 'DB error');

        tmpl.results = result;
        tmpl.count = result.length;
        res.end(render('find.html', tmpl));
    });
}));

// POST /me/(<tag>)/delete
var deleteTagRegExp = RegExp('^/me/([' + regexps.tagSymbolsStr + ']+)/delete$');
app.post(deleteTagRegExp, authRequired(function(req, res, userId, tag) {
    db.tags.remove(userId, tag, function(error) {
        if (error) return console.log(error), error500('DB error');

        res.redirect('/me').end();
    });
}));

function toKeyArray(str, delimiter) {
    return str.split(delimiter).map(function(part) {
        return part.trim().toLowerCase().replace(regexps.notTagSymbol, '');
    }).filter(function(tag) {
        return tag.length > 0;
    });
}

function findRequestPrepare(req, res) {
    var findStr = req.body.find || '';

    if (findStr) {
        var filtered = toKeyArray(findStr, ',').join('/');

        if (filtered.length > 0) {
            res.redirect(303, '/find/' + filtered + '/').end();
            return;
        }
    }

    res.redirect(303, '/').end();
}

function me(req, res, userId, isPasswordUpdated) {
    isPasswordUpdated = Boolean(isPasswordUpdated);

    db.user.getUser(userId, function(error, user) {
        if (error) return ERROR(error), error500(res, 'DB error');

        res.end(render('me.html', {
            passwordUpdated: isPasswordUpdated,
            user: user
        }));
    });
}
function mePasswordUpdated(req, res, userId) {
    me(req, res, userId, true);
}
function meUpdate(req, res, userId) {
    var tagsStr = req.body.tags || '',
        tags = toKeyArray(tagsStr, ',');

    if (tags.length === 0) {
        res.end('>0 needed');
        return;
    }

    db.tags.add(userId, tags, function(error) {
        if (error) return console.log(error), error500(res, 'DB error');

        res.redirect(303, '/me').end();
    });
}

function updateProfile(req, res, userId) {
    db.user.update(userId, {
        name: req.body.name,
        info: req.body.info,
        show_email: Boolean(req.body.show_email)
    }, function(error) {
        if (error) ERROR(error), error500(res, 'DB error');
        else res.redirect('/me').end();
    });
}

function login(req, res) {
    //var id = parseInt(req.body.id);
    var email = req.body.email,
        password = req.body.password;

    if (email && password) {
        db.user.authByPassword(email, password, function(error, userId) {
            if (error) return ERROR(error), error500(res, 'DB error');

            if (userId) {
                res.user.set(userId, function(error) {
                    if (error) ERROR(error), error500(res, 'DB error');
                    else res.redirect('/me').end();
                });
            } else {
                res.redirect('/log/in').end();
            }
        });
    } else {
        res.redirect('/log/in').end();
    }
}
function logout(req, res) {
    res.user.unset().redirect('/').end();
}

function error500(res, text) {
    res.status(500).end(text);
}

function dbError(req, res, error) {
    ERROR(error);
    res.status(500).end('DB error');
}

function authFailed(req, res, error) {
    if (error) return ERROR(error), error500(res, 'DB error');
    //res.redirect(303, '/log/in').end();
    res.end('auth failed');
}

app.listen(options.port);
logging.systemState('web server listening at ' + options.port.toString());

};
