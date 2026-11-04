import Moepictures from "moepics-api"
import functions from "../functions/Functions"

const cleanArtistTags = async () => {
    const moepics = new Moepictures(process.env.MOEPICTURES_API_KEY!)

    const tags = await moepics.search.tags({type: "artist", sort: "reverse date", limit: 999999})
    console.log(tags.length)

    let i = 0
    for (const tag of tags) {
        i++
        if (i < 0) continue
        const result = functions.detectCJK(tag.tag)
        if (result.chinese || result.japanese || result.korean || result.diacritics) {
            let romanized = functions.romanizeTag(tag.tag, result)
            console.log(`${i}: ${tag.tag} -> ${romanized}`)
            const response = await moepics.tags.edit({tag: tag.tag, key: romanized, silent: true})
            if (response === "Tag name conflict") {
                await moepics.tags.aliasTo({tag: tag.tag, aliasTo: romanized, silent: true, skipAliasing: true})
            }
        }
    }
}

const cleanDashTags = async () => {
    const moepics = new Moepictures(process.env.MOEPICTURES_API_KEY!)

    const tags = await moepics.search.tags({type: "all", sort: "reverse date", limit: 999999})
    console.log(tags.length)

    let i = 0
    for (const tag of tags) {
        i++
        if (i < 0) continue
        if (/^-+/.test(tag.tag) || /-+$/.test(tag.tag) || /--+/.test(tag.tag)) {
            let fixed = functions.cleanTag(tag.tag)
            console.log(`${i}: ${tag.tag} -> ${fixed}`)
            const result = await moepics.tags.edit({tag: tag.tag, key: fixed, silent: true})
            if (result === "Tag name conflict") {
                const fixedObj = await moepics.tags.get(fixed)
                if (tag.type === fixedObj?.type) {
                    await moepics.tags.aliasTo({tag: tag.tag, aliasTo: fixed, silent: true, skipAliasing: true})
                }
            }
        }
    }
}

export default cleanArtistTags