class Database {
    constructor(name, version) {
        this.name = name
        this.version = version
        this.#getDb()
    }

    #getDb() {
        return new Promise((resolve, reject) => {
            let openRequest = indexedDB.open(this.name, this.version)
            openRequest.onupgradeneeded = () => {
                // triggers if the client had no database
                // ...perform initialization...
                console.log("upgrade needed")
                let db = openRequest.result
                if (!db.objectStoreNames.contains('comics')) {
                    db.createObjectStore('comics', {keyPath: 'id'})
                }
                if (!db.objectStoreNames.contains('book')) {
                    db.createObjectStore('book', {keyPath: 'id'})
                }
                resolve(db)
            }
            openRequest.onerror = () => {
                console.error("error", openRequest.error)
                reject()
            }
            openRequest.onsuccess = () => {
                let db = openRequest.result
                // continue working with database using db object
                resolve(db)
            }
        })
    }

    save(table, id, value) {
        return new Promise((resolve, reject) => {
            this.#getDb().then(db => {
                let transaction = db.transaction([table], "readwrite")
                transaction.oncomplete = function(event) {
                    resolve(value)
                }
                let objectStore = transaction.objectStore(table)
                let addRequest = objectStore.put({"id": id, "date": new Date(), "value": value})
            })
        })
    }

    load(table, id) {
        return new Promise((resolve, reject) => {
            this.#getDb().then(db => {
                let transaction = db.transaction([table])
                let objectStore = transaction.objectStore(table)
                let dbRequest = objectStore.get(id)
                dbRequest.onsuccess = function(event) {
                    if (event.target.result) {
                        resolve(event.target.result.value)
                    } else {
                        resolve(null)
                    }
                }
            })
        })
    }
}