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

    async getNodes() {
        if (this.nodes == undefined) {
            this.nodes = {}
            let spine = await this.getSpine()
            let entrancePosition = 0
            for (var i = 0; i < spine.length; i++) {
                let resourceNode = await this.#getResourceNode(spine[i], entrancePosition)
                this.nodes[spine[i]] = resourceNode
                entrancePosition = resourceNode.end + 1
            }
            for (var node in this.nodes) {
                await this.nodes[node].updateLinks(node, this)
            }
        }
        return this.nodes
    }

    async getSize() {
        //("getting book size")
        if (this.size == undefined) {
            /*let spine = await this.getSpine()
            //console.log("spine: " + spine)
            let size = 0
            for (var i = 0; i < spine.length; i++) {
                let resourceNode = await this.#getResourceNode(spine[i])
                size = size + resourceNode.getLength()
            }
            this.size = size*/
            let size = 0
            let nodes = await this.getNodes()
            for (var node in nodes) {
                size = size + nodes[node].getLength()
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

    getContextFolder(contextFile) {
        let elems = contextFile.split("/")
        if (elems.length > 1) {
            return elems.slice(0, -1).join("/")
        } else {
            return ""
        }
    }

    computeAbsolutePath(contextFolder, filename) {
        if (contextFolder != null && contextFolder.length > 0) {
            return contextFolder + "/" + filename
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
        }).map(element => this.computeAbsolutePath(this.getContextFolder(opf.name), element))
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

    async #getResourceNode(filename, entrancePosition) {
        //console.log("getting resource node for " + fileName)
        //if (this.node == undefined) this.node = {}
        //if (this.node[filename] === undefined) {
            //console.log("computing resource node for " + fileName)
            let xmlText = await this.archive.getTextFileContents(filename)
            let bookNode = await EbookNode.parseHtmlToEbookNode(xmlText, entrancePosition, filename, this)
            return bookNode
            //console.log(bookNode)
            //this.node[filename] = bookNode
        //}
        //return this.node[filename]
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

    async getImageBase64(contextFile, fileName) {
        return "data:" + this.#getFileMimeType(fileName) + ";base64," + (await this.archive.getBase64FileContents(this.computeAbsolutePath(this.getContextFolder(contextFile), fileName)))
    }

    async getPositionForLink(contextFile, link) {
        if (link == undefined || link == null) return null
        let linkSplit = link.split("#")
        let file = linkSplit.length == 2 ? linkSplit[0] : contextFile
        let id = linkSplit.length == 2 ? linkSplit[1] : linkSplit[0]

        let contextFolder = this.getContextFolder(contextFile)
        let absoluteLink = this.computeAbsolutePath(contextFolder, file)
        //console.log(absoluteLink + " /// " + id)
        let nodes = await this.getNodes()
        let node = nodes[absoluteLink]
        let position = node.getIdPosition(id)
        return position
    }

    async getContentsAt(start, end) {
        console.log("getting content between " + start + " and " + end)
        let size = await this.getSize()
        console.log(size)
        console.log(this.size)
        if (start < 0 || end < 0 || start > end || start >= size || end >= size) return null;
        

        let nodes = await this.getNodes()
        for (var index in nodes) {
            let node = nodes[index]
            if (node.start <= start && start <= node.end) {
                // content is here
                // can only retrieve content from a single section
                let actualEnd = (end > node.end) ? node.end : end
                return node.copy(start, actualEnd).getContent()
            }
        }
        return null
    }

    async findSpaceAfter(position) {
        let size = await this.getSize()
        if (position < 0 || position >= size) return null
        let nodes = await this.getNodes()
        for (var index in nodes) {
            let node = nodes[index]
            if (node.start <= position && position <= node.end) {
                // content is here
                // can only retrieve content from a single section
                return node.findSpaceAfter(position)
            }
        }
        return null
    }
}