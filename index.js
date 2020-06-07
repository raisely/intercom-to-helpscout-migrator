const axios = require("axios");
const cheerio = require("cheerio");
const path = require("path");
const fs = require("fs");
const FormData = require("form-data");
const shortid = require("shortid");

const apiBase = "https://docsapi.helpscout.net/v1";
const {
	intercomSite: intercomBase,
	helpscoutKey: apiKey,
	collectionId,
	siteId,
} = require("./config");

const api = axios.create({
	baseURL: apiBase,
	auth: {
		username: apiKey,
		password: "fakepass",
	},
});

async function downloadImage(article, url) {
	const filepath = path.resolve(
		__dirname,
		"images",
		`${article}-${shortid.generate()}-${
			url.split("/")[url.split("/").length - 1]
		}`
	);
	const writer = fs.createWriteStream(filepath);

	const response = await axios({
		url,
		method: "GET",
		responseType: "stream",
	});

	response.data.pipe(writer);

	return new Promise((resolve, reject) => {
		writer.on("finish", () => resolve(filepath));
		writer.on("error", () => reject());
	});
}

const uploadCollection = async (collection, categoryId) => {
	try {
		// load the collection page
		const page = await axios.get(collection);
		const $ = cheerio.load(page.data);

		// find the articles
		const articles = [];
		$("a.paper__article-preview").each((index, element) => {
			articles.push(element);
		});

		for (const article of articles) {
			const href = article.attribs.href;
			console.log(`(loading) ${href}`);
			const contentPage = await axios.get(`${intercomBase}${href}`);
			const $c = cheerio.load(contentPage.data);

			const title = $c(".article .article__meta h1").text().trim();
			const description = $c(".article .article__meta .article__desc")
				.text()
				.trim();
			let content = $c(".article article").html();
			console.log(`(loaded) ${href} [${title}]`);

			// create the article in HelpScout
			const created = await api({
				url: "/articles",
				method: "post",
				data: {
					collectionId,
					status: "published",
					slug: href
						.replace("/en/articles/", "")
						.split("-")
						.slice(1)
						.join("-"),
					name: title,
					text: content,
					categories: [categoryId],
				},
			});
			const articleId = created.headers.location.replace(
				`${apiBase}/articles/`,
				""
			);

			console.log(`(added) ${href} [${title}] [${articleId}]`);

			// extract files from the intercom article
			const assets = [];
			$c(".article article img").each((index, element) => {
				if (element.attribs.src.includes("downloads.intercomcdn.com"))
					assets.push(element.attribs.src);
			});

			let i = 0;
			for (const asset of assets) {
				i++;
				console.log(
					`(downloading image ${i}/${assets.length}) ${href} [${asset}]`
				);
				const file = await downloadImage(articleId, asset);
				const formData = new FormData();
				formData.append("file", fs.createReadStream(file));
				formData.append("articleId", articleId);
				formData.append("assetType", "image");
				formData.append("key", apiKey);
				const upload = await api({
					url: "/assets/article",
					data: formData,
					method: "post",
					headers: {
						...formData.getHeaders(),
					},
				});

				content = content.replace(
					new RegExp(asset, "g"),
					upload.data.filelink
				);
				console.log(
					`(completed image  ${i}/${assets.length}) ${href} [${asset}]`
				);
			}

			await api({
				url: `/articles/${articleId}`,
				method: "put",
				data: {
					text: content,
				},
			});

			const articleObj = await api({
				url: `/articles/${articleId}`,
				method: "get",
			});

			await api({
				url: `/redirects`,
				method: "post",
				data: {
					siteId,
					urlMapping: href,
					redirect: articleObj.data.article.publicUrl,
				},
			});

			console.log(`(finished) ${href} [${title}] [${articleId}]`);
		}
	} catch (e) {
		console.error(e);
	}
};

const run = async () => {
	try {
		// load the collection page
		const page = await axios.get(`${intercomBase}/en/`);
		const $ = cheerio.load(page.data);

		const collections = [];
		$(".g__space a").each((index, element) => {
			if (element.attribs.href.includes("/en/collections"))
				collections.push(`${intercomBase}/${element.attribs.href}`);
		});

		for (const index in collections) {
			const collectionUrl = collections[index];
			console.log(`(starting collection) ${collectionUrl}`);

			const category = await api({
				url: "/categories",
				method: "post",
				data: {
					collectionId: collectionId,
					name: $(
						`.g__space a[href="${collectionUrl.replace(
							`${intercomBase}/`,
							""
						)}"] h2`
					).text(),
					visibility: "public",
					order: Number(index) + 1,
					defaultSort: "name",
				},
			});

			const categoryId = category.headers.location.replace(
				`${apiBase}/categories/`,
				""
			);

			await uploadCollection(collectionUrl, categoryId);
			console.log(`(completed collection) ${collectionUrl}`);
		}
	} catch (e) {
		console.error(e, e.data);
	}
};

run();
