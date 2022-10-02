// https://gildas-lormeau.github.io/zip.js/

/*import {
    BlobReader,
    BlobWriter,
    TextReader,
    TextWriter,
    ZipReader,
    ZipWriter,
} from "static/libs/zip.min.js"*/

(async function main () {
    var fs = require('fs')
    const stream = require('stream')
    //var zip = require('./static/libs/zip.js')
    var jszip = require('./static/libs/jszip.js')

    let filePath = './static/books/Feature_Comics_111.cbz'
    let data = fs.readFileSync(filePath)//.toString('hex');

    var zip = new jszip()

    var z = await zip.loadAsync(data)
    //console.log(z.files)
    //console.log(typeof(z.files))
    console.log(Object.entries(z.files)[1])

    var filename = Object.entries(z.files)[1][0]
    console.log(filename)
    console.log(z.files[filename])

    // https://stuk.github.io/jszip/documentation/api_zipobject/async.html
    var image = await z.files[filename].async("base64")
    console.log(image)

    var imagearr = await z.files[filename].async("uint8array")
    fs.writeFileSync("page.jpg", imagearr)

    //let blob = new Blob([data])

    //const zipFileReader = new zip.BlobReader(blob)
    //const zipReader = new zip.ZipReader(zipFileReader)
    //let entries = await zipReader.getEntries()
    //console.log(entries)

    //const firstEntry = entries[1]
    //console.log(firstEntry)
    //const imageFileWriter = new zip.BlobWriter()
    //let bytes = await firstEntry.getData(imageFileWriter)
    //await zipReader.close()

    //console.log(bytes)

    //fs.writeFileSync("page.jpg", bytes)

})()