importScripts('/libs/bookNode.js')
importScripts('/libs/reader.js')
importScripts('/libs/database.js')

const DATABASE_NAME = "chronicreader"
const DATABASE_VERSION = "2"

self.addEventListener('install', e => {
    console.log("installing service worker")
})

self.addEventListener('fetch', e => {
    var url = new URL(e.request.url)
    console.log("pathname: " + url.pathname)

    if (url.pathname.startsWith("/book")) {
        let path = url.pathname.split("/")
        console.log(path)
        
        e.respondWith(loadBook(e.request))
    } else {
    /*if (url.pathname === '/markProgress') {
        e.respondWith(handleMarkProgress(e.request))
    } else if (url.pathname === '/loadProgress') {
        e.respondWith(handleLoadProgress(e.request))
    } else if (url.pathname === '/latestRead') {
        e.respondWith(handleLatestReadRequest(e.request))
    } else if (url.pathname === '/latestAdded') {
        e.respondWith(handleLatestAddedRequest(e.request))
    } else if (url.pathname === '/comic' || url.pathname === '/book') {
        e.respondWith(handleRootDataRequest(e.request))
    } else if (url.pathname === '/imageData' || url.pathname === '/bookResource') {
        e.respondWith(handleDataRequest(e.request))
    } else if (url.pathname === '/bookSection') {
        e.respondWith(handleBookSectionRequest(e.request))
    } else if (url.pathname === '/') {
        e.respondWith(handleRootRequest(e.request))
    } else if (url.pathname === '/search') {
        e.respondWith(handleSearchRequest(e.request))
    } else if ((url.pathname === '/login' && e.request.method == 'POST') || (url.pathname === '/logout')) {
        e.respondWith(handleLoginLogout(e.request))
    } else if (filesToCache.includes(url.pathname)) {
        e.respondWith(handleWebResourceRequest(e.request))
    } else {
        e.respondWith(fetch(e.request))
    }*/

        e.respondWith(fetch(e.request))
    }
})

async function loadBook(request) {
    try {
        // check if book in cache
        let db = new Database(DATABASE_NAME, DATABASE_VERSION)
        let book = await db.load("book", "1")
        if (book == null) {
            // load book from server
            let bookResponse = await fetch(request)
            // store book to cache
            let headers = Object.fromEntries(bookResponse.headers.entries())
            let blob = await bookResponse.blob()
            book = await db.save("book", "1", {"headers": headers, "body": blob})
        }
        return new Response(book.body, {headers: new Headers(book.headers)})
    } catch (e) {
        console.log(e)
    }
}

/*function getComicContent(id, position) {

}*/

function get401Response() {
    return new Response("", { "status" : 401 })
}

function get404Response() {
    return new Response("", { "status" : 404 })
}
