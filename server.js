// https://stackabuse.com/node-http-servers-for-static-file-serving/

"use strict";

var fs = require('fs')
var path = require('path')
var http = require('http')

var staticBasePath = './static'

var staticServe = function(req, res) {
    var resolvedBase = path.resolve(staticBasePath)
    console.log("resolvedBase=" + resolvedBase)
    var safeSuffix = path.normalize(req.url).replace(/^(\.\.[\/\\])+/, '')
    if (safeSuffix == "/") safeSuffix = "/index.html"
    console.log("safeSuffix=" + safeSuffix)
    var fileLoc = path.join(resolvedBase, safeSuffix)
    console.log("fileLoc=" + fileLoc)

    fs.readFile(fileLoc, function(err, data) {
        if (err) {
            res.writeHead(404, 'Not Found')
            res.write('404: File Not Found!')
            return res.end()
        }
        
        res.statusCode = 200
        res.write(data)
        return res.end()
    })
}

var httpServer = http.createServer(staticServe)

httpServer.listen(10000)