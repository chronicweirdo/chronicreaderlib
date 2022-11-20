// https://www.rarlab.com/technote.htm

"use strict";

var fs = require('fs')

var fileLoc = "static/books/RangerHouse.cbr"
fs.readFile(fileLoc, function(err, data) {
    if (err) {
        console.log(err)
    } else {
        console.log(typeof data)
        console.log(data)

        var arrByte = Uint8Array.from(data)
        console.log(arrByte)
        var blob = new Blob(arrByte)
        //console.log(blob)
    }
})