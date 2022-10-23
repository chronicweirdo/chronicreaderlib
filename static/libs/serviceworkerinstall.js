if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(registrations => {
        navigator.serviceWorker.register('/serviceworker.js').then(function(registration) {
            // we load latest read both on success and on failure (when offline)
            registration.update().then(() => console.log("installed service worker"))
        }, function(error) {
            console.log("service worker registration failed: ", error)
        })
    })
} else {
    console.log("serviceworkers not available")
}