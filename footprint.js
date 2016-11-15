var fs = require('fs'),
    PNG = require('pngjs').PNG,
    Callback = require('node-callback');

var Footprint = function(bbox, granularity) {
    this.bbox = bbox;
    this.granularity = granularity;
    this.png = new PNG({
        width: (bbox[3] - bbox[1]) / this.granularity,
        height: (bbox[2] - bbox[0]) / this.granularity,
        filterType: -1,
        colorType: 6,
    });
}
Footprint.prototype.paint = function(lat, lon, red, green, blue, alpha) {
    var y = (lat - this.bbox[0]) / this.granularity;
    y = this.png.height - y - 1;
    var x = (lon - this.bbox[1]) / this.granularity;
    var idx = ((this.png.width * y) + x) << 2;
    this.png.data[idx] = red;
    this.png.data[idx + 1] = green;
    this.png.data[idx + 2] = blue;
    this.png.data[idx + 3] = alpha;
}
Footprint.prototype.pack = function(filePath, callback) {
    let cb = new Callback(callback);
    this.png.pack().pipe(fs.createWriteStream(filePath).on('close', function() { cb.call(null, null); }));
}
module.exports = Footprint;