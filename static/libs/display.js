class ComicDisplay {
    constructor(element, id, startPosition = 0) {
        this.element = element
        this.id = id
        this.position = startPosition
        this.displayPageFor(startPosition)
    }

    async displayPageFor(position) {
        let pageContent = await fetch("/book/" + this.id + "/content?from=" + position + "&to=" + position)
        console.log(pageContent)
        this.element.src = pageContent
    }

    /*async #getPageFor(position) {
        let page = await this.comic.getContentsAt(position)
        return page
    }*/

    async nextPage() {
        let size = await this.comic.getSize()
        console.log(size)
        if (this.position < size - 1) {
            console.log("increasing position")
            this.position = this.position + 1
            this.displayPageFor(this.position)
        }
    }

    async previousPage() {
        if (this.position > 0) {
            this.position = this.position - 1
            this.displayPageFor(this.position)
        }
    }
}