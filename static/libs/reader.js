/*import {
    BlobReader,
    BlobWriter,
    TextReader,
    TextWriter,
    ZipReader,
    ZipWriter,
  } from "zip.js";*/


/*
zip wrapper:
- get list of files
- get file contents as text or as bytes
*/

class ZipWrapper {
    constructor(bytes) {
        this.data = bytes
    }
    async #getZip() {
        if (this.zip == undefined) {
            var zip = new JSZip()
            var z = await zip.loadAsync(this.data)
            this.zip = z
        }
        return this.zip
    }
    async getFiles() {
        let zip = await this.#getZip()
        let files = Object.entries(zip.files)
            .filter(v => v[1].dir == false)
            .map(v => v[0])
        return files
    }
    // https://stuk.github.io/jszip/documentation/api_zipobject/async.html
    async #getFileContents(filename, filekind) {
        let zip = await this.#getZip()
        let entry = zip.files[filename]
        let contents = await entry.async(filekind)
        return contents
    }
    async getBase64FileContents(filename) {
        return this.#getFileContents(filename, "base64")
    }
    async getTextFileContents(filename) {
        return this.#getFileContents(filename, "text")
    }
}

// zip wrapper based on zip js
/*class ZipWrapper2 {
    constructor(bytes) {
        console.log(bytes)
        this.data = bytes
    }
    async #getZip() {
        if (this.archive == undefined) {
            let zipFileReader = new zip.BlobReader(this.data)
            let zipReader = new zip.ZipReader(zipFileReader)
            this.archive = zipReader
        }
        return this.archive
    }
    async getFiles() {
        let archive = await this.#getZip()
        let files = await archive.getEntries()
            //.filter(v => v[1].dir == false)
            //.map(v => v[0])
        return files
    }
    async getBase64FileContents(filename) {
        let zip = await this.#getZip()
        let entry = zip.files[filename]
        let contents = await entry.async("base64")
        return contents
    }
}*/

/*
comic wrapper
- contains a zip or a rar wrapper
- get size
- get title
- get cover
- get contents for position(s)
*/

class ComicWrapper {
    constructor(archive) {
        this.archive = archive
    }

    async getSize() {
        let files = await this.archive.getFiles()
        return files.length
    }

    async getCover() {
        if (await this.getSize() > 0) {
            let files = await this.archive.getFiles()
            return await this.archive.getBase64FileContents(files[0])
        } else {
            return null
        }
    }

    async getContentsAt(position) {
        if (position >= 0 && position < await this.getSize()) {
            let files = await this.archive.getFiles()
            return await this.archive.getBase64FileContents(files[position])
        } else {
            return null
        }
    }
}

/*
ebook wrapper
- contains a zip wrapper
- get size
- get title
- get cover
- get table of contents
- get contents for position(s)
- get contents for resource path as text or bytes
*/

class EbookWrapper {
    constructor(archive) {
        this.archive = archive
    }

    async getSize() {
        //("getting book size")
        if (this.size == undefined) {
            let spine = await this.getSpine()
            //console.log("spine: " + spine)
            let size = 0
            for (var i = 0; i < spine.length; i++) {
                let resourceNode = await this.#getResourceNode(spine[i])
                size = size + resourceNode.getLength()
            }
            this.size = size
        }
        return this.size
    }

    async #getOpf() {
        let files = await this.archive.getFiles()
        let opfFile = files.find(f => f.toLowerCase().endsWith(".opf"))
        return {
            'name': opfFile,
            'contents': await this.archive.getTextFileContents(opfFile)
        }
    }

    getFileContext(filePath) {
        let elems = filePath.split("/")
        if (elems.length > 1) {
            return elems.slice(0, -1).join("/")
        } else {
            return ""
        }
    }

    computeAbsolutePath(context, filename) {
        if (context != null && context.length > 0) {
            return context + "/" + filename
        } else {
            return filename
        }
    }

    async parseOpf() {
        let opf = await this.#getOpf()
        //console.log(opf.name)
        //console.log(this.getFileFolder(opf.name))
        let opfXmlText = opf.contents
        let parser = new DOMParser()
        let xmlDoc = parser.parseFromString(opfXmlText, "text/xml")

        // get spine
        let spine = Array.from(xmlDoc.getElementsByTagName("itemref")).map(element => {
            let item = xmlDoc.getElementById(element.getAttribute("idref"))
            return item.getAttribute("href")
        }).map(element => this.computeAbsolutePath(this.getFileContext(opf.name), element))
        this.spine = spine
        //return xmlDoc.getElementsByTagName("itemref")
        return spine
    }

    async getSpine() {
        if (this.spine == undefined) {
            await this.parseOpf()
        }
        return this.spine
    }

    async #getResourceNode(fileName) {
        //console.log("getting resource node for " + fileName)
        if (this.node == undefined) this.node = {}
        if (this.node[fileName] === undefined) {
            //console.log("computing resource node for " + fileName)
            let xmlText = await this.archive.getTextFileContents(fileName)
            let bookNode = await EbookNode.parseHtmlToEbookNode(xmlText, this.getFileContext(fileName), this)
            //console.log(bookNode)
            this.node[fileName] = bookNode
        }
        return this.node[fileName]
    }

    // https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/MIME_types/Common_types
    #getFileMimeType(filename) {
        let extension = filename.toLowerCase().substring(filename.lastIndexOf('.') + 1)
        if (extension == "png" || extension == "jpeg"
            || extension == "avif" || extension == "bmp" || extension == "gif"
            || extension == "tiff" || extension == "webp") {
            return "image/" + extension
        } else if (extension == "jpg") {
            return "image/jpeg"
        } else if (extension == "tif") {
            return "image/tiff"
        } else if (extension == "svg") {
            return "image/svg+xml"
        } else if (extension == "ico") {
            return "image/vnd.microsoft.icon"
        } else {
            return "text/plain"
        }
    }

    async getImageBase64(context, fileName) {
        return "data:" + this.#getFileMimeType(fileName) + ";base64," + (await this.archive.getBase64FileContents(this.computeAbsolutePath(context, fileName)))
    }

    async getPositionForLink(context, link) {
        let absoluteLink = this.computeAbsolutePath(context, link)

    }
}