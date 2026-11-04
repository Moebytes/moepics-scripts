import Moepictures, {Tag, Note} from "moepics-api"
import functions from "../functions/Functions"
import child_process from "child_process"
import util from "util"
import path from "path"
import fs from "fs"

const moepics = new Moepictures(process.env.MOEPICTURES_API_KEY!)
const exec = util.promisify(child_process.exec)

interface RawEntry {
    imageWidth: number
    imageHeight: number
    x: number
    y: number
    width: number
    height: number
    tags: string
    characterTags: string[]
}

interface CleanEntry extends Omit<RawEntry, "tags"> {
    tags: string[]
}

interface TagGroup {
    name: string,
    tags: string[]
}

const defaultNoteData = {
    transcript: "",
    translation: "",
    overlay: false,
    fontSize: 100,
    textColor: "#000000",
    backgroundColor: "#ffffff",
    fontFamily: "Tahoma",
    bold: false,
    italic: false,
    backgroundAlpha: 100,
    strokeColor: "#ffffff",
    strokeWidth: 0,
    breakWord: true,
    borderRadius: 0,
    rotation: 0,
    character: false,
    characterTag: ""
}

const processData = async (data: RawEntry[], tags: string[], characters: string[], imageHash: string) => {
    let characterNotes = [] as Note[]
    let tagGroups = [] as TagGroup[]
    const tagGroupTags: Set<string> = new Set()

    let cleaned = [] as CleanEntry[]
    for (const entry of data) {
        let filteredTags = entry.tags.split(" ").filter(tag => !entry.characterTags.includes(tag)).join(" ")
        let tags = await moepics.misc.moepicsTags(filteredTags).then((r) => r.tags.split(/\s+/))
        let characterTags = await moepics.misc.moepicsTags(entry.characterTags.join(" ")).then((r) => r.tags.split(/\s+/))
        characterTags = characterTags.filter((c) => c !== "unknown-artist")
        if (!characterTags.length) characterTags = characters
        cleaned.push({...entry, tags, characterTags})
    }

    cleaned.sort((a, b) => a.characterTags.length - b.characterTags.length)
    const seenTags = new Set<string>()
    for (const entry of cleaned) {
        entry.characterTags = entry.characterTags.filter((tag) => !seenTags.has(tag))
        entry.characterTags.forEach((tag) => seenTags.add(tag))
    }

    for (const entry of cleaned) {
        let characterTag = entry.characterTags[0]
        if (!characterTag) characterTag = "unknown-character"
        const characterExists = await moepics.tags.get(characterTag)
        if (!characterExists) await moepics.tags.insert(characterTag, "character", "Character.")

        let note = {...defaultNoteData} as Note
        note.imageWidth = entry.imageWidth
        note.imageHeight = entry.imageHeight
        note.x = entry.x
        note.y = entry.y
        note.width = entry.width
        note.height = entry.height
        note.imageHash = imageHash
        note.character = true
        note.characterTag = characterTag
        characterNotes.push(note)

        let name = functions.toProperCase(characterTag.split("-")[0])
        let baseName = name.replace(/\d+$/, "")
        let exists = tagGroups.find((g) => g.name === name)
        let i = 2
        while (exists) {
            name = `${baseName}${i}`
            exists = tagGroups.find((g) => g.name === name)
            i++
        }
        let groupTags = entry.tags.filter((tag) => tags.includes(tag))
        tagGroups.push({name, tags: groupTags})
        groupTags.forEach((tag) => tagGroupTags.add(tag))
    }

    const soloTags = tags.filter((tag) => !tagGroupTags.has(tag))
    if (tagGroups.length && soloTags.length) tagGroups.push({name: "Tags", tags: soloTags})

    return {characterNotes, tagGroups}
}

const generateCharacterNotes = async () => {
    const posts = await moepics.search.posts({query: "multiple-characters -translated -tag-groups", type: "image", rating: "all+l", style: "all+s", sort: "reverse date", showChildren: true, limit: 99999})
    const tags = await moepics.tags.list([])
    let tagMap = {} as {[key: string]: Tag}
    for (const tag of tags) {
        tagMap[tag.tag] = tag
    }
    console.log(posts.length)
  
    let i = 0
    let skip = 54793
    for (const post of posts) {
        i++
        if (Number(post.postID) < skip) continue

        let tagInfo = functions.tagStringCategories(post.tags, tagMap)
        let tagGroups = [] as TagGroup[]
        let postNotes = await moepics.notes.get(post.postID)

        for (const image of post.images) {
            console.log(`${i} -> ${post.postID} / ${image.order}`)
            let imageLink = moepics.links.getImageLink(image, false)
            const buffer = await moepics.api.fetch(imageLink).then((r) => r.arrayBuffer())
            const imageHash = await functions.pHash(Buffer.from(buffer))

            let imagePath = await functions.dumpImage(Buffer.from(buffer))
            const scriptPath = path.join(__dirname, "../../charactersplit/charactersplit.py")
            let command = `python3.11 "${scriptPath}" -i "${imagePath}"`
            const str = await exec(command).then((s: any) => s.stdout).catch((e: any) => e.stderr)
            fs.unlinkSync(imagePath)

            const data = JSON.parse(str.match(/(?<=>>>JSON<<<)([\s\S]*?)(?=>>>ENDJSON<<<)/gm)?.[0])
            let processed = await processData(data, tagInfo.tags, tagInfo.characters, imageHash)

            if (processed.tagGroups.length) {
                if (!tagGroups.length) tagGroups = processed.tagGroups
            }

            if (processed.characterNotes.length) {
                let existingNotes = postNotes.filter((n) => n.order === image.order)
                let newNotes = [...existingNotes, ...processed.characterNotes]
                await moepics.notes.edit({postID: post.postID, order: image.order, data: newNotes})
            }
        }

        if (tagGroups.length) {
            let group = tagGroups.find((g) => g.name === "Tags")
            group?.tags.push("tag-groups", "taggroupcheck")

            const data = {
                postID: post.postID,
                type: post.type,
                rating: post.rating,
                style: post.style,
                artists: tagInfo.artists,
                characters: tagInfo.characters,
                series: tagInfo.series,
                tags: [...tagInfo.tags, ...tagInfo.meta, "tag-groups", "taggroupcheck"],
                tagGroups
            }

            await moepics.posts.quickEdit(data)
        }
    }
}

export default generateCharacterNotes