import Moepictures from "moepics-api"
import functions from "../functions/Functions"
import {connect} from "puppeteer-real-browser"
import * as cheerio from "cheerio"

const parseTwitterLink = async (html: string, originalLink: string) => {
    const $ = cheerio.load(html)
    const twitterLinks = [] as {imageUrl: string, tweetLink: string, username: string}[]

    $(".row.item-box").each((_, el) => {
        const box = $(el)
        const imageUrl = "https://ascii2d.net" + box.find(`img[loading="lazy"]`).attr("src")
        const tweetLink = box.find(".detail-box a").eq(0).attr("href")
        const username = box.find(".detail-box a").eq(1).text().trim()

        if (tweetLink?.includes("twitter.com") && username && imageUrl) {
            twitterLinks.push({imageUrl, tweetLink, username})
        }
    })

    let finalLink = ""
    let username = twitterLinks.length ? twitterLinks[0].username : ""
    
    for (const link of twitterLinks) {
        if (link.username === username) {
            let matches = await functions.imagesMatch(originalLink, link.imageUrl)
            if (matches) finalLink = link.tweetLink
        }
    }

    return finalLink
}

export const updateTwitterMirrors = async () => {
    const moepics = new Moepictures(process.env.MOEPICTURES_API_KEY!)

    const posts = await moepics.search.posts({query: "", type: "image", rating: "all+l", style: "all+s", sort: "reverse date", showChildren: true, limit: 99999})

    const {page, browser} = await connect({headless: false, turnstile: true})
    let first = true
    let skip = 51271

    for (const post of posts) {
        if (Number(post.postID) < skip) continue
        if (post.source?.includes("twitter.com")) continue
        if (post.mirrors?.twitter) continue

        let publicBucket = post.rating === "lewd" ? process.env.MOEPICTURES_PUBLIC_BUCKET_R18 : process.env.MOEPICTURES_PUBLIC_BUCKET

        const image = post.images[0]
        const directLink = `${publicBucket}/${image.type}/${image.postID}-${image.order}-${encodeURIComponent(image.filename)}`
        let url = `https://ascii2d.net/search/url/${encodeURIComponent(directLink)}?type=color`

        await page.goto(url, {waitUntil: "domcontentloaded", timeout: 120000})
        if (first) {
            await new Promise(resolve => setTimeout(resolve, 8000))
            first = false
        }
        const html = await page.content()
        const twitterLink = await parseTwitterLink(html, directLink)
        if (!twitterLink) {
            console.log(`skip: ${post.postID}`)
            continue
        }
        console.log(`${post.postID}: ${twitterLink}`)
        const mirrors = post.mirrors || {}
        mirrors.twitter = twitterLink
        const jsonObject = JSON.stringify(mirrors)
        await moepics.posts.update(post.postID, "mirrors", jsonObject)
    }
    
    await browser.close()
}

export default updateTwitterMirrors