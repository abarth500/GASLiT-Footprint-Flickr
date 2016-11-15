var Callback = require('node-callback');
exports.validate = function(key, value) {

}
exports.run = function(query, opt, callback = function() { console.log("ALL DONE!"); }) {
    console.log("[START] query=" + query);
    var lastCallback = new Callback(callback);
    var text = query;
    var granularity = opt.hasOwnProperty("granularity") ? opt["granularity"] : 3;
    var bbox = opt.hasOwnProperty("box") ? opt["bbox"] : [-90, -180, 90, 180];
    if (bbox[0] >= bbox[2] || bbox[1] >= bbox[3] || bbox[0] < -90 || bbox[1] < -180 || bbox[2] > 90 || bbox[3] > 180) {
        throw new RangeError("Argument Error: bbox boundary error.");
    }
    if (((bbox[2] - bbox[0]) % granularity != 0) || ((bbox[3] - bbox[1]) % granularity != 0)) {
        throw new RangeError("Argument Error: Wrong granularity.");
    }
    var range = opt.hasOwnProperty("range") ? opt["range"] : 256;
    if (range > 256 || range < 3) {
        throw new RangeError("Argument Error: Wrong range.");
    }
    var [red, green, blue] = opt.hasOwnProperty("color") ? opt["color"] : [255, 255, 255];
    if (red < 0 || red > 255 || green < 0 || green > 255 || blue < 0 || blue > 255) {
        throw new RangeError("Argument Error: Wrong color.");
    }
    var parallel = opt.hasOwnProperty("parallel") ? opt["parallel"] : 10;
    if (parallel < 0) {
        throw new RangeError("Argument Error: Wrong number of parallel.");
    }
    var outDir = opt.hasOwnProperty("outDir") ? opt["outDir"] : './out';
    var outPath = outDir + "/" + text;
    var _preCrawl = false;
    if (bbox[0] != -90 || bbox[1] != -180 || bbox[2] != 90 || bbox[3] != 180) {
        outPath += "-" + bbox[0] + "-" + bbox[1] + "-" + bbox[2] + "-" + bbox[3];
    } else if (granularity == 1) {
        _preCrawl = true;
        console.log("Pre-Crawl function is activated.");
    }
    outPath += ".png";
    var lowpass = 0.2;
    var highpass = 0.2;
    try {
        var apiKey = require('./api-key.json');
        startFlickr(apiKey);
    } catch (e) {
        console.log("API KEY not found.");
        var readline = require('readline');
        var rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        rl.question("Your Flickr API key? ", function(apikey) {
            rl.question("Your Flickr API Secret? ", function(apisecret) {
                console.log("-> SET:" + apikey + "/" + apisecret);
                rl.close();
                var fs = require('fs');
                fs.writeFile("./api-key.json", JSON.stringify({
                    "api_key": apikey,
                    "secret": apisecret
                }), function(err) {
                    if (err) throw err;
                    startFlickr({
                        "api_key": apikey,
                        "secret": apisecret
                    });
                    console.log("The api_key/secret was saved!");
                });
            });
        });
    }

    function startFlickr(apiKey) {
        var Flickr = require("flickrapi");
        Flickr.tokenOnly(apiKey, function(error, flickr) {
            var async = require("async");
            if (_preCrawl) {
                var col = [];
                for (var lat = -90; lat < 90; lat += 10) {
                    for (var lon = -180; lon < 180; lon += 10) {
                        col.push([flickr, lat, lon]);
                    }
                }
                async.mapLimit(col, parallel, preCrawl, function(err, coll) {
                    var colle = [];
                    async.each(coll, function(item, callback) {
                        for (var lat = 0; lat < 10; lat++) {
                            for (var lon = 0; lon < 10; lon++) {
                                colle.push([item[0], item[1] + lat, item[2] + lon]);
                            }
                        }
                        callback();
                    }, function() {
                        async.mapLimit(colle, parallel, oneCrawl, finish);
                    });
                });
            } else {
                var col = [];
                for (var lat = bbox[0]; lat < bbox[2]; lat += granularity) {
                    for (var lon = bbox[1]; lon < bbox[3]; lon += granularity) {
                        col.push([flickr, lat, lon]);
                    }
                }
                async.mapLimit(col, parallel, oneCrawl, finish);
            }
        });
    }

    function finish(err, results) {
        console.log("DRAWING: " + text);
        var async = require("async");
        async.parallel([
            function(callbackParallel) {
                async.sortBy(results, function(item, callback) {
                    callback(err, item["value"]);
                }, function(err, sorted) {
                    if (err) {
                        console.log("ERR sortBy");
                        process.exit(1);
                    }
                    callbackParallel(err, { "key": "sort", "value": sorted });
                });
            },
            function(callbackParallel) {
                //sum
                async.reduce(results, 0, function(memo, item, callback) {
                    process.nextTick(function() {
                        callback(null, memo + item["value"])
                    });
                }, function(err, sum) {
                    if (err) {
                        console.log("ERR reduce");
                        process.exit(1);
                    }
                    callbackParallel(err, { "key": "sum", "value": sum });
                });
            }
        ], function(err, outParallel) {
            if (err) {
                console.log("ERR parallel");
                process.exit(1);
            }
            var sum = (outParallel[0]["key"] == "sum") ? outParallel[0]["value"] : outParallel[1]["value"];
            var results = (outParallel[0]["key"] == "sort") ? outParallel[0]["value"] : outParallel[1]["value"];
            var max = (outParallel[0]["key"] == "sort") ? outParallel[0]["value"][outParallel[0]["value"].length - 1]["value"] : outParallel[1]["value"][outParallel[1]["value"].length - 1]["value"];
            var lowLimit = Math.ceil(sum * highpass);
            var highLimit = Math.floor(sum * (1 - lowpass));
            //console.log("MAX" + max + "\nSUM=" + sum + "\nHigh=" + highLimit + "\nLow=" + lowLimit);
            async.transform(results, function(acc, item, index, callback) {
                setImmediate(function() {
                    if (index == 0) {
                        item["sum"] = item["value"];
                        item["mus"] = item["value"] * (results.length - index);
                    } else {
                        item["sum"] = results[index - 1]["sum"] + item["value"];
                        item["mus"] = results[index - 1]["mus"] + ((item["value"] - results[index - 1]["value"]) * (results.length - index));
                    }
                    if (item["mus"] < lowLimit) {
                        item["value"] = 0;
                    } else if (item["sum"] > highLimit) {
                        item["value"] = highLimit;
                    }
                    acc.push(item);
                    callback(null);
                });
            }, function(err, results) {
                if (err) {
                    console.log("ERR transform");
                    process.exit(1);
                }
                var Footprint = require('./footprint.js');
                var footprint = new Footprint(bbox, granularity);
                async.filter(results, function(item, callback) {
                    if (item["value"] == 0) {
                        footprint.paint(item["lat"], item["lon"], red, blue, green, 0);
                        callback(null, false);
                    } else if (item["value"] == highLimit) {
                        footprint.paint(item["lat"], item["lon"], red, blue, green, 255);
                        callback(null, false);
                    } else {
                        //footprint.paint(item["lat"], item["lon"], 255, 0, 0, 255);
                        callback(null, true);
                    }
                }, function(err, results) {
                    if (err) {
                        console.log("ERR filter");
                        process.exit(1);
                    }
                    var centroid = [];
                    var min = results[0]["value"];
                    var max = results[results.length - 1]["value"];
                    var localRange = Math.min(results.length, range - 2);
                    for (var c = 0; c < localRange - 1; c++) {
                        centroid.push(results[Math.floor(c * results.length / localRange)]["value"]);
                    }
                    centroid.push(max);
                    var KMeans = require('./kmeans.js');
                    var kmeans = new KMeans(results, centroid);
                    kmeans.do(function(err, results) {
                        if (err) {
                            console.log("ERR whilst");
                            process.exit(1);
                        }
                        async.each(results, function(item, callback) {
                            var col = Math.round((item["cluster"] + 1) * 255 / range);
                            footprint.paint(item["lat"], item["lon"], red, blue, green, col);
                            callback();
                        }, function(err) {
                            if (err) {
                                console.log("ERR each");
                                process.exit(1);
                            }
                            footprint.pack(outPath, function() {
                                lastCallback.call(outPath);
                            });
                        });
                    });
                });
            });
        });
    }

    function preCrawl(geo, callback) {
        var flickr = geo[0];
        var lat = geo[1];
        var lon = geo[2];
        flickr.photos.search({
            "tags": text,
            "tag_mode ": "all",
            "bbox": lon + "," + lat + "," + (10 + lon) + "," + (10 + lat)
        }, function(err, result) {
            if (err) {
                console.log(lon + "," + lat + "," + (10 + lon) + "," + (10 + lat), err);
                throw new Error("preCrawl Error");
            }
            setImmediate(callback, null, [flickr, lat, lon]);
        });
    }

    function oneCrawl(geo, callback) {
        var flickr = geo[0];
        var lat = geo[1];
        var lon = geo[2];
        flickr.photos.search({
            "tags": text,
            "tag_mode ": "all",
            "bbox": lon + "," + lat + "," + (granularity + lon) + "," + (granularity + lat)
        }, function(err, result) {
            if (err) {
                console.log(lon + "," + lat + "," + (granularity + lon) + "," + (granularity + lat), err);
                throw new Error("Crawl Error");
            }
            setImmediate(callback, null, {
                "lat": lat,
                "lon": lon,
                "granularity": granularity,
                "value": parseInt(result.photos.total)
            });
        });
    }
}