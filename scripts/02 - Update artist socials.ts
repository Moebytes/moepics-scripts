import Moepictures from "moepics-api"
import Pixiv from "pixiv.ts"
import functions from "../functions/Functions"

const updateArtistSocials = async () => {
    const moepics = new Moepictures(process.env.MOEPICTURES_API_KEY!)
    const pixiv = await Pixiv.refreshLogin(process.env.PIXIV_REFRESH_TOKEN!)

    const tags = await moepics.search.tags({type: "artist", sort: "reverse date", limit: 999999})
    console.log(tags.length)

    let i = 0
    for (const tag of tags) {
        i++
        if (i < 0) continue
        // Comment this line to reprocess all artists
        if (tag.image && tag.social) continue

        const posts = await moepics.search.posts({query: tag.tag, type: "all", rating: "all+l", style: "all+s", showChildren: true})
        if (!posts.length) continue
        const source = posts.find((p) => p.source?.includes("pixiv.net"))?.source
        if (!source) continue
        const illust = await pixiv.illust.get(source).catch(() => null)
        if (!illust) continue

        const user = await pixiv.user.webDetail(illust.user.id)
        const pixivLink = `https://www.pixiv.net/users/${user.userId}`
        const twitterName = user.social?.twitter?.url?.trim().match(/(?<=com\/).*?(?=\?|$)/)?.[0]
        let twitterLink = twitterName ? `https://twitter.com/${twitterName}` : undefined
        if (twitterName === "home" || twitterName === "twitter" || twitterName === "x") twitterLink = undefined
        const webLink = user.webpage || undefined
        let imageBytes = undefined as number[] | undefined
        if (user.imageBig && !tag.image) {
            const image = await fetch(user.imageBig, {headers: {referer: "https://www.pixiv.net/"}}).then((r) => r.arrayBuffer())
            if (image) imageBytes = await functions.cropToSquare(image)
        }
        console.log(`${i}: ${tag.tag}`)
        await moepics.tags.edit({tag: tag.tag, social: pixivLink, twitter: twitterLink, website: webLink, image: imageBytes, silent: true})
    }
}

export default updateArtistSocials