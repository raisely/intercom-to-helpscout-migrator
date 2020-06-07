# Intercom to Helpscout - Docs Migrator

This is a simple Node script to migrate an Intercom Articles site over to Helpscout Docs. It does the following:

1. Migrates Intercom collections to Helpscout categories
2. Migrates all images from your Intercom articles to Helpscout
3. Migrates all your articles from Intercom to Helpscout
4. Adds a redirect for the hold Intercom URL to your new Helpscout URL

### How to use

To run the script, clone this repository and then update the `config.js` file with your own settings.

-   `intercomSite` - A link to your support site homepage on Intercom (no trailing slash)
-   `helpscoutKey` - Your Helpscout docs API key
-   `collectionId` - Your Helpscout collection ID (you need to make the collection via the Helpscout admin panel)
-   `siteId` - Your Helpscout docs site ID (for redirects)

Then create an empty directory called `images`. This is used to store your Intercom images for upload.

To run the script:

-   `npm install`
-   `npm start`

_For a site with about 100 docs, it takes roughly an hour._
