// randInt(max) returns [0; max)
// randInt(min, max) returns [min, max]
exports.randInt = function() {
    var min, max;
    if (arguments[1] !== undefined) {
        min = arguments[0];
        max = arguments[1];

        return min + randInt(max - min + 1);
    } else {
        max = arguments[0];

        return Math.floor(Math.random() * max);
    }
}

exports.error = function() {
    console.log.apply(null, ['ERROR'].concat(Array.prototype.slice.call(arguments)));
    console.trace('ERROR');
}
