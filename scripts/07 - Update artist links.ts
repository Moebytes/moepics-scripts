import Moepictures from "moepics-api"
import functions from "../functions/Functions"

const sortURLs = async (urls: string[]) => {
    let pixivMeLinks = [] as string[]
    let pixivLinks = [] as string[]
    let pixivSketchLinks = [] as string[]
    let twitterLinks = [] as string[]
    let twitterDirectLinks = [] as string[]
    let deviantartLinks = [] as string[]
    let artstationLinks = [] as string[]
    let tumblrLinks = [] as string[]
    let instagramLinks = [] as string[]
    let fanboxLinks = [] as string[]
    let patreonLinks = [] as string[]
    let fantiaLinks = [] as string[]
    let skebLinks = [] as string[]
    let pawooLinks = [] as string[]
    let otherLinks = [] as string[]
    for (const url of urls) {
        if (url.includes("sketch.pixiv.net")) {
            pixivSketchLinks.push(url)
        } else if (url.includes("pixiv.net/fanbox")) {
            fanboxLinks.push(url)
        } else if (url.includes("pixiv.me")) {
            pixivMeLinks.push(url)
        } else if (url.includes("pixiv.net")) {
            pixivLinks.push(url)
        } else if (url.includes("twitter.com/i/user") || url.includes("x.com/i/user")) {
            twitterDirectLinks.push(url)
        } else if (url.includes("twitter.com") || url.includes("/x.com")) {
            twitterLinks.push(url)
        } else if (url.includes("pawoo.net")) {
            pawooLinks.push(url)
        } else if (url.includes("fanbox")) {
            fanboxLinks.push(url)
        } else if (url.includes("skeb.jp")) {
            skebLinks.push(url)
        } else if (url.includes("fantia.jp")) {
            fantiaLinks.push(url)
        } else if (url.includes("deviantart.com")) {
            deviantartLinks.push(url)
        } else if (url.includes("artstation.com")) {
            artstationLinks.push(url)
        } else if (url.includes("tumblr")) {
            tumblrLinks.push(url)
        } else if (url.includes("instagram")) {
            instagramLinks.push(url)
        } else if (url.includes("patreon.com")) {
            patreonLinks.push(url)
        } else {
            otherLinks.push(url)
        }
    }

    let sortedPixivlinks = [] as string[]
    for (let i = 0; i < pixivLinks.length; i++) {
        let meLink = pixivMeLinks[i]
        let pixivLink = pixivLinks[i]
        if (pixivLinks.length > 1) {
            if (meLink) {
                const redirect = await fetch(meLink, {method: "HEAD", redirect: "follow"}).then((r) => r.url).catch(() => null)
                if (meLink) sortedPixivlinks.push(meLink)
                if (redirect) sortedPixivlinks.push(redirect)
            }
        } else {
            if (meLink) sortedPixivlinks.push(meLink)
            if (pixivLink) sortedPixivlinks.push(pixivLink)
        }
    }

    let sortedTwitterLinks = [] as string[]
    for (let i = 0; i < twitterLinks.length; i++) {
        let twitterLink = twitterLinks[i]
        let directLink = twitterDirectLinks[i]
        if (twitterLink) sortedTwitterLinks.push(twitterLink)
        if (directLink) sortedTwitterLinks.push(directLink)
    }

    return [
        ...sortedPixivlinks,
        ...sortedTwitterLinks,
        ...deviantartLinks,
        ...artstationLinks,
        ...tumblrLinks,
        ...instagramLinks,
        ...fanboxLinks,
        ...patreonLinks,
        ...fantiaLinks,
        ...skebLinks,
        ...pixivSketchLinks,
        ...pawooLinks, 
        ...otherLinks
    ]
}

const updateArtistLinks = async () => {
    const moepics = new Moepictures(process.env.MOEPICTURES_API_KEY!)

    const tags = await moepics.search.tags({type: "artist", sort: "reverse date", limit: 999999})
    console.log(tags.length)

    let i = 0
    for (const tag of tags) {
        i++
        if (i < 0) continue
        // Comment this line to process all artists again
        if (tag.description !== "Artist.") continue

        let danbooruArtistTag = await functions.getDanbooruArtistTag(tag.tag)
        if (!danbooruArtistTag) continue
        const searchResult = await fetch(`https://danbooru.donmai.us/artists.json?commit=Search&search%5Bany_name_matches%5D=${danbooruArtistTag}&search%5Border%5D=created_at`, {headers: {"user-agent": "user #576533"}}).then((r) => r.json())
        const id = searchResult.find((r: any) => !r?.is_deleted)?.id 
        if (!id) continue
        let artistData = await fetch(`https://danbooru.donmai.us/artist_urls.json?commit=Search&search[artist][id]=${id}&search[order]=id`, {headers: {"user-agent": "user #576533"}}).then((r) => r.json())
        if (!artistData.length) continue
        if (artistData.length >= 20) {
            const moreResults = await fetch(`https://danbooru.donmai.us/artist_urls.json?commit=Search&page=2&search[artist][id]=${id}&search[order]=id`, {headers: {"user-agent": "user #576533"}}).then((r) => r.json())
            artistData = functions.removeDuplicates([...artistData, ...moreResults])
        }
        const parsedURLs = artistData.reverse().filter((url: any) => url?.is_active).map((url: any) => url?.url)
        let fixedURLs = [] as string[]
        for (const url of parsedURLs) {
            if (url.includes("pixiv.net/stacc")) {
                const pixivUsername = url.match(/(?<=\/stacc\/)(.*?)(?=$)/)?.[0]
                if (pixivUsername) fixedURLs.unshift(`https://pixiv.me/${pixivUsername}`)
            } else if (url.includes("twitter.com/intent") || url.includes("x.com/intent")) {
                const twitterID = url.match(/(?<=user_id=)(.*?)(?=$)/)?.[0]
                if (twitterID) fixedURLs.push(`https://twitter.com/i/user/${twitterID}`)
            } else {
                fixedURLs.push(url)
            }
        }
        let orderedURLS = await sortURLs(fixedURLs)
        const description = orderedURLS.join("\n")
        console.log(`${i}: ${tag.tag}`)
        await moepics.tags.edit({tag: tag.tag, description, silent: true})
    }
}

export default updateArtistLinks