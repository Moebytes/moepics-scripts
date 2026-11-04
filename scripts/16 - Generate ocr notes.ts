import Moepictures, {Note} from "moepics-api"
import functions from "../functions/Functions"
import child_process from "child_process"
import util from "util"
import path from "path"
import fs from "fs"

const exec = util.promisify(child_process.exec)

interface RawEntry {
    imageWidth: number
    imageHeight: number
    x: number
    y: number
    width: number
    height: number
    transcript: string
    translation: string
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

const processData = (data: RawEntry[], imageHash: string) => {
    let newNotes = [] as Note[]
    for (const entry of data) {
        let note = {...defaultNoteData} as Note
        note.imageWidth = entry.imageWidth
        note.imageHeight = entry.imageHeight
        note.x = entry.x
        note.y = entry.y
        note.width = entry.width
        note.height = entry.height
        note.transcript = entry.transcript
        note.translation = entry.translation
        note.imageHash = imageHash
        newNotes.push(note)
    }
    return newNotes
}

const generateOCRNotes = async () => {
    const moepics = new Moepictures(process.env.MOEPICTURES_API_KEY!)

    //const posts = await moepics.search.posts({query: "+untranslated +partially-translated", type: "image", rating: "all+l", style: "all+s", sort: "reverse date", showChildren: true, limit: 99999})
    const posts = await moepics.search.posts({query: "-translated", type: "comic", rating: "all+l", style: "all+s", sort: "reverse date", showChildren: true, limit: 99999})
    console.log(posts.length)
  
    let i = 0
    let skip = 54366
    for (const post of posts) {
        i++
        if (Number(post.postID) < skip) continue
        let updated = false
        for (const image of post.images) {
            console.log(`${i} -> ${post.postID} / ${image.order}`)
            let imageLink = moepics.links.getImageLink(image, false)
            const buffer = await moepics.api.fetch(imageLink).then((r) => r.arrayBuffer())
            const imageHash = await functions.pHash(Buffer.from(buffer))

            let imagePath = await functions.dumpImage(Buffer.from(buffer))
            const scriptPath = path.join(__dirname, "../../ocr/ocr.py")
            let command = `python3 "${scriptPath}" -i "${imagePath}"`
            const str = await exec(command).then((s: any) => s.stdout).catch((e: any) => e.stderr)
            fs.unlinkSync(imagePath)

            const data = JSON.parse(str.match(/(?<=>>>JSON<<<)([\s\S]*?)(?=>>>ENDJSON<<<)/gm)?.[0])
            let newNotes = processData(data, imageHash)

            if (newNotes.length) {
                if (newNotes[0].translation.includes("MYMEMORY WARNING")) return console.log(data)
                await moepics.notes.edit({postID: post.postID, order: image.order, data: newNotes})
                updated = true
            }
        }
        if (updated) {
            await moepics.posts.removeTags(post.postID, ["untranslated", "partially-translated"])
            await moepics.posts.addTags(post.postID, ["translated", "notecheck"])
        }
    }
}

export default generateOCRNotes