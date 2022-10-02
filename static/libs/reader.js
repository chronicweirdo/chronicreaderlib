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
    async getBase64FileContents(filename) {
        let zip = await this.#getZip()
        let entry = zip.files[filename]
        let contents = await entry.async("base64")
        return contents
    }
}

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

    async #getPositionedResources() {

    }

    async getSize() {

    }
}