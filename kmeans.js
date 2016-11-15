var Callback = require('node-callback');
var KMeans = function(items, centroids) {
    this.items = items;
    this.centroids = centroids;
    for (var n = 0; n < this.items.length; n++) {
        var minDistance = Number.MAX_SAFE_INTEGER;
        var nearestCentroidsIndex = null;
        for (var m = 0; m < this.centroids.length; m++) {
            var distance = Math.abs(this.items[n]["value"] - this.centroids[m]);
            if (minDistance > distance) {
                minDistance = distance;
                nearestCentroidsIndex = m;
            }
        }
        this.items[n]["cluster"] = nearestCentroidsIndex;
    }
    this.renewCentroid();
}
KMeans.prototype.renewCluster = function() {
    for (var n = 0; n < this.items.length; n++) {
        var val = this.items[n]["value"];
        var me = Math.abs(val - this.centroids[this.items[n]["cluster"]]);
        var right = Math.abs(val - this.centroids[this.items[n]["cluster"] + 1]);
        var left = Math.abs(val - this.centroids[this.items[n]["cluster"] - 1]);
        if (me > right && left > right) {
            this.items[n]["cluster"]++;
        } else if (me > left && right > left) {
            this.items[n]["cluster"]--;
        }
    }
}

KMeans.prototype.renewCentroid = function() {
    var sum = [];
    var num = [];
    var settle = true;
    for (var n = 0; n < this.centroids.length; n++) {
        sum.push(0);
        num.push(0);
    }
    for (var n = 0; n < this.items.length; n++) {
        sum[this.items[n]["cluster"]] += this.items[n]["value"];
        num[this.items[n]["cluster"]]++;
    }
    for (var n = 0; n < this.centroids.length; n++) {
        if (num[n] != 0 && this.centroids[n] != (sum[n] / num[n])) {
            this.centroids[n] = sum[n] / num[n];
            settle = false;
        }
    }
    return settle;
}
KMeans.prototype.do = function(callback) {
    var cb = new Callback(callback);
    var async = require("async");
    var _this = this;
    async.doWhilst(function(callbackWhilst) {
        _this.renewCluster();
        callbackWhilst(null);
    }, function() {
        var settle = _this.renewCentroid();
        return !settle;
    }, function(err) {
        cb.call(null, _this.items);
    });
}
module.exports = KMeans;