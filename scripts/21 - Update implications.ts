import Moepictures, {Tag} from "moepics-api"
import functions from "../functions/Functions"
import fs from "fs"

const downloadImplications = async () => {
    const moepics = new Moepictures(process.env.MOEPICTURES_API_KEY!)

    let tags = await moepics.tags.list([])

    let implicationMap = {} as any

    try {
        const currentJSON = JSON.parse(fs.readFileSync("implications.json").toString())
        implicationMap = currentJSON
    } catch {}

    console.log(tags.length)
    let i = 0
    for (const tag of tags) {
        i++
        if (i < 0) continue
        if (tag.type === "artist" || tag.type === "character" || 
            tag.type === "series" || tag.type === "meta") continue
        console.log(i)
        const danbooruTag = await moepics.misc.danbooruTags(tag.tag).then((r) => r.tags)
        let url = `https://danbooru.donmai.us/tag_implications.json?commit=Search&search[antecedent_name_matches]=${danbooruTag}&api_key=${process.env.DANBOORU_API_KEY}&login=${process.env.DANBOORU_USERNAME}`
        let results = [] as any[]
        try {
            results = await fetch(url, {headers: {"user-agent": "user"}}).then((r) => r.json())
        } catch {
            await functions.timeout(2000)
            results = await fetch(url, {headers: {"user-agent": "user"}}).then((r) => r.json())
        }
        if (results.length) {
            let implications = [] as string[]
            let tag = ""
            for (const result of results) {
                if (result.status !== "active") continue
                tag = await moepics.misc.moepicsTags(result.antecedent_name).then((r) => r.tags)
                let implication = await moepics.misc.moepicsTags(result.consequent_name).then((r) => r.tags)
                implications.push(implication)
            }
            if (tag) implicationMap[tag] = implications
            fs.writeFileSync("implications.json", JSON.stringify(implicationMap, undefined, 4))
        }
    }
    fs.writeFileSync("implications.json", JSON.stringify(implicationMap, undefined, 4))
}

const updateImplications = async () => {
    const moepics = new Moepictures(process.env.MOEPICTURES_API_KEY!)

    let tags = await moepics.tags.list([])
    let tagMap = {} as {[key: string]: Tag}
    for (const tag of tags) {
        tagMap[tag.tag] = tag
    }

    const implicationMap = JSON.parse(fs.readFileSync("implications.json").toString())

    let i = 0
    for (const [tag, implication] of Object.entries(implicationMap)) {
        i++
        if (i < 0) continue
        const tagData = tagMap[tag]
        let implications = tagData.implications?.map((i) => i?.implication).filter(Boolean) as string[] ?? []
        implications.push(...implication as any)
        implications = functions.removeDuplicates(implications)
        console.log(`${i}: ${tag}`)
        await moepics.tags.edit({tag, implications})
    }
}


export default updateImplications