var files = module.exports = [];

['vk', 'google', 'yandex', 'twitter'
].forEach(function(auth) {
    files.push('auth/' + auth + '.png');
});
