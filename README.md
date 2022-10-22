# chronicreader
new versions of the chronic reader project

## Serviceworker

- UI makes call for book contents between positions
- call goes to service worker
- service worker gets the book file
    - if file stored in cache, gets file from cache
    - if file not in cache, downloads file and saves in cache
- service worker parses book file and returns contents between positions