var pap = require("posix-argv-parser");
var args = pap.create();
var v = pap.validators;
var opt = {};
args.createOption(["-q", "--query"], {
    description: "Tag of Flicr photographs. [[Required]]",
    defaultValue: "",
    validators: [v.required("${1} has to be set")],
    transform: function(value) { return value.split("!"); }
});
args.createOption(["-b", "--bbox"], {
    description: "Bounding box (Default:-90,-180,90,180)",
    defaultValue: "-90,-180,90,180",
    validators: [function(opt) {
        var bbox = opt.value.split(",");
        if (bbox.length != 4) {
            throw new Error("${1} is not a valid bbox e.g. -90,-180,90,180");
        } else if (bbox[0] > bbox[2] || bbox[1] > bbox[3]) {
            throw new Error("${1} is not a valid bbox e.g. -90,-180,90,180");
        } else if (bbox[0] < -90 || bbox[0] > 90 || bbox[1] < -180 || bbox[1] > 180 ||
            bbox[2] < -90 || bbox[2] > 90 || bbox[3] < -180 || bbox[3] > 180) {
            throw new Error("${1} is not a valid bbox e.g. -90,-180,90,180");
        }
    }],
    transform: function(value) { return value.split(","); }
});
args.createOption(["-o", "--outDir"], {
    description: "Output drectory (Default:./out)",
    defaultValue: "./out",
    validators: [v.directory("${2} has to be an existing directory")]
});
args.createOption(["-p", "--parallel"], {
    description: "Color range of footprint. (Default:256)",
    defaultValue: 10,
    validators: [v.integer("${1} must be an Integer")],
    transform: function(value) { return parseInt(value, 10); }
});
args.createOption(["-r", "--range"], {
    description: "Color range of footprint. (Default:256)",
    defaultValue: 256,
    validators: [v.integer("${1} must be an Integer")],
    transform: function(value) { return parseInt(value, 10); }
});
args.createOption(["-g", "--granularity"], {
    description: "DPP (degree pre pixle) of footprint. (Default:1)",
    defaultValue: 1,
    validators: [v.number("${1} must be an Number")],
    transform: function(value) { return parseInt(value, 10); }
});

args.parse(process.argv.slice(2), function(errors, options) {
    if (errors) {
        errors.forEach(function(er) {
            console.log("ERROR:\t" + er);
        });
        console.log("\n[USAGE]");
        args.options.forEach(function(opt) {
            console.log("    " + opt.signature + (Array(21 - opt.signature.length).join(" ")) + ": " + opt.description);
        });
        process.exit(1);
    }
    var opt = {};
    var queries = options["--query"].value;
    opt["outDir"] = options["--outDir"].value;
    opt["range"] = options["--range"].value;
    opt["bbox"] = options["--bbox"].value;
    opt["granularity"] = options["--granularity"].value;
    opt["parallel"] = options["--parallel"].value;
    opt["parallel"] = Math.floor(opt["parallel"] / queries.length);
    var limit = queries.length;
    if (opt["parallel"] == 0) {
        opt["parallel"] = 1;
        limit = 10;
    }
    var async = require("async");
    var startCrawling = function() {
        async.eachLimit(queries, limit, function(query, callback) {
            require('../index.js').run(query, opt, function(outPath) {
                console.log("[DONE] path=" + outPath);
                callback(null);
            });
        }, function(err) {
            console.log("[[ALL DONE]]");
            process.exit(0);
        });
    }
    try {
        var apiKey = require('../api-key.json');
        startCrawling();
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
                    startCrawling();
                    console.log("The api_key/secret was saved!");
                });
            });
        });
    }
});