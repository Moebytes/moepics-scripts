import Moepictures from "moepics-api"
import functions from "../functions/Functions"
import path from "path"

const mergeDuplicateArtists = async () => {
    const moepics = new Moepictures(process.env.MOEPICTURES_API_KEY!)

    const tags = await moepics.search.tags({type: "artist", sort: "reverse date", limit: 999999})

    let pixivObj = {} as {[key: string]: string[]}

    for (const tag of tags) {
        if (!tag.social) continue
        if (pixivObj[tag.social]) {
            pixivObj[tag.social].push(tag.tag)
        } else {
            pixivObj[tag.social] = [tag.tag]
        }
    }

    let duplicateObj = {} as {[key: string]: string[]}

    for (const [key, value] of Object.entries(pixivObj)) {
        if (value.length >= 2) duplicateObj[key] = value
    }

    console.log(duplicateObj)

    for (const [key, tags] of Object.entries(duplicateObj)) {
        let twitter = ""
        for (const tag of tags) {
            let tagObj = await moepics.tags.get(tag)
            if (tagObj?.twitter) {
                twitter = tagObj?.twitter
                break
            }
        }
        let targetTag = tags.reduce((shortest, tag) => tag.length < shortest.length ? tag : shortest, tags[0])
        let twitterName = ""
        if (twitter && twitter !== "https" && twitter !== "home" && 
            twitter !== "twitter" && twitter !== "x") {
                twitterName = functions.fixTwitterTag(path.basename(twitter))
                let foundTag = tags.find((t) => t === twitterName)
                if (foundTag) targetTag = foundTag
        }
        for (const tag of tags) {
            if (tag === targetTag) continue
            console.log(`${tag} -> ${targetTag}`)
            await moepics.tags.aliasTo({tag, aliasTo: targetTag, silent: true, skipAliasing: true})
        }
        if (twitterName && targetTag !== twitterName) await moepics.tags.edit({tag: targetTag, key: twitterName, silent: true})
    }
}

export default mergeDuplicateArtists