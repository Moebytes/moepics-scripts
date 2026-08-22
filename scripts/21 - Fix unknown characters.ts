import Moepictures, {Tag} from "moepics-api"
import functions from "../functions/Functions"

const fixUnknownCharacters = async () => {
    const moepics = new Moepictures(process.env.MOEPICTURES_API_KEY!)

    const posts = await moepics.search.posts({query: "solo +unknown-character +unknown-series", type: "image", rating: "all+l", style: "all+s", sort: "reverse date", showChildren: true, limit: 99999})
    const tags = await moepics.tags.list([])
    let tagMap = {} as {[key: string]: Tag}
    for (const tag of tags) {
        tagMap[tag.tag] = tag
    }
    console.log(posts.length)

    let i = 0
    let skip = 0
    for (const post of posts) {
        i++
        if (Number(post.postID) < skip) continue
        if (post.pixivTags?.length) {
            let danbooruTags = [] as string[]
            for (const tag of post.pixivTags!) {
                const wikiPages = await fetch(`https://danbooru.donmai.us/wiki_pages.json?commit=Search&search[other_names_match]=${encodeURIComponent(tag)}`, {headers: {"user-agent": "user #576533"}}).then((r) => r.json())
                if (wikiPages?.length) {
                    danbooruTags.push(wikiPages[0].title)
                    continue
                }
            }
            let moepicsTags = await moepics.misc.moepicsTags(danbooruTags.join(" ")).then((r) => r.tags.split(/\s+/))
            if (moepicsTags.includes("original")) {
                await moepics.posts.removeTags(post.postID, ["unknown-character", "unknown-series"])
                await moepics.posts.addTags(post.postID, ["original", "no-series"])
                console.log(`${post.postID} -> original / no-series`)
            } else {
                let characterTags = moepicsTags.filter((tag) => tagMap[tag]?.type === "character")
                let seriesTags = moepicsTags.filter((tag) => tagMap[tag]?.type === "series")
                characterTags = functions.removeDuplicates(characterTags)
                seriesTags = functions.removeDuplicates(seriesTags)
                if (characterTags.length) {
                    for (const characterTag of characterTags) {
                        const exists = await moepics.tags.get(characterTag)
                        if (!exists) await moepics.tags.insert(characterTag, "character", "Character.")
                    }
                    await moepics.posts.removeTags(post.postID, ["unknown-character"])
                    await moepics.posts.addTags(post.postID, characterTags)
                }
                if (seriesTags.length) {
                    for (const seriesTag of seriesTags) {
                        const exists = await moepics.tags.get(seriesTag)
                        if (!exists) await moepics.tags.insert(seriesTag, "series", "Series.")
                    }
                    await moepics.posts.removeTags(post.postID, ["unknown-series"])
                    await moepics.posts.addTags(post.postID, seriesTags)
                }
                let c = characterTags.length ? characterTags.join(", ") : ""
                let s = seriesTags.length ? seriesTags.join(", ") : ""
                console.log(`${post.postID} -> ${[c, s].join(" / ")}`)
            }
        }
    }
}

const fixUnknownCharactersDanbooru = async () => {
    const moepics = new Moepictures(process.env.MOEPICTURES_API_KEY!)

    const posts = await moepics.search.posts({query: "+unknown-character +unknown-series", type: "image", rating: "all+l", style: "all+s", sort: "reverse date", showChildren: true, limit: 99999})
    const tags = await moepics.tags.list([])
    let tagMap = {} as {[key: string]: Tag}
    for (const tag of tags) {
        tagMap[tag.tag] = tag
    }
    console.log(posts.length)

    let i = 0
    let skip = 0
    for (const post of posts) {
        i++
        if (Number(post.postID) < skip) continue
        // @ts-ignore
        if (post.mirrors?.danbooru) {
            // @ts-ignore
            let id = post.mirrors.danbooru.match(/\d+/)?.[0]
            const danbooruPost = await fetch(`https://danbooru.donmai.us/posts/${id}.json`, {headers: {"user-agent": "user #576533"}}).then((r) => r.json())
            let tagString = `${danbooruPost.tag_string_character} ${danbooruPost.tag_string_copyright}`
            let moepicsTags = await moepics.misc.moepicsTags(tagString).then((r) => r.tags.split(/\s+/))
            if (moepicsTags.includes("original")) {
                await moepics.posts.removeTags(post.postID, ["unknown-character", "unknown-series"])
                await moepics.posts.addTags(post.postID, ["original", "no-series"])
                console.log(`${post.postID} -> original / no-series`)
            } else {
                let characterTags = moepicsTags.filter((tag) => tagMap[tag]?.type === "character")
                let seriesTags = moepicsTags.filter((tag) => tagMap[tag]?.type === "series")
                characterTags = functions.removeDuplicates(characterTags)
                seriesTags = functions.removeDuplicates(seriesTags)
                if (characterTags.length) {
                    for (const characterTag of characterTags) {
                        const exists = await moepics.tags.get(characterTag)
                        if (!exists) await moepics.tags.insert(characterTag, "character", "Character.")
                    }
                    await moepics.posts.removeTags(post.postID, ["unknown-character"])
                    await moepics.posts.addTags(post.postID, characterTags)
                }
                if (seriesTags.length) {
                    for (const seriesTag of seriesTags) {
                        const exists = await moepics.tags.get(seriesTag)
                        if (!exists) await moepics.tags.insert(seriesTag, "series", "Series.")
                    }
                    await moepics.posts.removeTags(post.postID, ["unknown-series"])
                    await moepics.posts.addTags(post.postID, seriesTags)
                }
                let c = characterTags.length ? characterTags.join(", ") : ""
                let s = seriesTags.length ? seriesTags.join(", ") : ""
                console.log(`${post.postID} -> ${[c, s].join(" / ")}`)
            }
        }
    }
}

export default fixUnknownCharactersDanbooru