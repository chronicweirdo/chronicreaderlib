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
    var zip = require('./static/libs/zip.min.js')

    let filePath = './static/books/Feature_Comics_111.cbz'
    /*var data = fs.readFile(filePath, function(err, data) {
        if (err) {
            return null
        }
        return data
    })*/

    let data = fs.readFileSync(filePath)//.toString('hex');
    console.log(data)
    let blob = new Blob([data])
    console.log(blob)

    const zipFileReader = new zip.BlobReader(blob)
    const zipReader = new zip.ZipReader(zipFileReader)

    /*async function getEntries(zipReader) {
        try {
            let entries = await zipReader.getEntries()
            return entries
        } catch (error) {
            console.log("error: " + error)
        }
    }*/

    //zipReader.getEntries().then((entries) => console.log(entries))
    /*let entries = await getEntries(zipReader)*/
    let entries = await zipReader.getEntries()
    console.log(entries)

    /*const firstEntry = (await zipReader.getEntries()).shift()
    const helloWorldText = await firstEntry.getData(helloWorldWriter)
    await zipReader.close()

    console.log(helloWorldText)*/

})()