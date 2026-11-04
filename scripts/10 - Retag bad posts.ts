import Moepictures from "moepics-api"
import functions from "../functions/Functions"
import path from "path"

const retagBadPosts = async () => {
    const moepics = new Moepictures(process.env.MOEPICTURES_API_KEY!)

    const posts = await moepics.search.posts({query: "-autotags", type: "image", rating: "all+l", style: "all+s", sort: "reverse date", showChildren: true, limit: 99999})
    console.log(posts.length)
  
    let i = 0
    let skip = 0
    for (const post of posts) {
        i++
        if (Number(post.postID) < skip) continue
        console.log(`${i} -> ${post.postID}`)
        let image = post.images[0]
        let imageLink = moepics.links.getImageLink(post.images[0], false)
        const buffer = await moepics.api.fetch(imageLink).then((r) => r.arrayBuffer())
        let hasUpscaled = post.images[0].upscaledFilename ? true : false
        const tagLookup = await moepics.misc.tagLookup({
            type: post.type, 
            rating: post.rating, 
            style: post.style, 
            hasUpscaled, 
            current: {
                bytes: Object.values(new Uint8Array(buffer)),
                ext: path.extname(image.filename).replace(".", ""),
                height: image.height,
                width: image.width,
                name: image.filename,
                size: image.size,
                link: imageLink,
                originalLink: imageLink,
                thumbnail: "",
                thumbnailExt: "",
                altSource: image.altSource,
                directLink: image.directLink
            }
        })

        // Insert important tags that don't exist yet
        for (const item of tagLookup.artists) {
            if (!item.tag) continue
            const exists = await moepics.tags.get(item.tag)
            if (!exists) await moepics.tags.insert(item.tag, "artist", "Artist.")
        }

        for (const item of tagLookup.characters) {
            if (!item.tag) continue
            const exists = await moepics.tags.get(item.tag)
            if (!exists) await moepics.tags.insert(item.tag, "character", "Character.")
        }

        for (const item of tagLookup.series) {
            if (!item.tag) continue
            const exists = await moepics.tags.get(item.tag)
            if (!exists) await moepics.tags.insert(item.tag, "series", "Series.")
        }

        // This check can be skipped for speed, but sometimes needed
        for (const tag of tagLookup.tags) {
            const exists = await moepics.tags.get(tag!)
            if (!exists) await moepics.tags.insert(tag, "tag", functions.toProperCase(tag.replaceAll("-", " ")) + ".")
        }

        let appendTags = functions.removeDuplicates([
            ...tagLookup.artists.map((t) => t.tag),
            ...tagLookup.characters.map((t) => t.tag),
            ...tagLookup.series.map((t) => t.tag),
            ...tagLookup.meta,
            ...tagLookup.tags
        ].filter(Boolean)) as string[]

        // Most of these posts just need to append tags
        await moepics.posts.addTags(post.postID, appendTags)
    }
}

export default retagBadPosts