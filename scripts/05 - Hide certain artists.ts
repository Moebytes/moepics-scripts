import Moepictures from "moepics-api"

const hideCertainArtists = async () => {
    const moepics = new Moepictures(process.env.MOEPICTURES_API_KEY!)

    const tags = await moepics.search.tags({type: "artist", sort: "reverse date", limit: 999999})
    console.log(tags.length)

    let i = 0
    let skip = 15069
    for (const tag of tags) {
        i++
        if (i < skip) continue
        const posts = await moepics.search.posts({query: tag.tag, type: "all", rating: "all+l", style: "all+s", sort: "reverse date", showChildren: true, limit: 999999})
        const r18 = posts.filter((p) => p.rating === "lewd")
        const ratio = r18.length / posts.length * 100
        console.log(`${i}: ${tag.tag} -> ${ratio}`)
        if (ratio >= 90) {
            if (!tag.r18) await moepics.tags.update(tag.tag, "r18", true)
        } else {
            if (tag.r18) await moepics.tags.update(tag.tag, "r18", false)
        }
    }
}

export default hideCertainArtists